const electron = require('electron')
const { contextBridge, ipcRenderer } = electron
const webUtils = electron.webUtils

function headersToRecord(headers) {
	const out = {}
	if (!headers) return out
	if (typeof Headers !== 'undefined' && headers instanceof Headers) {
		headers.forEach((v, k) => {
			out[k] = v
		})
		return out
	}
	if (typeof headers === 'object') {
		return { ...headers }
	}
	return out
}

/**
 * Main-process `net.fetch` via IPC — returns a plain `{ __roostNet, body, status, headers }`
 * so the renderer can call `new Response` (preload `Response` is unreliable in Electron).
 */
async function fetchMetadata(url, init = {}) {
	const method = (init.method || 'GET').toUpperCase()
	const headers = headersToRecord(init.headers)
	const timeoutMs = init.timeoutMs ?? 25_000
	let body
	if (init.body != null && method !== 'GET' && method !== 'HEAD') {
		body = typeof init.body === 'string' ? init.body : String(init.body)
	}
	const result = await ipcRenderer.invoke('fetch-metadata', {
		url,
		method,
		headers,
		body,
		timeoutMs
	})
	if (result.errorName === 'AbortError') {
		const err = new DOMException('Aborted', 'AbortError')
		throw err
	}
	if (result.error) {
		throw new TypeError(result.error)
	}
	// Plain object over IPC — build `Response` in the renderer; preload `Response` can break `.status` / `.ok`.
	let status =
		typeof result.status === 'number' && Number.isFinite(result.status) ? Math.trunc(result.status) : NaN
	if (!Number.isFinite(status) || status < 200 || status > 599) {
		status = result.ok === true ? 200 : 502
	}
	const hdr = result.headers && typeof result.headers === 'object' ? result.headers : {}
	return {
		__roostNet: true,
		body: String(result.text ?? ''),
		status,
		headers: hdr
	}
}

async function libraryList() {
	return ipcRenderer.invoke('db-library-list')
}

async function libraryUpsert(metadata) {
	return ipcRenderer.invoke('db-library-upsert', metadata)
}

async function libraryDelete(sourceUrl) {
	return ipcRenderer.invoke('db-library-delete', sourceUrl)
}

async function dbInvoke(domain, method, ...args) {
	return ipcRenderer.invoke('db-api', { domain, method, args })
}

async function revealUserDataInFileManager() {
	return ipcRenderer.invoke('roost-reveal-user-data')
}

async function saveImportedMedia(payload) {
	return ipcRenderer.invoke('roost-save-imported-media', payload)
}

async function deleteImportedMedia(payload) {
	return ipcRenderer.invoke('roost-delete-imported-media', payload)
}

async function deleteCollectionMediaFolder(payload) {
	return ipcRenderer.invoke('roost-delete-collection-media-folder', payload)
}

async function renameCollectionMediaFolder(payload) {
	return ipcRenderer.invoke('roost-rename-collection-media-folder', payload)
}

async function openLinkPopup(url) {
	return ipcRenderer.invoke('roost-open-link-popup', url)
}

/** Real path for a File from disk (picker / drag); empty for synthetic blobs. */
function getNativePathForFile(file) {
	if (!file || typeof webUtils?.getPathForFile !== 'function') return ''
	try {
		return String(webUtils.getPathForFile(file) ?? '').trim()
	} catch {
		return ''
	}
}

/** UTF-8 → base64url (sandboxed preload: no `Buffer` / no `node:buffer` require). */
function utf8ToBase64Url(s) {
	const bytes = new TextEncoder().encode(s)
	let bin = ''
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** `<img>` / `<video>` src: `http` renderer cannot load `file://`; main serves via `roost-media` protocol. */
function roostMediaUrlFromPath(absPath) {
	const str = String(absPath ?? '').trim()
	if (!str) return ''
	try {
		return `roost-media://roost/${utf8ToBase64Url(str)}`
	} catch {
		return ''
	}
}

contextBridge.exposeInMainWorld('electronAPI', {
	fetchMetadata,
	libraryList,
	libraryUpsert,
	libraryDelete,
	dbInvoke,
	revealUserDataInFileManager,
	saveImportedMedia,
	deleteImportedMedia,
	deleteCollectionMediaFolder,
	renameCollectionMediaFolder,
	openLinkPopup,
	getNativePathForFile,
	roostMediaUrlFromPath
})

let insetTitleBar = false
try {
	insetTitleBar = require('node:os').platform() === 'darwin'
} catch {
	try {
		insetTitleBar = Boolean(ipcRenderer.sendSync('roost-sync-window-chrome'))
	} catch {
		insetTitleBar = false
	}
}

let userDataPath = ''
try {
	userDataPath = String(ipcRenderer.sendSync('roost-sync-user-data-path') ?? '')
} catch {
	userDataPath = ''
}

contextBridge.exposeInMainWorld('roost', {
	isElectron: true,
	insetTitleBar,
	userDataPath
})
