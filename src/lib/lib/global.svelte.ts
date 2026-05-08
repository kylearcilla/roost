import { use_mocks } from '$lib/env'
import { findItems } from '$lib/lib/collections'
import { db } from '$lib/lib/DBManager'
import type { CollectionRow } from '$shared/db/collections.schema'
import type { TagRow as TagTableRow } from '$shared/db/tags.schema'
import type { MediaRow } from '$shared/db/utils.schema'
import {
	collectionRowToApp,
	mediaRowToMedia,
	resolveWallpaperForDb,
	tagRowToTag
} from '$lib/lib/types.db'
import {
	applyMediaDirRenamesToCollection,
	libraryContent,
	loadLibraryItemsFromDb,
	patchLibraryItem,
	rewriteLibraryItemPathsAfterMediaDirRename
} from '$lib/libraryContent.svelte'
import {
	deleteLibraryTag,
	libraryTags,
	patchLibraryTag,
	pruneLibraryTagsForCollection,
	upsertLibraryTag
} from '$lib/libraryTags.svelte'
import { mockCollections, mockFavorites, mockUser } from '$lib/mocks'
import {
	deleteCollectionMediaFolderIfOrphaned,
	deleteMedia,
	releaseMedia,
	renameCollectionMediaFolder
} from '$lib/lib/importedMedia'
import { insertItemArr, removeItemArr, reorderItemArr } from '$lib/lib/utils'

type TagRow = Tag & { idx: number }

type UserRowDb = { id: string; displayName: string; avatarUrl: string | null }

export class Global {
	user = $state<User | null>(use_mocks ? { ...mockUser } : null)
	onHomePage = $state(!use_mocks)

	collections = $state<Collection[]>(
		use_mocks ? mockCollections.map((c) => ({ ...c })) : []
	)
	selectedCollectionId = $state(use_mocks ? 'advice' : '')
	currFilterTab = $state<ContentToolbarFilter>('all')
	currTags = $state<Tag[]>([])
	favorites = $state<FavoriteFolder[]>(
		use_mocks ? mockFavorites.map((f) => ({ ...f })) : []
	)

	setOnHomePage(value: boolean) {
		this.onHomePage = value
		if (value) {
			this.selectedCollectionId = ''
			this.syncTagsFromLibrary()
		}
	}
	/** `id` is a tag id or a collection id (`all` view uses the collection id, not `'all'`). */
	async setColSize(id: string, size: GridColumnSize) {
		const tag = libraryTags.byId[id]
		if (tag) {
			if (tag.columnSize === size) return
			if (use_mocks) {
				patchLibraryTag(id, { columnSize: size })
				return
			}
			if (!db.isAvailable) {
				throw new Error('setColSize: live mode enabled but DB is not available')
			}
			await db.tags.patch(id, { columnSize: size })
			patchLibraryTag(id, { columnSize: size })
			return
		}
		const i = this.collections.findIndex((c) => c.id === id)
		if (i === -1) return
		const c = this.collections[i]
		if (!c || c.columnSize === size) return
		const next = [...this.collections]
		next[i] = { ...c, columnSize: size }
		if (use_mocks) {
			this.collections = next
			return
		}
		if (!db.isAvailable) {
			throw new Error('setColSize: live mode enabled but DB is not available')
		}
		await db.collections.patch(id, { columnSize: size })
		this.collections = next
	}

	/* user */

	private rowToUser(row: UserRowDb): User {
		return {
			id: row.id,
			displayName: row.displayName,
			avatarUrl: row.avatarUrl ?? undefined
		}
	}

	/** Load the first `user` row or insert a new local profile. */
	private async loadOrCreateUserFromDb(): Promise<User> {
		const rows = (await db.users.list()) as UserRowDb[]
		if (rows.length > 0) {
			return this.rowToUser(rows[0])
		}
		const id = crypto.randomUUID()
		const created: User = { id, displayName: 'You', avatarUrl: undefined }
		await db.users.insert(created)
		return created
	}

	async fetchUser(): Promise<User> {
		if (use_mocks) {
			if (!this.user) this.user = { ...mockUser }
			return this.user
		}
		if (!db.isAvailable) {
			throw new Error('fetchUser: live mode enabled but DB is not available')
		}
		const u = await this.loadOrCreateUserFromDb()
		this.user = u
		return u
	}

	async updateUser(patch: Partial<User>) {
		const prevAvatarPath = this.user?.avatarUrl?.trim()
		if (use_mocks) {
			const base = this.user ?? { ...mockUser }
			this.user = { ...base, ...patch }
			if ('avatarUrl' in patch) {
				await releaseMedia(prevAvatarPath, patch.avatarUrl?.trim())
			}
			return
		}
		if (!db.isAvailable) {
			throw new Error('updateUser: live mode enabled but DB is not available')
		}
		if (!this.user) {
			await this.fetchUser()
		}
		const id = this.user!.id
		await db.users.update(id, patch)
		this.user = { ...this.user!, ...patch }
		if ('avatarUrl' in patch) {
			await releaseMedia(prevAvatarPath, patch.avatarUrl?.trim())
		}
	}

	/* ⛳️ collections */

	currCollection = $derived(
		this.collections.find((c) => c.id === this.selectedCollectionId) ?? null
	)

	async fetchCollections() {
		if (use_mocks) {
			const fromMocks = mockCollections.map((c) => ({ ...c }))
			this.collections = fromMocks
			this.selectedCollectionId = fromMocks[0]?.id ?? ''
			this.onHomePage = !this.selectedCollectionId
			this.syncTagsFromLibrary()
			return this.collections
		}
		if (!db.isAvailable) {
			throw new Error('fetchCollections: live mode enabled but DB is not available')
		}

		const rows = (await db.collections.list()) as CollectionRow[]
		const mediaRows = (await db.media.list()) as MediaRow[]
		const mediaById = new Map(mediaRows.map((m) => [m.id, mediaRowToMedia(m)]))
		const sorted = [...rows]
			.map((row) => {
				const w = row.wallpaperId ? mediaById.get(row.wallpaperId) : undefined
				return collectionRowToApp(row, w)
			})
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
		this.collections = sorted
		const active = sorted.find((c) => c.id === this.selectedCollectionId)?.id ?? sorted[0]?.id ?? ''
		this.selectedCollectionId = active
		this.onHomePage = !active
		this.syncTagsFromLibrary()
		return this.collections
	}

	/** Load collections, tags, favorites, and grid items from SQLite (Electron live mode). */
	async hydrateFromDb() {
		if (use_mocks || !db.isAvailable) return
		await this.fetchCollections()
		const tagRows = (await db.tags.listAll()) as TagTableRow[]
		const nextById: Record<string, Tag> = {}
		for (const row of tagRows) {
			const t = tagRowToTag(row)
			nextById[t.id] = t
		}
		libraryTags.byId = nextById
		this.favorites = (await db.favorites.list()) as FavoriteFolder[]
		await loadLibraryItemsFromDb()
		this.syncTagsFromLibrary()
	}

	setCollection(collectionId: string) {
		if (!this.collections.some((c) => c.id === collectionId)) return
		this.onHomePage = false
		this.selectedCollectionId = collectionId
		this.syncTagsFromLibrary()
	}

	async addCollection(collection: Collection) {
		const { collection: col, mediaInsert } = resolveWallpaperForDb({
			...collection,
			columnSize: collection.columnSize ?? 'large'
		})
		if (use_mocks) {
			this.collections = [...this.collections, col]
			return
		}
		if (!db.isAvailable) {
			throw new Error('addCollection: live mode enabled but DB is not available')
		}
		if (mediaInsert) {
			await db.media.insert(mediaInsert)
		}
		await db.collections.insert(col)
		this.collections = [...this.collections, col]
	}

	async updateCollection(collection: Collection) {
		const prevRow = this.collections.find((c) => c.id === collection.id)
		const prevWpPath = prevRow?.wallpaper?.path?.trim()
		const prevName = prevRow?.name ?? ''
		let col = collection
		const nameChanged = Boolean(prevRow && col.name !== prevName)
		let didDiskRenames = false

		if (nameChanged && !use_mocks && db.isAvailable) {
			const rr = await renameCollectionMediaFolder(col.id, prevName, col.name)
			if (!rr.ok) throw new Error(rr.error)
			if (rr.renames.length > 0) {
				didDiskRenames = true
				col = applyMediaDirRenamesToCollection(col, rr.renames)
				await rewriteLibraryItemPathsAfterMediaDirRename(rr.renames)
			}
		}

		const { collection: colResolved, mediaInsert } = resolveWallpaperForDb(col)
		const nextWpPath = colResolved.wallpaper?.path?.trim()
		if (use_mocks) {
			this.collections = this.collections.map((c) => (c.id === colResolved.id ? colResolved : c))
			await releaseMedia(prevWpPath, nextWpPath)
			return
		}
		if (!db.isAvailable) {
			throw new Error('updateCollection: live mode enabled but DB is not available')
		}
		if (mediaInsert) {
			await db.media.insert(mediaInsert)
		}
		await db.collections.update(colResolved.id, colResolved)
		if (didDiskRenames && colResolved.wallpaper?.id) {
			await db.media.update(colResolved.wallpaper.id, {
				path: colResolved.wallpaper.path ?? null,
				url: colResolved.wallpaper.url ?? null
			})
		}
		this.collections = this.collections.map((c) => (c.id === colResolved.id ? colResolved : c))
		await releaseMedia(prevWpPath, nextWpPath)
	}

	async deleteCollection(collectionId: string) {
		const victim = this.collections.find((c) => c.id === collectionId)
		if (!victim) return
		const victimWpPath = victim.wallpaper?.path?.trim()
		const victimWallpaperBlob =
			victim.wallpaper?.url?.trim()?.startsWith('blob:') ? victim.wallpaper.url.trim() : undefined
		const favIds = this.favorites.filter((f) => f.collectionId === collectionId).map((f) => f.id)
		for (const fid of favIds) {
			await this.removeFav(fid)
		}
		const sorted = [...this.collections]
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((c) => ({ ...c }))
		const { newArray, updated } = removeItemArr({ array: sorted, idx: victim.idx ?? 0 })
		const pickSelection = () => {
			if (newArray.length === 0) {
				this.setOnHomePage(true)
				return
			}
			if (this.selectedCollectionId !== collectionId) return
			const first = newArray[0]?.id
			if (first) this.setCollection(first)
		}
		await this.cascadeLibraryContentAfterCollectionRemoved(collectionId)
		await deleteCollectionMediaFolderIfOrphaned(
			collectionId,
			victim.name,
			libraryContent.items.map((it) => it.media?.path)
		)
		const wallpaperMediaId = victim.wallpaper?.id
		if (use_mocks) {
			this.collections = newArray
			await releaseMedia(victimWpPath, undefined)
			if (victimWallpaperBlob) URL.revokeObjectURL(victimWallpaperBlob)
			pickSelection()
			return
		}
		if (!db.isAvailable) {
			throw new Error('deleteCollection: live mode enabled but DB is not available')
		}
		await db.collections.delete(collectionId)
		if (wallpaperMediaId) {
			await db.media.delete(wallpaperMediaId)
		}
		await this.persistCollectionIdxDiff(updated)
		this.collections = newArray
		await releaseMedia(victimWpPath, undefined)
		if (victimWallpaperBlob) URL.revokeObjectURL(victimWallpaperBlob)
		pickSelection()
	}

	/**
	 * Items that only lived in `collectionId` are removed (DB + disk media).
	 * Items in multiple collections lose that id + any tags belonging to the removed collection.
	 * Toolbar tag rows for that collection are dropped from memory; `library_item_order` scopes cleared (live DB).
	 */
	private async cascadeLibraryContentAfterCollectionRemoved(collectionId: string) {
		const cid = collectionId.trim()
		if (!cid) return
		const tagIds = Object.values(libraryTags.byId)
			.filter((t) => t.collectionId === cid)
			.map((t) => t.id)
		const tagIdSet = new Set(tagIds)
		const exclusiveIds = libraryContent.items
			.filter((it) => it.collectionIds.includes(cid) && it.collectionIds.length === 1)
			.map((it) => it.id)
		for (const id of exclusiveIds) {
			await this.onDeleteItem(id)
		}
		const rest = [...libraryContent.items]
		for (const item of rest) {
			if (!item.collectionIds.includes(cid)) continue
			patchLibraryItem(item.id, {
				collectionIds: item.collectionIds.filter((c) => c !== cid),
				tags: item.tags.filter((t) => !tagIdSet.has(t))
			})
		}
		if (!use_mocks && db.isAvailable) {
			await db.libraryItems.deleteOrderScopesForCollection(cid, tagIds)
		}
		pruneLibraryTagsForCollection(cid)
	}

	/** Drag reorder: uses `reorderItemArr` on collection `idx` slots, then dense-renumbers + persists. */
	async reorderCollections(srcIx: number, targetIx: number) {
		if (srcIx === targetIx) return
		const arr = [...this.collections]
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((c) => ({ ...c }))
		const { newArray } = reorderItemArr({
			array: arr,
			srcIdx: arr[srcIx].idx,
			targetIdx: arr[targetIx].idx
		})
		const ordered = [...newArray].sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
		await this.applyCollectionsOrder(ordered)
	}

	/** Sidebar: final list order → dense `idx` + patch only rows whose `idx` changed + `collection_order`. */
	async applyCollectionsOrder(ordered: Collection[]) {
		const next = ordered.map((c, i) => ({ ...c, idx: i }))
		if (use_mocks) {
			this.collections = next
			return
		}
		if (!db.isAvailable) {
			throw new Error('applyCollectionsOrder: live mode enabled but DB is not available')
		}
		await this.persistCollectionIdxDiff(this.idxDiff(this.collections, next))
		this.collections = next
	}

	collectionIndexList(): readonly { id: string; idx: number }[] {
		return [...this.collections]
			.map((c) => ({ id: c.id, idx: c.idx ?? 0 }))
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
	}

	private idxDiff<T extends { id: string; idx: number }>(prev: T[], next: T[]): ReorderItemPayload {
		const map = new Map(prev.map((x) => [x.id, x.idx ?? 0]))
		const out: ReorderItemPayload = []
		for (const x of next) {
			const ix = x.idx ?? 0
			if (map.get(x.id) !== ix) out.push({ id: x.id, idx: ix })
		}
		return out
	}

	private async persistCollectionIdxDiff(updated: ReorderItemPayload) {
		if (updated.length === 0) return
		await db.collections.updateIndices(updated)
	}

	/* ⛳️ items */

	async fetchItems() {
		if (use_mocks) {
			return libraryContent.items
		}
		if (!db.isAvailable) {
			throw new Error('fetchItems: live mode enabled but DB is not available')
		}
		await loadLibraryItemsFromDb()
		return libraryContent.items
	}

	/** Ordered `{ id, idx }` for that slice; shallow copy. */
	itemIndexList(collectionId: string, filter: ContentToolbarFilter): readonly { id: string; idx: number }[] {
		return findItems(libraryContent.items, collectionId, filter)
			.slice()
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
			.map((i) => ({ id: i.id, idx: i.idx }))
	}

	getItemIdx(collectionId: string, filter: ContentToolbarFilter, itemId: string) {
		const row = findItems(libraryContent.items, collectionId, filter).find((i) => i.id === itemId)
		const live = libraryContent.items.find((i) => i.id === itemId)
		return row?.idx ?? live?.idx ?? 0
	}

	/**
	 * Remove item from collection including every tag it belongs in.
	 * Performs reordering of items in the collection and tags.
	 * 
	 * @param id - The ID of the item to remove.
	 */
	async onDeleteItem(id: string) {
		const removed = libraryContent.items.find((i) => i.id === id)
		if (!removed) return
		const m = removed.media
		const orphanMediaPath = m?.path?.trim()
		const orphanBlobUrl = m?.url?.trim()?.startsWith('blob:') ? m.url.trim() : undefined
		const disposeCardMedia = async () => {
			if (orphanMediaPath) await deleteMedia(orphanMediaPath)
			if (orphanBlobUrl) URL.revokeObjectURL(orphanBlobUrl)
		}
		if (use_mocks) {
			libraryContent.items = libraryContent.items.filter((i) => i.id !== id)
			for (const scope of this.itemScopesForContentItem(removed)) {
				this.compactItemSliceOrder(scope.collectionId, scope.filter)
			}
			await disposeCardMedia()
			return
		}
		if (!db.isAvailable) {
			throw new Error('onDeleteItem: live mode enabled but DB is not available')
		}
		await db.libraryItems.delete(id)
		libraryContent.items = libraryContent.items.filter((i) => i.id !== id)
		await disposeCardMedia()
		for (const scope of this.itemScopesForContentItem(removed)) {
			this.compactItemSliceOrder(scope.collectionId, scope.filter)
		}
	}

	/** Renumber `idx` in one slice to `0..n-1` (sort by current idx, then id). */
	enforceItemOrder(collectionId: string, filter: ContentToolbarFilter) {
		this.compactItemSliceOrder(collectionId, filter)
	}

	private compactItemSliceOrder(collectionId: string, filter: ContentToolbarFilter) {
		const slice = findItems(libraryContent.items, collectionId, filter)
			.slice()
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
		for (let i = 0; i < slice.length; i++) {
			const it = slice[i]
			if (it.idx !== i) patchLibraryItem(it.id, { idx: i })
		}
	}

	private itemScopesForContentItem(item: ContentItem): { collectionId: string; filter: ContentToolbarFilter }[] {
		const out: { collectionId: string; filter: ContentToolbarFilter }[] = []
		for (const cid of item.collectionIds) {
			out.push({ collectionId: cid, filter: 'all' })
			for (const tid of item.tags) {
				out.push({ collectionId: cid, filter: tid })
			}
		}
		return out
	}

	/* ⛳️ favorites */

	async fetchFavorites() {
		if (use_mocks) {
			return this.favorites
		}
		if (!db.isAvailable) {
			throw new Error('fetchFavorites: live mode enabled but DB is not available')
		}
		return (await db.favorites.list()) as FavoriteFolder[]
	}

	/** Ordered `{ id, idx }` for sidebar favorites; shallow copy. */
	favoriteIndexList(): readonly { id: string; idx: number }[] {
		return [...this.favorites]
			.map((f) => ({ id: f.id, idx: f.idx ?? 0 }))
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
	}

	getFavoriteIdx(favoriteId: string) {
		const live = this.favorites.find((f) => f.id === favoriteId)
		return live?.idx ?? 0
	}

	async addFavoriteFromCollection(col: Collection) {
		if (this.favorites.some((f) => f.collectionId === col.id)) return
		const idx = this.favorites.length
		const row: FavoriteFolder = {
			id: `fav-${col.id}`,
			idx,
			emoji: col.emoji ?? '📌',
			name: col.name,
			count: col.itemCount ?? 0,
			collectionId: col.id
		}
		if (use_mocks) {
			this.favorites = [...this.favorites, row]
			return
		}
		if (!db.isAvailable) {
			throw new Error('addFavoriteFromCollection: live mode enabled but DB is not available')
		}
		await db.favorites.insert(row)
		this.favorites = [...this.favorites, row]
	}

	async removeFav(favoriteId: string) {
		const victim = this.favorites.find((f) => f.id === favoriteId)
		if (!victim) return
		const sorted = [...this.favorites]
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((f) => ({ ...f }))
		const { newArray, updated } = removeItemArr({ array: sorted, idx: victim.idx ?? 0 })
		if (use_mocks) {
			this.favorites = newArray
			return
		}
		if (!db.isAvailable) {
			throw new Error('removeFav: live mode enabled but DB is not available')
		}
		await db.favorites.delete(favoriteId)
		await Promise.all(updated.map((u) => db.favorites.update(u.id, { idx: u.idx })))
		this.favorites = newArray
	}

	async reorderFavs(srcIx: number, targetIx: number) {
		if (srcIx === targetIx) return
		const arr = [...this.favorites]
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((f) => ({ ...f }))
		const { newArray } = reorderItemArr({
			array: arr,
			srcIdx: arr[srcIx].idx,
			targetIdx: arr[targetIx].idx
		})
		const ordered = [...newArray].sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
		await this.applyFavoritesOrder(ordered)
	}

	async applyFavoritesOrder(ordered: FavoriteFolder[]) {
		const next = ordered.map((f, i) => ({ ...f, idx: i }))
		if (use_mocks) {
			this.favorites = next
			return
		}
		if (!db.isAvailable) {
			throw new Error('applyFavoritesOrder: live mode enabled but DB is not available')
		}
		await Promise.all(
			this.idxDiff(this.favorites, next).map((u) => db.favorites.update(u.id, { idx: u.idx }))
		)
		this.favorites = next
	}

	/* ⛳️ tags */

	async fetchTags() {
		if (use_mocks) {
			return this.currTags
		}
		if (!db.isAvailable) {
			throw new Error('fetchTags: live mode enabled but DB is not available')
		}
		return (await db.tags.list(this.selectedCollectionId)) as Tag[]
	}
	getCurrTags(): Tag[] {
		return this.currTags
	}
	deleteTag(tagId: string) {
		this.currTags = this.currTags.filter((t) => t.id !== tagId)
	}
	addTag(tag: Tag) {
		this.currTags = [...this.currTags, tag]
	}
	updateTag(tag: Tag) {
		this.currTags = this.currTags.map((t) => (t.id === tag.id ? tag : t))
	}

	/** Ordered `{ id, idx }` for `collectionId` (toolbar slots). */
	tagIndexList(collectionId: string): readonly { id: string; idx: number }[] {
		return Object.values(libraryTags.byId)
			.filter((t) => t.collectionId === collectionId)
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((t) => ({ id: t.id, idx: t.idx ?? 0 }))
	}

	getTagIdx(_cId: string, tId: string) {
		return libraryTags.byId[tId]?.idx ?? 0
	}

	/* ⛳️ tags ordering */

	private applyIdxPatches(updated: ReorderItemPayload) {
		for (const u of updated) {
			patchLibraryTag(u.id, { idx: u.idx })
		}
	}

	/** Shallow tag rows for one collection, sorted by `idx`, for reorder/remove utils (mutates copies only). */
	private collectionTagClonesForReorder(collectionId: string): TagRow[] {
		return Object.values(libraryTags.byId)
			.filter((t) => t.collectionId === collectionId)
			.map(
				(t): TagRow => ({
					...t,
					color: { ...t.color },
					idx: t.idx ?? 0
				})
			)
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
	}

	/**
	 * Reorder toolbar tags for `collectionId` using `reorderItemArr` (`srcIdx` / `targetIdx` are tag `idx` slots).
	 * Updates `libraryTags`, indices map, and `currTags` when that collection is active.
	 */
	async reorderTagsInCollection(collectionId: string, srcIdx: number, targetIdx: number) {
		const arr = this.collectionTagClonesForReorder(collectionId)
		const { newArray, updated } = reorderItemArr({ array: arr, srcIdx, targetIdx })
		this.applyIdxPatches(updated)
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('reorderTagsInCollection: live mode enabled but DB is not available')
			}
			if (updated.length > 0) await db.tags.updateIndices(collectionId, updated)
		}
		if (this.selectedCollectionId === collectionId) this.syncTagsFromLibrary()
	}

	/** Same as `reorderTagsInCollection` for the sidebar-selected collection. */
	async reorderTagsInCurrentCollection(srcIdx: number, targetIdx: number) {
		await this.reorderTagsInCollection(this.selectedCollectionId, srcIdx, targetIdx)
	}

	/**
	 * Remove tag from library, compacting sibling `idx` with `removeItemArr`, then refresh map + `currTags`.
	 * Call after stripping that tag from items (or before — tag must still exist in `libraryTags` when this runs).
	 */
	async deleteTagAndReindex(tagId: string) {
		const meta = libraryTags.byId[tagId]
		if (!meta) return
		const cid = meta.collectionId
		const removedIdx = meta.idx ?? 0
		const arr = this.collectionTagClonesForReorder(cid)
		const { newArray, updated } = removeItemArr({ array: arr, idx: removedIdx })
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('deleteTagAndReindex: live mode enabled but DB is not available')
			}
			await db.tags.delete(tagId)
		}
		deleteLibraryTag(tagId)
		this.applyIdxPatches(updated)
		if (!use_mocks) {
			await db.tags.updateIndices(cid, updated)
		}
		if (this.selectedCollectionId === cid) this.syncTagsFromLibrary()
	}

	/** Bump sibling `idx` with `insertItemArr`, then persist `updated` + new tag row. */
	async registerNewTagOrder(tag: Tag) {
		const cid = tag.collectionId
		const arr = this.collectionTagClonesForReorder(cid)
		const item: TagRow = {
			...tag,
			color: { ...tag.color },
			idx: tag.idx ?? arr.length
		}
		const { newArray: next, updated } = insertItemArr({ array: arr, item, atIdx: item.idx })
		const finalNew = next.find((r) => r.id === tag.id)
		if (!finalNew) return
		this.applyIdxPatches(updated)
		upsertLibraryTag({ ...tag, idx: finalNew.idx })
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('registerNewTagOrder: live mode enabled but DB is not available')
			}
			await db.tags.insert({ ...tag, idx: finalNew.idx })
			await db.tags.updateIndices(cid, updated)
		}
		if (this.selectedCollectionId === cid) this.syncTagsFromLibrary()
	}

	/**
	 * Rebuild `currTags` from `libraryTags` for the current `selectedCollectionId` (call after library mutations / collection change).
	 */
	syncTagsFromLibrary() {
		const cid = this.selectedCollectionId
		this.currTags = Object.values(libraryTags.byId)
			.filter((t) => t.collectionId === cid)
			.sort((a, b) => {
				const ai = a.idx ?? 0
				const bi = b.idx ?? 0
				if (ai !== bi) return ai - bi
				return a.id.localeCompare(b.id)
			})
	}
}

export const global = new Global()
if (use_mocks) {
	global.setCollection(global.selectedCollectionId)
}

export default global
