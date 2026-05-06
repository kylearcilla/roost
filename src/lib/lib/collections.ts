/**
 * Helpers for “which items belong to this collection / tag slice”.
 * Pass `libraryContent.items` (or any snapshot) — this module does not import `libraryContent` (avoids cycles).
 */

/** Items in `collectionId`; when `tagId` is set and not `'all'`, only rows whose `tags` include that `Tag.id`. */
export function findItems(
	items: ContentItem[],
	collectionId: string,
	tagId?: ContentToolbarFilter
): ContentItem[] {
	const cid = collectionId.trim()
	const inCol = items.filter((it) => it.collectionIds.includes(cid))
	if (!tagId || tagId === 'all') return inCol
	const tid = String(tagId).trim()
	if (!tid) return inCol
	return inCol.filter((it) => it.tags.includes(tid))
}

/** `idx` one past the last item in that slice (for appending at the end of the sorted list). */
export function nextIdxForAppend(
	items: ContentItem[],
	collectionId: string,
	tagId?: ContentToolbarFilter
): number {
	const list = findItems(items, collectionId.trim(), tagId)
	if (!list.length) return 0
	return Math.max(...list.map((it) => it.idx)) + 1
}
