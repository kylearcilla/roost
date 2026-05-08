import { use_mocks } from '$lib/env'
import { SEED_TAGS } from '$lib/mocks/tags'

function cloneColor(c: Color): Color {
	return { ...c }
}

function cloneTag(t: Tag): Tag {
	return { ...t, color: cloneColor(t.color) }
}

const seedById = Object.fromEntries(SEED_TAGS.map((t) => [t.id, cloneTag(t)])) as Record<
	string,
	Tag
>

export const libraryTags = $state<{ byId: Record<string, Tag> }>({
	byId: use_mocks ? { ...seedById } : {}
})

export function upsertLibraryTag(tag: Tag) {
	libraryTags.byId = { ...libraryTags.byId, [tag.id]: cloneTag(tag) }
}

export function patchLibraryTag(
	id: string,
	patch: Partial<Pick<Tag, 'name' | 'color' | 'description' | 'idx' | 'columnSize'>>
) {
	const cur = libraryTags.byId[id]
	if (!cur) return
	const next: Tag = {
		...cur,
		...patch,
		color: patch.color !== undefined ? cloneColor(patch.color) : cloneColor(cur.color)
	}
	libraryTags.byId = { ...libraryTags.byId, [id]: next }
}

export function deleteLibraryTag(id: string) {
	const { [id]: _removed, ...rest } = libraryTags.byId
	libraryTags.byId = rest
}

/** Drop every tag row for `collectionId` from in-memory map (use when a collection is removed). */
export function pruneLibraryTagsForCollection(collectionId: string) {
	const cid = collectionId.trim()
	if (!cid) return
	libraryTags.byId = Object.fromEntries(
		Object.entries(libraryTags.byId).filter(([, t]) => t.collectionId !== cid)
	)
}
