const { app, BrowserWindow, ipcMain, net } = require('electron')
const path = require('node:path')

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

/**
 * Renderer cannot cross-origin fetch; main `net.fetch` has no CORS.
 * Invoked as `electronAPI.fetchMetadata(url, init)` from preload.
 * Payload: { url, method?, headers?, body?, timeoutMs? }
 */
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

/**
 * Returns all `library_item` rows (newest `fetchedAt` first). Opens the DB if needed.
 * Renderer: `window.electronAPI.libraryList()` via preload `ipcRenderer.invoke('db-library-list')`.
 *
 * @returns {Promise<{ ok: true, items: Array<{ id: string, sourceUrl: string, provider: string, title: string | null, fetchedAt: number, metadata: Record<string, unknown> }> } | { ok: false, error: string }>}
 */
ipcMain.handle('db-library-list', () => {
	try {
		return { ok: true, items: getDb().libraryList(app) }
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		return { ok: false, error: message }
	}
})

/**
 * Inserts or updates a `library_item` keyed by `metadata.sourceUrl`.
 * Renderer: `window.electronAPI.libraryUpsert(metadata)`.
 *
 */
ipcMain.handle('db-library-upsert', (_event, metadata) => {
	try {
		getDb().libraryUpsert(app, metadata)
		return { ok: true }
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		return { ok: false, error: message }
	}
})

/**
 * Deletes the `library_item` whose `source_url` matches `sourceUrl` (trimmed).
 * Renderer: `window.electronAPI.libraryDelete(sourceUrl)`.
 *
 */
ipcMain.handle('db-library-delete', (_event, sourceUrl) => {
	try {
		const r = getDb().libraryDelete(app, sourceUrl)
		return { ok: true, changes: r.changes }
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		return { ok: false, error: message }
	}
})

/**
 * Typed Drizzle CRUD from `electron/db/{collections,items,settings,tags,utils}/*.ts`.
 * Payload: `{ domain: 'collections' | 'items' | 'settings' | 'tags' | 'utils', method: string, args?: unknown[] }`.
 * Renderer: `window.electronAPI.dbInvoke(domain, method, ...args)`.
 */
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

/** Set `ELECTRON_DEV=1` (see `npm run electron:dev`) or pass `--dev` when running unpackaged. */
const dev =
	process.env.ELECTRON_DEV === '1' ||
	(!app.isPackaged && process.argv.includes('--dev'))

function createWindow() {
	const win = new BrowserWindow({
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
