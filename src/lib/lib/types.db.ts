/**
 * SQLite row payloads sent over `dbInvoke` (main `collection` / `tag` tables).
 * Property names match Drizzle schema JS keys; SQL columns are snake_case in schema defs.
 * @see electron/db/collections/collections.schema.ts
 * @see electron/db/tags/tags.schema.ts
 */

/** `collection.column_size` — same values as app `GridColumnSize`. */
export type CollectionColumnSizeDb = 'small' | 'medium' | 'large' | 'xlarge'

/** Full row for insert / full replace update of `collection`. */
export type CollectionDbInsert = {
	id: string
	idx: number
	name: string
	headline: string | null
	emoji: string | null
	subtitle: string | null
	columnSize: CollectionColumnSizeDb
	itemCount: number | null
	wallpaperId: string | null
	wallpaperFocusY: number | null
}

/** Full row for insert of `tag` (`color_json` is serialized app `Color`). */
export type TagDbInsert = {
	id: string
	name: string
	collectionId: string
	columnSize: CollectionColumnSizeDb
	idx: number
	description: string | null
	colorJson: string
}

/** App `Collection` → DB insert/update payload (nested `wallpaper` → `wallpaperId` FK). */
export function collectionToDbRow(c: Collection): CollectionDbInsert {
	return {
		id: c.id,
		idx: c.idx,
		name: c.name,
		headline: c.headline ?? null,
		emoji: c.emoji ?? null,
		subtitle: c.subtitle ?? null,
		columnSize: c.columnSize,
		itemCount: c.itemCount ?? null,
		wallpaperId: c.wallpaper?.id ?? null,
		wallpaperFocusY: c.wallpaperFocusY ?? null
	}
}

/** App `Tag` → DB insert payload (`color` → JSON string). */
export function tagToDbInsert(t: Tag): TagDbInsert {
	return {
		id: t.id,
		name: t.name,
		collectionId: t.collectionId,
		columnSize: t.columnSize,
		idx: t.idx ?? 0,
		description: t.description ?? null,
		colorJson: JSON.stringify(t.color)
	}
}

/** Partial app `Collection` → partial DB patch (only keys you set are sent). */
export function collectionPatchToDb(patch: Partial<Collection>): Partial<CollectionDbInsert> {
	const out: Partial<CollectionDbInsert> = {}
	if (patch.id !== undefined) out.id = patch.id
	if (patch.idx !== undefined) out.idx = patch.idx
	if (patch.name !== undefined) out.name = patch.name
	if (patch.headline !== undefined) out.headline = patch.headline ?? null
	if (patch.emoji !== undefined) out.emoji = patch.emoji ?? null
	if (patch.subtitle !== undefined) out.subtitle = patch.subtitle ?? null
	if (patch.columnSize !== undefined) out.columnSize = patch.columnSize
	if (patch.itemCount !== undefined) out.itemCount = patch.itemCount ?? null
	if (patch.wallpaper !== undefined) out.wallpaperId = patch.wallpaper?.id ?? null
	if (patch.wallpaperFocusY !== undefined) out.wallpaperFocusY = patch.wallpaperFocusY ?? null
	return out
}

/** Partial app `Tag` → partial DB patch. */
export function tagPatchToDb(patch: Partial<Tag>): Partial<TagDbInsert> {
	const out: Partial<TagDbInsert> = {}
	if (patch.id !== undefined) out.id = patch.id
	if (patch.name !== undefined) out.name = patch.name
	if (patch.collectionId !== undefined) out.collectionId = patch.collectionId
	if (patch.columnSize !== undefined) out.columnSize = patch.columnSize
	if (patch.idx !== undefined) out.idx = patch.idx ?? 0
	if (patch.description !== undefined) out.description = patch.description ?? null
	if (patch.color !== undefined) out.colorJson = JSON.stringify(patch.color)
	return out
}
