/**
 * Imports are always **copied** into Roost’s app data (`<Electron userData>/media/...`); nothing is moved or
 * symlinked from outside, so the DB only ever points at paths under that tree (plus legacy `userData/media/`).
 *
 * Layout:
 * — collection: `…/media/<slugged-name>--<collectionId>/<uuid>.<ext>` (split on last `--` for id)
 * — avatar: `…/media/__user__/<uuid>.<ext>`
 *
 * When Electron exposes a real path for a `File`, main uses `copyFile` so large files are not buffered in the renderer.
 */

export type ImportedMediaStoreScope =
	| { scope: 'collection'; collectionId: string; collectionName?: string }
	| { scope: 'user' }

/** Folder basename is `<slug>--<id>`; id is everything after the **last** `--` (then alnum-only, matching main). */
export function collectionIdAlnumFromMediaFolderBasename(basename: string): string {
	const s = basename.trim()
	const i = s.lastIndexOf('--')
	if (i === -1) return ''
	return s.slice(i + 2).replace(/[^a-zA-Z0-9]/g, '')
}

/** Recover OS path from a `file:` href (renderer has no `fileURLToPath`). */
function absolutePathFromFileUrl(href: string): string {
	try {
		const u = new URL(href)
		if (u.protocol !== 'file:') return ''
		let pathname = decodeURIComponent(u.pathname || '')
		// `file:///C:/Users/...` → pathname `/C:/Users/...`
		pathname = pathname.replace(/^\/([A-Za-z]):\//, '$1:/')
		return pathname
	} catch {
		return ''
	}
}

/**
 * `<img>` / `<video>` src for a filesystem path.
 * In Electron + Vite dev (`http://`), Chromium blocks `file://` from a remote document — use main `roost-media://`.
 */
export function absolutePathToFileUrl(absPath: string): string {
	const trimmed = absPath.trim()
	if (!trimmed) return ''
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (typeof api?.roostMediaUrlFromPath === 'function') {
		const href = api.roostMediaUrlFromPath(trimmed)
		if (href) return href
	}
	const normalized = trimmed.replace(/\\/g, '/')
	const pathPart = normalized.startsWith('/') ? normalized : `/${normalized}`
	return `file://${encodeURI(pathPart)}`
}

/**
 * Prefer remote `http(s)` url; then filesystem `path` (never use raw `file://` in Electron+Vite).
 * Stale rows may store a `file:` URL in `url` — remap through `absolutePathToFileUrl`.
 */
export function mediaDisplaySrc(m: { url?: string; path?: string } | null | undefined): string {
	if (!m) return ''
	const u = (m.url ?? '').trim()
	const p = (m.path ?? '').trim()
	if (u && /^https?:\/\//i.test(u)) return u
	if (p) return absolutePathToFileUrl(p)
	if (u && /^file:\/\//i.test(u)) {
		const abs = absolutePathFromFileUrl(u)
		return abs ? absolutePathToFileUrl(abs) : u
	}
	if (u) return u
	return ''
}

/** Avatar / arbitrary stored string: http(s), blob, data, or absolute path. */
export function storedImageSrc(stored: string | undefined): string {
	if (!stored?.trim()) return ''
	const s = stored.trim()
	if (/^https?:\/\//i.test(s) || s.startsWith('blob:') || s.startsWith('data:')) return s
	if (/^file:\/\//i.test(s)) {
		const abs = absolutePathFromFileUrl(s)
		return abs ? absolutePathToFileUrl(abs) : s
	}
	return absolutePathToFileUrl(s)
}

/** After collection delete: remove `media/<slug>-<id>/` if no remaining item still stores a path under that tree. */
export async function deleteCollectionMediaFolderIfOrphaned(
	collectionId: string,
	collectionName: string | undefined,
	remainingMediaPaths: readonly (string | undefined | null)[]
): Promise<void> {
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (!api?.deleteCollectionMediaFolder) return
	const paths = [...new Set(remainingMediaPaths.map((p) => String(p ?? '').trim()).filter(Boolean))]
	await api.deleteCollectionMediaFolder({
		collectionId,
		collectionName: collectionName ?? '',
		remainingMediaPaths: paths
	})
}

/** Disk rename for collection media root when the collection display name changes (Electron only). */
export async function renameCollectionMediaFolder(
	collectionId: string,
	oldCollectionName: string,
	newCollectionName: string
): Promise<
	{ ok: true; renames: readonly { from: string; to: string }[] } | { ok: false; error: string }
> {
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (!api?.renameCollectionMediaFolder) {
		return { ok: true, renames: [] }
	}
	const r = await api.renameCollectionMediaFolder({
		collectionId,
		oldCollectionName,
		newCollectionName
	})
	if (!r || !('ok' in r) || r.ok !== true) {
		const err = r && typeof r === 'object' && 'error' in r ? String((r as { error?: string }).error) : 'rename failed'
		return { ok: false, error: err }
	}
	const renames = Array.isArray(r.renames) ? r.renames : []
	return { ok: true, renames }
}

/** Ask main to unlink a file under managed `userData/media` (or legacy paths main allows) (ignored on web or if path is not allowed). */
export async function deleteMedia(absolutePath: string | undefined | null): Promise<void> {
	const p = absolutePath?.trim()
	if (!p) return
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (!api?.deleteImportedMedia) return
	await api.deleteImportedMedia({ absolutePath: p })
}

/** After replacing or clearing stored artwork, remove the previous flat-file copy when paths differ. */
export async function releaseMedia(
	prevPath: string | undefined | null,
	nextPath: string | undefined | null
): Promise<void> {
	const a = prevPath?.trim()
	const b = nextPath?.trim()
	if (!a || a === b) return
	await deleteMedia(a)
}

export async function saveImportedUserFile(
	file: File,
	store: ImportedMediaStoreScope
): Promise<
	{ ok: true; absolutePath: string } | { ok: false; reason: 'no-electron' | 'error'; message?: string }
> {
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (!api?.saveImportedMedia) return { ok: false, reason: 'no-electron' }
	const common = {
		mimeType: file.type || 'application/octet-stream',
		originalName: file.name,
		scope: store.scope,
		...(store.scope === 'collection'
			? { collectionId: store.collectionId, collectionName: store.collectionName }
			: {})
	}
	const nativePath =
		typeof api.getNativePathForFile === 'function' ? String(api.getNativePathForFile(file) ?? '').trim() : ''
	if (nativePath) {
		const r = await api.saveImportedMedia({ ...common, sourceAbsolutePath: nativePath })
		if (r.ok) return { ok: true, absolutePath: r.absolutePath }
		return { ok: false, reason: 'error', message: 'error' in r ? r.error : undefined }
	}
	const buffer = await file.arrayBuffer()
	const r = await api.saveImportedMedia({
		...common,
		buffer
	})
	if (r.ok) return { ok: true, absolutePath: r.absolutePath }
	return { ok: false, reason: 'error', message: 'error' in r ? r.error : undefined }
}

/** Persist `blob:` / `data:` when running in Electron; otherwise keep original URL. */
export async function persistVolatileImageHref(
	href: string,
	store: ImportedMediaStoreScope
): Promise<{ path: string } | { url: string }> {
	const api = typeof window !== 'undefined' ? window.electronAPI : undefined
	if (!api?.saveImportedMedia || (!href.startsWith('blob:') && !href.startsWith('data:'))) {
		return { url: href }
	}
	try {
		const res = await fetch(href)
		const blob = await res.blob()
		const buffer = await blob.arrayBuffer()
		const r = await api.saveImportedMedia({
			buffer,
			mimeType: blob.type || 'application/octet-stream',
			originalName: '',
			scope: store.scope,
			...(store.scope === 'collection'
				? { collectionId: store.collectionId, collectionName: store.collectionName }
				: {})
		})
		if (r.ok) return { path: r.absolutePath }
	} catch {
		/* keep blob */
	}
	return { url: href }
}
