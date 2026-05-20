import { use_mocks } from '$lib/env'
import { db } from '$lib/lib/DBManager'
import { nextIdxForAppend } from '$lib/lib/collections'
import { releaseMedia, saveImportedUserFile, type ImportedMediaStoreScope } from '$lib/lib/importedMedia'
import {
	DEFAULT_IMG_UPLOAD_CONSTRAINTS,
	extractTweetBodyForMetadata,
	isPortraitReelOrTikTokUrl,
	isTwitterStatusUrl,
	validateImgURL,
	twitterUserFromStatusUrl,
	type FetchedContentMetadata
} from '$lib/lib/fetch-content'
import { mockContentItems } from '$lib/mocks/library'
import type { LibraryItemInsert, LibraryItemRow } from '$shared/db/items.schema'

function inferKindFromMetadata(meta: FetchedContentMetadata): ContentKind {
	if (meta.kind === 'video' || meta.videoUrl) return 'video'
	if (meta.provider === 'youtube' || meta.provider === 'tiktok' || meta.provider === 'vimeo') {
		return 'video'
	}
	if (
		meta.provider === 'x' ||
		meta.provider === 'reddit' ||
		meta.provider === 'instagram' ||
		meta.provider === 'pinterest'
	) {
		return 'post'
	}
	return 'article'
}

function sourceFromMetadata(meta: FetchedContentMetadata): ContentSource {
	let host = ''
	try {
		host = new URL(meta.sourceUrl).hostname.replace(/^www\./, '')
	} catch {
		host = 'link'
	}
	if (meta.provider === 'x') {
		let screen = meta.author?.replace(/^@+/, '').trim()
		if (!screen || /\s/.test(screen)) {
			screen = twitterUserFromStatusUrl(meta.canonicalUrl ?? meta.sourceUrl) ?? ''
		}
		const label =
			screen && !/\s/.test(screen)
				? `@${screen}`
				: (meta.siteName?.trim() || host || 'X')
		return {
			id: 'x',
			name: label,
			shortName: label.length > 24 ? `${label.slice(0, 22)}…` : label,
			icon: '𝕏',
			url: meta.canonicalUrl ?? meta.sourceUrl
		}
	}
	if (meta.provider === 'pinterest') {
		const label = meta.siteName?.trim() || 'Pinterest'
		return {
			id: 'web',
			name: label,
			shortName: label.length > 24 ? `${label.slice(0, 22)}…` : label,
			icon: '📌',
			url: meta.canonicalUrl ?? meta.sourceUrl
		}
	}
	const name = meta.siteName?.trim() || host
	return {
		id: 'web',
		name,
		shortName: name.length > 24 ? `${name.slice(0, 22)}…` : name,
		icon: '🔗',
		url: meta.canonicalUrl ?? meta.sourceUrl
	}
}

function buildItemFromFetchedMeta(
	meta: FetchedContentMetadata,
	opts: {
		id: string
		idx: number
		collectionIds: string[]
		tags: string[]
		titleFallback?: string | null
	}
): ContentItem {
	const pageUrl = (meta.canonicalUrl ?? meta.sourceUrl).trim()
	const isXStatus = meta.provider === 'x' && isTwitterStatusUrl(pageUrl)
	const isPinterest = meta.provider === 'pinterest'

	let rawSnippet = (meta.subtitle ?? meta.description)?.trim()
	if (isXStatus) {
		rawSnippet =
			(meta.subtitle ?? meta.description)?.trim() ||
			extractTweetBodyForMetadata(meta)?.trim() ||
			rawSnippet
	}

	const snippet = rawSnippet || undefined
	const author = meta.author?.trim()
	const thumb = meta.imageUrl?.trim()
	const published = isPinterest ? '' : meta.publishedAt?.trim()
	const kind = inferKindFromMetadata(meta)
	const forcePortrait =
		meta.provider === 'tiktok' ||
		isPortraitReelOrTikTokUrl(meta.sourceUrl) ||
		(meta.canonicalUrl ? isPortraitReelOrTikTokUrl(meta.canonicalUrl) : false)
	const thumbDims = (
		forcePortrait ? 'portrait' : (meta.imageDims ?? (kind === 'video' ? 'video' : 'default'))
	) as ImageDimsType
	const media = thumb
		? {
				id: crypto.randomUUID(),
				type: 'image' as const,
				url: thumb,
				dims: thumbDims
			}
		: undefined
	const titleFromMeta = (meta.title ?? opts.titleFallback)?.trim()
	const titlePick = isXStatus || isPinterest ? '' : titleFromMeta || meta.sourceUrl.trim()
	return {
		id: opts.id,
		idx: opts.idx,
		kind,
		collectionIds: opts.collectionIds,
		source: sourceFromMetadata(meta),
		title: titlePick || undefined,
		snippet,
		media,
		author: author || undefined,
		meta: { notesCount: 0 },
		tags: opts.tags,
		createdAt: published ? published : undefined,
		url: pageUrl || undefined
	}
}

/** Stable key per card row (`library_item.source_url` UNIQUE). */
export function roostLibraryItemSourceUrl(id: string): string {
	return `roost://item/${id}`
}

export function normalizeStoredContentItem(raw: ContentItem): ContentItem {
	const tags = Array.isArray(raw.tags) ? [...raw.tags] : []
	const collectionIds = Array.isArray(raw.collectionIds) ? [...raw.collectionIds] : []
	let media = raw.media
	if (media != null && !media.id) {
		media = { ...media, id: crypto.randomUUID() }
	}
	return {
		...raw,
		meta: raw.meta ?? { notesCount: 0 },
		tags,
		collectionIds,
		media
	}
}

type StoredItemPayload = { v: 1; item: ContentItem }

export function contentItemToLibraryInsert(item: ContentItem): LibraryItemInsert {
	const normalized = normalizeStoredContentItem(item)
	const wrapped: StoredItemPayload = { v: 1, item: normalized }
	return {
		id: item.id,
		sourceUrl: roostLibraryItemSourceUrl(item.id),
		provider: 'roost',
		title: item.title ?? null,
		fetchedAt: Date.now(),
		payloadJson: JSON.stringify(wrapped)
	}
}

/** Parse `library_item.payload_json` → grid card (wrapped v1 or legacy fetch-metadata payload). */
export function contentItemFromLibraryRow(row: LibraryItemRow): ContentItem | null {
	let parsed: unknown
	try {
		parsed = JSON.parse(row.payloadJson)
	} catch {
		return null
	}
	if (
		parsed &&
		typeof parsed === 'object' &&
		(parsed as { v?: unknown }).v === 1 &&
		'item' in (parsed as object)
	) {
		const item = (parsed as StoredItemPayload).item
		if (item?.id === row.id) return normalizeStoredContentItem(item as ContentItem)
	}
	if (parsed && typeof parsed === 'object' && typeof (parsed as FetchedContentMetadata).sourceUrl === 'string') {
		return normalizeStoredContentItem(
			buildItemFromFetchedMeta(parsed as FetchedContentMetadata, {
				id: row.id,
				idx: 0,
				collectionIds: [],
				tags: [],
				titleFallback: row.title
			})
		)
	}
	return null
}

export async function persistLibraryItemToDb(item: ContentItem) {
	if (use_mocks || typeof window === 'undefined' || !db.isAvailable) return
	const row = contentItemToLibraryInsert(item)
	const existing = (await db.libraryItems.get(item.id)) as LibraryItemRow | undefined
	if (existing) {
		await db.libraryItems.update(item.id, {
			title: row.title,
			payloadJson: row.payloadJson,
			fetchedAt: row.fetchedAt
		})
	} else {
		await db.libraryItems.insert(row)
	}
}

export async function loadLibraryItemsFromDb() {
	if (use_mocks || !db.isAvailable) return
	const rows = (await db.libraryItems.list()) as LibraryItemRow[]
	libraryContent.items = rows
		.map(contentItemFromLibraryRow)
		.filter((x): x is ContentItem => x != null)
}

/** Session list for the library grid; ContentCard mutates `items` (e.g. delete). */
export const libraryContent = $state({
	items: (use_mocks
		? mockContentItems.map((i) => ({ ...i }))
		: []) as ContentItem[]
})

export function removeLibraryItem(id: string) {
	libraryContent.items = libraryContent.items.filter((item) => item.id !== id)
}

export function patchLibraryItem(id: string, patch: Partial<ContentItem>) {
	let merged: ContentItem | undefined
	let prevMedia: Media | undefined
	libraryContent.items = libraryContent.items.map((it) => {
		if (it.id !== id) return it
		prevMedia = it.media
		merged = { ...it, ...patch }
		return merged
	})
	if (!merged) return
	const releasePrevMedia =
		'media' in patch ? () => releaseMedia(prevMedia?.path, merged!.media?.path) : undefined
	void persistLibraryItemToDb(merged).then(async () => {
		await releasePrevMedia?.()
	})
}

/**
 * Append a card from URL metadata. When the toolbar is scoped to a tag (`filterTab !== 'all'`),
 * the new item gets that tag so it stays visible in the current view.
 */
export function addLibraryItemFromMetadata({ meta, collectionId, activeTagFilter }: { 
	meta: FetchedContentMetadata
	collectionId: string
	activeTagFilter: ContentToolbarFilter 
}) {
	const cid = collectionId.trim()
	const tag =
		activeTagFilter !== 'all' && String(activeTagFilter).trim()
			? String(activeTagFilter).trim()
			: null
	const idx = nextIdxForAppend(libraryContent.items, cid, activeTagFilter)
	const id = crypto.randomUUID()
	const tags = tag ? [tag] : []
	const item = buildItemFromFetchedMeta(meta, { id, idx, collectionIds: [cid], tags })
	libraryContent.items = [...libraryContent.items, item]
	void persistLibraryItemToDb(item)
	return item
}

/** Title-only row (LibSearch leading `"…"`); no URL, source, or snippet. */
/**
 * Remote image URL → bare card (image only): no title, snippet, source, or `createdAt`.
 * Validates like the card image URL float (`validateImgURL`).
 */
export async function addLibraryImageFromUrl(opts: {
	url: string
	collectionId: string
	activeTagFilter: ContentToolbarFilter
	signal?: AbortSignal
}): Promise<ContentItem> {
	const cid = opts.collectionId.trim()
	if (!cid) throw new Error('addLibraryImageFromUrl: collection id required')
	await validateImgURL({
		url: opts.url,
		constraints: DEFAULT_IMG_UPLOAD_CONSTRAINTS,
		signal: opts.signal
	})
	const tag =
		opts.activeTagFilter !== 'all' && String(opts.activeTagFilter).trim()
			? String(opts.activeTagFilter).trim()
			: null
	const idx = nextIdxForAppend(libraryContent.items, cid, opts.activeTagFilter)
	const id = crypto.randomUUID()
	const tags = tag ? [tag] : []
	const item: ContentItem = {
		id,
		idx,
		kind: 'article',
		collectionIds: [cid],
		tags,
		meta: { notesCount: 0 },
		media: {
			id: crypto.randomUUID(),
			type: 'image',
			url: opts.url,
			dims: 'auto'
		}
	}
	libraryContent.items = [...libraryContent.items, item]
	await persistLibraryItemToDb(item)
	return item
}

export function addLibraryTitleItem({
	title,
	collectionId,
	activeTagFilter
}: {
	title: string
	collectionId: string
	activeTagFilter: ContentToolbarFilter
}) {
	const cid = collectionId.trim()
	const tag =
		activeTagFilter !== 'all' && String(activeTagFilter).trim()
			? String(activeTagFilter).trim()
			: null
	const idx = nextIdxForAppend(libraryContent.items, cid, activeTagFilter)
	const id = crypto.randomUUID()
	const tags = tag ? [tag] : []
	const item: ContentItem = {
		id,
		idx,
		kind: 'article',
		collectionIds: [cid],
		title: title.trim(),
		meta: { notesCount: 0 },
		tags
	}
	libraryContent.items = [...libraryContent.items, item]
	void persistLibraryItemToDb(item)
	return item
}

/**
 * Local image or video import. Resolves when copy (if `file` + `mediaStore`) and DB persist finish.
 * Pass `file` + `mediaStore` to copy into app data here; or `localPath` / `fallbackBlobUrl` if already resolved.
 */
export async function addMediaItem({
	file,
	mediaStore,
	localPath,
	fallbackBlobUrl,
	fileName,
	mediaType,
	collectionId,
	activeTagFilter
}: {
	file?: File
	mediaStore?: ImportedMediaStoreScope
	localPath?: string
	fallbackBlobUrl?: string
	fileName?: string
	mediaType: 'image' | 'video'
	collectionId: string
	activeTagFilter: ContentToolbarFilter
}): Promise<ContentItem> {
	const cid = collectionId.trim()
	if (file && !mediaStore) {
		throw new Error('addMediaItem: `mediaStore` is required when `file` is set')
	}
	let resolvedPath = localPath?.trim()
	let resolvedBlob = fallbackBlobUrl
	const resolvedName = (fileName ?? file?.name ?? '').replace(/^\s+|\s+$/g, '')
	if (file && mediaStore) {
		const saved = await saveImportedUserFile(file, mediaStore)
		if (saved.ok) resolvedPath = saved.absolutePath.trim()
		else resolvedBlob = URL.createObjectURL(file)
	}
	const tag =
		activeTagFilter !== 'all' && String(activeTagFilter).trim()
			? String(activeTagFilter).trim()
			: null
	const idx = nextIdxForAppend(libraryContent.items, cid, activeTagFilter)
	const id = crypto.randomUUID()
	const tags = tag ? [tag] : []
	const strip =
		mediaType === 'video'
			? /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i
			: /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/i
	const base = resolvedName.replace(strip, '')
	const title = base || (mediaType === 'video' ? 'Video' : 'Image')
	const kind: ContentKind = mediaType === 'video' ? 'video' : 'article'
	const media: Media = resolvedPath
		? { id: crypto.randomUUID(), type: mediaType, path: resolvedPath, dims: 'auto' }
		: {
				id: crypto.randomUUID(),
				type: mediaType,
				url: resolvedBlob ?? '',
				dims: 'auto'
			}
	const item: ContentItem = {
		id,
		idx,
		kind,
		collectionIds: [cid],
		title,
		meta: { notesCount: 0 },
		tags,
		media
	}
	libraryContent.items = [...libraryContent.items, item]
	await persistLibraryItemToDb(item)
	return item
}

/** Reassign `idx` among `newOrder` using the multiset of idx from `sortedBefore` (same length). */
export function applyVisibleReorder(sortedBefore: ContentItem[], newOrder: ContentItem[]) {
	if (sortedBefore.length !== newOrder.length) return
	const idxSorted = sortedBefore
		.map((i) => i.idx)
		.slice()
		.sort((a, b) => a - b)
	const nextIdx = new Map(newOrder.map((item, i) => [item.id, idxSorted[i]]))
	libraryContent.items = libraryContent.items.map((item) => {
		const idx = nextIdx.get(item.id)
		if (idx === undefined) return item
		return { ...item, idx }
	})
	for (const item of newOrder) {
		const idx = nextIdx.get(item.id)
		if (idx === undefined) continue
		void persistLibraryItemToDb({ ...item, idx })
	}
}

function replacePathDirPrefix(absPath: string, fromDir: string, toDir: string): string {
	const f = fromDir.replace(/[/\\]+$/, '')
	if (absPath === f || absPath.startsWith(`${f}/`) || absPath.startsWith(`${f}\\`)) {
		return toDir + absPath.slice(f.length)
	}
	return absPath
}

/** Apply ordered `from`→`to` directory renames (e.g. after collection title change on disk). */
export function applyMediaDirRenamesToPath(
	absPath: string,
	renames: readonly { from: string; to: string }[]
): string {
	let out = absPath
	for (const { from, to } of renames) {
		out = replacePathDirPrefix(out, from, to)
	}
	return out
}

export function applyMediaDirRenamesToCollection(
	col: Collection,
	renames: readonly { from: string; to: string }[]
): Collection {
	const wp = col.wallpaper?.path?.trim()
	if (!wp || renames.length === 0) return col
	const next = applyMediaDirRenamesToPath(wp, renames)
	if (next === wp) return col
	return {
		...col,
		wallpaper: col.wallpaper ? { ...col.wallpaper, path: next } : null
	}
}

/** Update stored `media.path` for items under renamed dirs (no `releaseMedia` — files moved, not replaced). */
export async function rewriteLibraryItemPathsAfterMediaDirRename(
	renames: readonly { from: string; to: string }[]
): Promise<void> {
	if (renames.length === 0) return
	const prev = libraryContent.items
	const nextItems = prev.map((it) => {
		const p = it.media?.path?.trim()
		if (!p) return it
		const np = applyMediaDirRenamesToPath(p, renames)
		if (np === p) return it
		return {
			...it,
			media: it.media ? { ...it.media, path: np } : undefined
		}
	})
	if (nextItems.every((it, i) => it === prev[i])) return
	libraryContent.items = nextItems
	for (let i = 0; i < nextItems.length; i++) {
		if (nextItems[i] === prev[i]) continue
		await persistLibraryItemToDb(nextItems[i])
	}
}
