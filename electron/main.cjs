const { app, BrowserWindow, ipcMain, net, shell, protocol, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { Buffer } = require('node:buffer')

app.setName('Roost')

/** Must run before `app.ready` so renderer can load `roost-media://` from `http` dev server (Chromium blocks `file://`). */
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'roost-media',
		privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
	}
])

/** Lazy-load DB stack (jiti + `better-sqlite3`) so Electron can start before native addon + heavy schema init. */
let dbCache = null
function getDb() {
	if (!dbCache) dbCache = require('./db/initial.cjs')
	return dbCache
}

/** Lazy: `ipc-registry` jiti-loads all Drizzle domain modules — defer until first `db-api` IPC. */
let dbIpcCache = null
function getDbIpc() {
	if (!dbIpcCache) dbIpcCache = require('./db/ipc-registry.cjs')
	return dbIpcCache
}

/** Preload calls `sendSync` so `insetTitleBar` matches main (see `titleBarStyle: hiddenInset`). */
ipcMain.on('roost-sync-window-chrome', (event) => {
	event.returnValue = process.platform === 'darwin'
})

/** Preload: absolute directory containing `roost-library.db` (`app.getPath('userData')`). */
ipcMain.on('roost-sync-user-data-path', (event) => {
	event.returnValue = app.getPath('userData')
})

let invokeHandlersRegistered = false

function extFromImportedMedia(mimeType, originalName) {
	const fromName = path.extname(typeof originalName === 'string' ? originalName : '').toLowerCase()
	if (fromName && fromName.length <= 10 && /^\.[a-z0-9]+$/i.test(fromName)) return fromName
	const m = String(mimeType || '').toLowerCase()
	if (m.includes('jpeg') || m === 'image/jpg') return '.jpg'
	if (m === 'image/png') return '.png'
	if (m === 'image/gif') return '.gif'
	if (m === 'image/webp') return '.webp'
	if (m === 'image/svg+xml') return '.svg'
	if (m === 'image/avif') return '.avif'
	if (m === 'video/mp4') return '.mp4'
	if (m === 'video/webm') return '.webm'
	if (m === 'video/quicktime') return '.mov'
	if (m.startsWith('image/')) return '.img'
	if (m.startsWith('video/')) return '.vid'
	return '.bin'
}

/** ASCII-ish slug for a directory segment under `userData/media/` (see `importedMediaDestDir`). */
function slugDirSegment(raw) {
	const s = String(raw ?? '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64)
	return s || 'collection'
}

/**
 * Folder basename: `<nameSlug>--<id>` (split on **last** `--` to get `id` if the name contains `--`).
 * `id` is alphanumeric only (UUID hyphens stripped).
 */
function collectionMediaSubdir(collectionId, collectionName) {
	const id = String(collectionId ?? '')
		.trim()
		.replace(/[^a-zA-Z0-9]/g, '')
	if (!id) throw new Error('collectionId is required')
	const raw = slugDirSegment(collectionName).replace(/-+$/, '')
	const namePart = raw || 'collection'
	return `${namePart}--${id}`
}

/** Older layout: `<nameSlug>-<id>` (single hyphen before id). */
function legacyCollectionMediaSubdirSingleHyphen(collectionId, collectionName) {
	const id = String(collectionId ?? '')
		.trim()
		.replace(/[^a-zA-Z0-9]/g, '')
	if (!id) throw new Error('collectionId is required')
	const raw = slugDirSegment(collectionName).replace(/-+$/, '')
	const namePart = raw || 'collection'
	return `${namePart}-${id}`
}

/**
 * Resolve destination directory for imports.
 * Payload: `scope`: `'collection'` | `'user'`, plus `collectionId` / `collectionName` when scope is collection.
 */
function importedMediaDestDir(payload) {
	const userData = app.getPath('userData')
	/** `app.getPath('userData')` is already the per-app dir (e.g. `…/Application Support/roost`) — do not add another `roost`. */
	const base = path.join(userData, 'media')
	const scope = payload?.scope === 'user' ? 'user' : 'collection'
	if (scope === 'user') {
		return path.join(base, '__user__')
	}
	const cid = typeof payload?.collectionId === 'string' ? payload.collectionId.trim() : ''
	if (!cid) throw new Error('collectionId is required for collection-scoped media')
	const cname = typeof payload?.collectionName === 'string' ? payload.collectionName : ''
	const sub = collectionMediaSubdir(cid, cname)
	if (sub.includes('..') || path.isAbsolute(sub)) throw new Error('invalid media subdir')
	return path.join(base, sub)
}

/** Absolute dirs where this collection’s imports may live (new + legacy basename × both roots). */
function collectionMediaDirCandidates(collectionId, collectionName) {
	const cid = String(collectionId ?? '').trim()
	if (!cid) return []
	const cname = typeof collectionName === 'string' ? collectionName : ''
	const subs = new Set()
	try {
		subs.add(collectionMediaSubdir(cid, cname))
	} catch {
		/* */
	}
	try {
		subs.add(legacyCollectionMediaSubdirSingleHyphen(cid, cname))
	} catch {
		/* */
	}
	const userData = app.getPath('userData')
	const out = []
	for (const sub of subs) {
		const a = path.resolve(path.join(userData, 'media', sub))
		const b = path.resolve(path.join(userData, 'roost', 'media', sub))
		for (const p of [a, b]) {
			if (!out.includes(p)) out.push(p)
		}
	}
	return out
}

/** True if `absFile` is `dir` or a file/dir inside `dir`. */
function pathIsUnderDir(absFile, dir) {
	const d = path.resolve(dir)
	const f = path.resolve(absFile)
	const rel = path.relative(d, f)
	return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Path must resolve under `userData/media`, or mistaken earlier `userData/roost/media` (double `roost`). */
function isFileInsideManagedMedia(absolutePath) {
	const userData = app.getPath('userData')
	const roots = [
		path.resolve(path.join(userData, 'media')),
		path.resolve(path.join(userData, 'roost', 'media'))
	]
	const resolved = path.resolve(absolutePath)
	for (const mediaRoot of roots) {
		const rel = path.relative(mediaRoot, resolved)
		if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return true
	}
	return false
}

let roostMediaProtocolRegistered = false

/** Map `roost-media://roost/<base64url(utf8 path)>` → absolute path; empty if malformed. */
function absolutePathFromRoostMediaUrl(requestUrl) {
	try {
		const u = new URL(requestUrl)
		if (u.protocol !== 'roost-media:') return ''
		if (u.hostname.toLowerCase() !== 'roost') return ''
		const seg = (u.pathname || '').replace(/^\//, '')
		if (!seg) return ''
		return Buffer.from(seg, 'base64url').toString('utf8')
	} catch {
		return ''
	}
}

function registerRoostMediaProtocol() {
	if (roostMediaProtocolRegistered) return
	roostMediaProtocolRegistered = true
	session.defaultSession.protocol.registerFileProtocol('roost-media', (request, callback) => {
		const raw = absolutePathFromRoostMediaUrl(request.url)
		const resolved = raw ? path.resolve(raw) : ''
		if (!resolved || !isFileInsideManagedMedia(resolved)) {
			callback({ error: -6 })
			return
		}
		callback({ path: resolved })
	})
}

/** All `ipcMain.handle` channels (after `app.ready` so `app.getPath` etc. are stable). */
function registerInvokeHandlers() {
	if (invokeHandlersRegistered) return

	/**
	 * Copy imported media into `userData/media/.../<uuid>.<ext>` (never move / never persist a path outside userData).
	 * Payload: { sourceAbsolutePath?, buffer?, mimeType?, originalName?, scope?, collectionId?, collectionName? }
	 */
	ipcMain.handle('roost-save-imported-media', async (_event, payload) => {
		try {
			const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : ''
			const originalName = typeof payload?.originalName === 'string' ? payload.originalName : ''
			const mediaDir = importedMediaDestDir(payload)
			fs.mkdirSync(mediaDir, { recursive: true })
			const ext = extFromImportedMedia(mimeType, originalName)
			const fileName = `${crypto.randomUUID()}${ext}`
			const dest = path.join(mediaDir, fileName)
			const destResolved = path.resolve(dest)

			const srcRaw = typeof payload?.sourceAbsolutePath === 'string' ? payload.sourceAbsolutePath.trim() : ''
			if (srcRaw) {
				const srcResolved = path.resolve(srcRaw)
				let st
				try {
					st = fs.statSync(srcResolved)
				} catch {
					return { ok: false, error: 'source file not found' }
				}
				if (!st.isFile()) return { ok: false, error: 'source is not a regular file' }
				if (srcResolved === destResolved) return { ok: false, error: 'invalid source path' }
				await fs.promises.copyFile(srcResolved, destResolved)
				if (!isFileInsideManagedMedia(destResolved)) {
					await fs.promises.unlink(destResolved).catch(() => {})
					return { ok: false, error: 'destination outside managed media' }
				}
				return { ok: true, absolutePath: destResolved }
			}

			let buf = payload?.buffer
			if (buf == null) return { ok: false, error: 'missing buffer or sourceAbsolutePath' }
			if (buf instanceof ArrayBuffer) buf = Buffer.from(buf)
			else if (ArrayBuffer.isView(buf)) buf = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
			else if (!Buffer.isBuffer(buf)) buf = Buffer.from(new Uint8Array(buf))
			fs.writeFileSync(destResolved, buf)
			if (!isFileInsideManagedMedia(destResolved)) {
				fs.unlinkSync(destResolved)
				return { ok: false, error: 'destination outside managed media' }
			}
			return { ok: true, absolutePath: destResolved }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('roost-delete-imported-media', async (_event, payload) => {
		try {
			const absPath = typeof payload?.absolutePath === 'string' ? payload.absolutePath.trim() : ''
			if (!absPath) return { ok: false, error: 'missing path' }
			if (!isFileInsideManagedMedia(absPath)) {
				return { ok: false, error: 'path not under managed media directory' }
			}
			await fs.promises.unlink(absPath).catch((err) => {
				if (err && typeof err === 'object' && err.code === 'ENOENT') return
				throw err
			})
			return { ok: true }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('roost-delete-collection-media-folder', async (_event, payload) => {
		try {
			const cid = typeof payload?.collectionId === 'string' ? payload.collectionId.trim() : ''
			if (!cid) return { ok: false, error: 'missing collectionId' }
			const cname = typeof payload?.collectionName === 'string' ? payload.collectionName : ''
			const remaining = Array.isArray(payload?.remainingMediaPaths) ? payload.remainingMediaPaths : []
			const dirs = collectionMediaDirCandidates(cid, cname)
			let removed = 0
			for (const dir of dirs) {
				const resolvedDir = path.resolve(dir)
				if (!isFileInsideManagedMedia(resolvedDir)) continue
				let blocked = false
				for (const raw of remaining) {
					const p = typeof raw === 'string' ? raw.trim() : ''
					if (!p) continue
					if (pathIsUnderDir(p, resolvedDir)) {
						blocked = true
						break
					}
				}
				if (blocked) continue
				let st
				try {
					st = await fs.promises.stat(resolvedDir)
				} catch {
					continue
				}
				if (!st.isDirectory()) continue
				await fs.promises.rm(resolvedDir, { recursive: true, force: true })
				removed++
			}
			return { ok: true, removed }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('roost-rename-collection-media-folder', async (_event, payload) => {
		try {
			const cid = typeof payload?.collectionId === 'string' ? payload.collectionId.trim() : ''
			const oldName = typeof payload?.oldCollectionName === 'string' ? payload.oldCollectionName : ''
			const newName = typeof payload?.newCollectionName === 'string' ? payload.newCollectionName : ''
			if (!cid) return { ok: false, error: 'missing collectionId' }
			let newSub
			try {
				newSub = collectionMediaSubdir(cid, newName)
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e)
				return { ok: false, error: message }
			}
			const oldSubs = []
			try {
				oldSubs.push(collectionMediaSubdir(cid, oldName))
			} catch {
				/* */
			}
			try {
				oldSubs.push(legacyCollectionMediaSubdirSingleHyphen(cid, oldName))
			} catch {
				/* */
			}
			const dedupOld = [...new Set(oldSubs)]
			const userData = app.getPath('userData')
			const bases = [path.join(userData, 'media'), path.join(userData, 'roost', 'media')]
			/** @type {{ from: string, to: string }[]} */
			const renames = []
			for (const base of bases) {
				const resolvedBase = path.resolve(base)
				let sourceDir = null
				for (const sub of dedupOld) {
					const candidate = path.resolve(path.join(resolvedBase, sub))
					try {
						const st = await fs.promises.stat(candidate)
						if (!st.isDirectory()) continue
						if (!isFileInsideManagedMedia(path.join(candidate, '__roost_probe__'))) continue
						sourceDir = candidate
						break
					} catch {
						/* */
					}
				}
				if (!sourceDir) continue
				const destDir = path.resolve(path.join(resolvedBase, newSub))
				if (path.resolve(sourceDir) === path.resolve(destDir)) continue
				try {
					const dstSt = await fs.promises.stat(destDir)
					if (dstSt.isDirectory()) {
						return { ok: false, error: `destination media folder already exists: ${destDir}` }
					}
				} catch {
					/* absent */
				}
				await fs.promises.rename(sourceDir, destDir)
				renames.push({ from: sourceDir, to: destDir })
			}
			return { ok: true, renames }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('roost-reveal-user-data', () => {
		try {
			const dir = app.getPath('userData')
			const dbFile = path.join(dir, 'roost-library.db')
			shell.showItemInFolder(dbFile)
			return { ok: true }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('fetch-metadata', async (_event, payload) => {
		const url = typeof payload?.url === 'string' ? payload.url.trim() : ''
		if (!/^https?:\/\//i.test(url)) {
			return { ok: false, status: 0, error: 'Only http(s) URLs are allowed' }
		}
		const method = typeof payload?.method === 'string' ? payload.method : 'GET'
		const headers = payload?.headers && typeof payload.headers === 'object' ? payload.headers : {}
		const body = payload?.body != null ? String(payload.body) : undefined
		const timeoutMs = typeof payload?.timeoutMs === 'number' ? payload.timeoutMs : 25_000

		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), timeoutMs)
		try {
			const res = await net.fetch(url, {
				method,
				headers,
				body: method === 'GET' || method === 'HEAD' ? undefined : body,
				signal: ctrl.signal,
				redirect: 'follow'
			})
			const text = await res.text()
			const headerObj = {}
			for (const [k, v] of res.headers.entries()) {
				headerObj[k] = v
			}
			return {
				ok: res.ok,
				status: res.status,
				statusText: res.statusText,
				text,
				url: res.url,
				headers: headerObj
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			const name = e instanceof Error && e.name === 'AbortError' ? 'AbortError' : 'Error'
			return { ok: false, status: 0, error: message, errorName: name }
		} finally {
			clearTimeout(timer)
		}
	})

	ipcMain.handle('db-library-list', () => {
		try {
			return { ok: true, items: getDb().libraryList(app) }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('db-library-upsert', (_event, metadata) => {
		try {
			getDb().libraryUpsert(app, metadata)
			return { ok: true }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('db-library-delete', (_event, sourceUrl) => {
		try {
			const r = getDb().libraryDelete(app, sourceUrl)
			return { ok: true, changes: r.changes }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	ipcMain.handle('db-api', (_event, payload) => {
		try {
			getDb().openDb(app)
			const domain = payload?.domain
			const method = payload?.method
			const args = Array.isArray(payload?.args) ? payload.args : []
			if (typeof domain !== 'string' || typeof method !== 'string') {
				return { ok: false, error: 'db-api: domain and method must be strings' }
			}
			const data = getDbIpc().invoke(domain, method, args)
			return { ok: true, data }
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			return { ok: false, error: message }
		}
	})

	invokeHandlersRegistered = true
}

/** Set `ELECTRON_DEV=1` (see `npm run electron:dev`) or pass `--dev` when running unpackaged. */
const dev =
	process.env.ELECTRON_DEV === '1' ||
	(!app.isPackaged && process.argv.includes('--dev'))

function createWindow() {
	const iconCandidates = [
		path.join(__dirname, '..', 'build-resources', 'icon.png'),
		path.join(__dirname, '..', 'build-resources', 'icon.icns')
	]
	let iconPath
	for (const p of iconCandidates) {
		if (fs.existsSync(p)) {
			iconPath = p
			break
		}
	}
	const win = new BrowserWindow({
		title: 'Roost',
		...(iconPath ? { icon: iconPath } : {}),
		width: 1280,
		height: 840,
		minWidth: 720,
		minHeight: 480,
		show: false,
		/** macOS: merge traffic lights into the page (Pinterest-style); see `+layout.svelte` drag strip */
		...(process.platform === 'darwin'
			? {
					titleBarStyle: 'hiddenInset',
					trafficLightPosition: { x: 12, y: 10 }
				}
			: {}),
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	})

	win.once('ready-to-show', () => win.show())

	if (dev) {
		const url = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
		void win.loadURL(url)
		win.webContents.openDevTools({ mode: 'detach' })
	} else {
		const indexHtml = path.join(__dirname, '..', 'build', 'index.html')
		void win.loadFile(indexHtml)
	}
}

app.whenReady().then(() => {
	registerRoostMediaProtocol()
	registerInvokeHandlers()
	getDb().openDb(app)
	createWindow()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('before-quit', () => {
	if (dbCache) getDb().closeDb()
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
