import { nextIdxForAppend } from '$lib/lib/collections'
import { isPortraitReelOrTikTokUrl, type FetchedContentMetadata } from '$lib/lib/fetch-content'
import { mockContentItems } from '$lib/mocks/library'

function inferKindFromMetadata(meta: FetchedContentMetadata): ContentKind {
	if (meta.kind === 'video' || meta.videoUrl) return 'video'
	if (meta.provider === 'youtube' || meta.provider === 'tiktok' || meta.provider === 'vimeo') {
		return 'video'
	}
	if (meta.provider === 'x' || meta.provider === 'reddit' || meta.provider === 'instagram') {
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
	const name = meta.siteName?.trim() || host
	return {
		id: 'web',
		name,
		shortName: name.length > 24 ? `${name.slice(0, 22)}…` : name,
		icon: '🔗',
		url: meta.canonicalUrl ?? meta.sourceUrl
	}
}

/** Session list for the library grid; ContentCard mutates `items` (e.g. delete). */
export const libraryContent = $state({
	items: mockContentItems.map((i) => ({ ...i })) as ContentItem[]
})

export function removeLibraryItem(id: string) {
	libraryContent.items = libraryContent.items.filter((item) => item.id !== id)
}

export function patchLibraryItem(id: string, patch: Partial<ContentItem>) {
	libraryContent.items = libraryContent.items.map((it) =>
		it.id === id ? { ...it, ...patch } : it
	)
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
	const rawSnippet = (meta.subtitle ?? meta.description)?.trim()
	const snippet = rawSnippet || undefined
	const author = meta.author?.trim()
	const thumb = meta.imageUrl?.trim()
	const pageUrl = (meta.canonicalUrl ?? meta.sourceUrl).trim()
	const published = meta.publishedAt?.trim()
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
				type: 'image' as const,
				url: thumb,
				dims: thumbDims
			}
		: undefined
	const item: ContentItem = {
		id,
		idx,
		kind,
		collectionIds: [cid],
		source: sourceFromMetadata(meta),
		title: (meta.title ?? meta.sourceUrl).trim() || meta.sourceUrl.trim(),
		snippet,
		media,
		author: author || undefined,
		meta: { notesCount: 0 },
		tags,
		createdAt: published || undefined,
		url: pageUrl || undefined
	}
	libraryContent.items = [...libraryContent.items, item]
	return item
}

/** Title-only row (LibSearch leading `"…"`); no URL, source, or snippet. */
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
	return item
}

/** Local image or video from drag-and-drop (`blob:` URL); `dims: 'auto'`. */
export function addLibraryDroppedMediaItem({
	blobUrl,
	fileName,
	mediaType,
	collectionId,
	activeTagFilter
}: {
	blobUrl: string
	fileName?: string
	mediaType: 'image' | 'video'
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
	const strip =
		mediaType === 'video'
			? /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i
			: /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/i
	const base = (fileName ?? '').replace(/^\s+|\s+$/g, '').replace(strip, '')
	const title = base || (mediaType === 'video' ? 'Video' : 'Image')
	const kind: ContentKind = mediaType === 'video' ? 'video' : 'article'
	const item: ContentItem = {
		id,
		idx,
		kind,
		collectionIds: [cid],
		title,
		meta: { notesCount: 0 },
		tags,
		media: { type: mediaType, url: blobUrl, dims: 'auto' }
	}
	libraryContent.items = [...libraryContent.items, item]
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
}
