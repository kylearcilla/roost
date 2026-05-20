/**
 * App models → Drizzle insert/patch payloads for IPC.
 * DB shapes come from `$shared/db/*.schema` (single source of truth).
 */
import type { CollectionInsert, CollectionRow, FavoriteInsert } from '$shared/db/collections.schema'
import type { TagInsert, TagRow } from '$shared/db/tags.schema'
import type { UserInsert } from '$shared/db/settings.schema'
import type { MediaInsert, MediaRow } from '$shared/db/utils.schema'

import { COLOR_SWATCHES, coerceGridColumnSize } from './utils'

/** App `Media` → `media` table row (`type` → `kind`). */
export function mediaAppToDbInsert(m: Media): MediaInsert {
	return {
		id: m.id,
		kind: m.type,
		url: m.url ?? null,
		path: m.path ?? null,
		dims: m.dims
	}
}

export function mediaRowToMedia(row: MediaRow): Media {
	return {
		id: row.id,
		type: row.kind,
		url: row.url ?? undefined,
		path: row.path ?? undefined,
		dims: row.dims
	}
}

export function collectionRowToApp(row: CollectionRow, wallpaper: Media | undefined): Collection {
	return {
		id: row.id,
		idx: row.idx,
		name: row.name,
		headline: row.headline ?? undefined,
		emoji: row.emoji ?? undefined,
		subtitle: row.subtitle ?? undefined,
		columnSize: coerceGridColumnSize(row.columnSize),
		itemCount: row.itemCount ?? undefined,
		wallpaper,
		wallpaperFocusY: row.wallpaperFocusY ?? undefined,
		pinId: row.pinId ?? undefined,
		groupId: row.groupId ?? undefined
	}
}

export function tagRowToTag(row: TagRow): Tag {
	let color: Color
	try {
		color = JSON.parse(row.colorJson) as Color
		if (typeof color?.primary !== 'string') throw new Error('invalid color')
	} catch {
		color = { ...COLOR_SWATCHES[0] }
	}
	return {
		id: row.id,
		name: row.name,
		collectionId: row.collectionId,
		columnSize: coerceGridColumnSize(row.columnSize),
		idx: row.idx ?? undefined,
		description: row.description ?? undefined,
		color
	}
}

/**
 * Wallpaper without `id` must get a `media` row before the collection FK is set.
 * Returns the collection to persist (with assigned `wallpaper.id`) and an insert payload, or `mediaInsert: null`.
 */
export function resolveWallpaperForDb(collection: Collection): {
	collection: Collection
	mediaInsert: MediaInsert | null
} {
	const w = collection.wallpaper
	if (w == null) {
		return { collection, mediaInsert: null }
	}
	if (w.id) {
		return { collection, mediaInsert: null }
	}
	const id = crypto.randomUUID()
	const nextWallpaper: Media = { ...w, id }
	return {
		collection: { ...collection, wallpaper: nextWallpaper },
		mediaInsert: mediaAppToDbInsert(nextWallpaper)
	}
}

/** App `Collection` → DB insert/update payload (nested `wallpaper` → `wallpaperId` FK). */
export function collectionToDbRow(c: Collection): CollectionInsert {
	return {
		id: c.id,
		idx: c.idx,
		name: c.name,
		headline: c.headline ?? null,
		emoji: c.emoji ?? null,
		subtitle: c.subtitle ?? null,
		columnSize: c.columnSize ?? 'large',
		itemCount: c.itemCount ?? null,
		wallpaperId: c.wallpaper?.id ?? null,
		wallpaperFocusY: c.wallpaperFocusY ?? null,
		pinId: c.pinId ?? null,
		groupId: c.groupId ?? null
	}
}

/** App `Tag` → DB insert payload (`color` → JSON string). */
export function tagToDbInsert(t: Tag): TagInsert {
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
export function collectionPatchToDb(patch: Partial<Collection>): Partial<CollectionInsert> {
	const out: Partial<CollectionInsert> = {}
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
	if ('pinId' in patch) out.pinId = patch.pinId ?? null
	if ('groupId' in patch) out.groupId = patch.groupId ?? null
	return out
}

/** Partial app `Tag` → partial DB patch. */
export function tagPatchToDb(patch: Partial<Tag>): Partial<TagInsert> {
	const out: Partial<TagInsert> = {}
	if (patch.id !== undefined) out.id = patch.id
	if (patch.name !== undefined) out.name = patch.name
	if (patch.collectionId !== undefined) out.collectionId = patch.collectionId
	if (patch.columnSize !== undefined) out.columnSize = patch.columnSize
	if (patch.idx !== undefined) out.idx = patch.idx ?? 0
	if (patch.description !== undefined) out.description = patch.description ?? null
	if (patch.color !== undefined) out.colorJson = JSON.stringify(patch.color)
	return out
}

/** App `FavoriteFolder` → `favorite` row. */
export function favoriteToDbInsert(f: FavoriteFolder): FavoriteInsert {
	return {
		id: f.id,
		idx: f.idx,
		emoji: f.emoji,
		name: f.name,
		count: f.count,
		collectionId: f.collectionId ?? null
	}
}

/** Partial `FavoriteFolder` → partial DB patch. */
export function favoritePatchToDb(patch: Partial<FavoriteFolder>): Partial<FavoriteInsert> {
	const out: Partial<FavoriteInsert> = {}
	if (patch.id !== undefined) out.id = patch.id
	if (patch.idx !== undefined) out.idx = patch.idx
	if (patch.emoji !== undefined) out.emoji = patch.emoji
	if (patch.name !== undefined) out.name = patch.name
	if (patch.count !== undefined) out.count = patch.count
	if (patch.collectionId !== undefined) out.collectionId = patch.collectionId ?? null
	return out
}

/** App `User` → `user` row. */
export function userToDbInsert(u: User): UserInsert {
	return {
		id: u.id,
		displayName: u.displayName,
		avatarUrl: u.avatarUrl ?? null
	}
}

/** Partial `User` → partial DB patch. */
export function userPatchToDb(patch: Partial<User>): Partial<UserInsert> {
	const out: Partial<UserInsert> = {}
	if (patch.id !== undefined) out.id = patch.id
	if ('displayName' in patch) out.displayName = patch.displayName ?? ''
	/** `avatarUrl: undefined` must clear the column (`null`), not be skipped. */
	if ('avatarUrl' in patch) out.avatarUrl = patch.avatarUrl ?? null
	return out
}
