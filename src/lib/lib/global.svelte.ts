import { use_mocks } from '$lib/env'
import { findItems } from '$lib/lib/collections'
import { db } from '$lib/lib/DBManager'
import { libraryContent, patchLibraryItem } from '$lib/libraryContent.svelte'
import { deleteLibraryTag, libraryTags, patchLibraryTag, upsertLibraryTag } from '$lib/libraryTags.svelte'
import { mockCollections, mockFavorites, mockUser } from '$lib/mocks'
import { insertItemArr, removeItemArr, reorderItemArr } from '$lib/lib/utils'

/** Single bucket key for sidebar lists (`*_INDICES`). */
const FAVORITES_ORDER_KEY = 'sidebar'
const COLLECTIONS_ORDER_KEY = 'sidebar'

type TagRow = Tag & { idx: number }

const emptyUser: User = { id: '', displayName: '', avatarUrl: undefined }

export class Global {
	user = $state<User>(use_mocks ? { ...mockUser } : { ...emptyUser })
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

	/** Tag order per collection: `collectionId` → `{ id, idx }[]` sorted by `idx`. */
	private TAG_INDICES = new Map<string, { id: string; idx: number }[]>()
	/** Item order per tag | collection ("all"): key is `collectionId` for “all”, else `collectionId::tagId`. */
	private ITEM_INDICES = new Map<string, { id: string; idx: number }[]>()
	/** Collection order in favorites: one bucket (`FAVORITES_ORDER_KEY`) → `{ id, idx }[]` by `idx`. */
	private FAVORITE_INDICES = new Map<string, { id: string; idx: number }[]>()
	/** Collection order: one bucket (`COLLECTIONS_ORDER_KEY`) → `{ id, idx }[]` by `idx`. */
    private COLLECTION_INDICES = new Map<string, { id: string; idx: number }[]>()

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

	async fetchUser() {
		if (use_mocks) {
			return this.user
		}
		if (!db.isAvailable) {
			throw new Error('fetchUser: live mode enabled but DB is not available')
		}
		const id = this.user.id
		if (!id) {
			throw new Error('fetchUser: no user id in live mode')
		}
		const row = (await db.users.get(id)) as User | undefined
		if (row) this.user = { ...this.user, ...row }
		return this.user
	}

	async updateUser(user: Partial<User>) {
		if (use_mocks) {
			this.user = { ...this.user, ...user }
			return
		}
		if (!db.isAvailable) {
			throw new Error('updateUser: live mode enabled but DB is not available')
		}
		const id = this.user.id
		if (!id) {
			throw new Error('updateUser: no user id in live mode')
		}
		await db.users.update(id, user)
		this.user = { ...this.user, ...user }
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
			this.rebuildCollectionIndicesFromState()
			return this.collections
		}
		if (!db.isAvailable) {
			throw new Error('fetchCollections: live mode enabled but DB is not available')
		}

		const rows = (await db.collections.list()) as Collection[]
		const sorted = [...rows].sort(
			(a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)
		)
		this.collections = sorted
		const active = sorted.find((c) => c.id === this.selectedCollectionId)?.id ?? sorted[0]?.id ?? ''
		this.selectedCollectionId = active
		this.onHomePage = !active
		this.syncTagsFromLibrary()
		this.rebuildCollectionIndicesFromState()
		return this.collections
	}

	setCollection(collectionId: string) {
		if (!this.collections.some((c) => c.id === collectionId)) return
		this.onHomePage = false
		this.selectedCollectionId = collectionId
		this.syncTagsFromLibrary()
	}

	async addCollection(collection: Collection) {
		if (use_mocks) {
			this.collections = [...this.collections, collection]
			this.rebuildCollectionIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('addCollection: live mode enabled but DB is not available')
		}
		await db.collections.insert(collection)
		this.collections = [...this.collections, collection]
		this.rebuildCollectionIndicesFromState()
	}

	async updateCollection(collection: Collection) {
		if (use_mocks) {
			this.collections = this.collections.map((c) => (c.id === collection.id ? collection : c))
			this.rebuildCollectionIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('updateCollection: live mode enabled but DB is not available')
		}
		await db.collections.update(collection.id, collection)
		this.collections = this.collections.map((c) => (c.id === collection.id ? collection : c))
		this.rebuildCollectionIndicesFromState()
	}

	async deleteCollection(collectionId: string) {
		if (use_mocks) {
			const next = this.collections
				.filter((c) => c.id !== collectionId)
				.map((c, i) => ({ ...c, idx: i }))
			this.collections = next
			if (this.selectedCollectionId === collectionId) {
				const first = next[0]?.id
				if (first) this.setCollection(first)
				else this.selectedCollectionId = ''
			}
			this.rebuildCollectionIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('deleteCollection: live mode enabled but DB is not available')
		}
		await db.collections.delete(collectionId)
		const next = this.collections
			.filter((c) => c.id !== collectionId)
			.map((c, i) => ({ ...c, idx: i }))
		this.collections = next
		if (this.selectedCollectionId === collectionId) {
			const first = next[0]?.id
			if (first) this.setCollection(first)
			else this.selectedCollectionId = ''
		}
		this.rebuildCollectionIndicesFromState()
	}

	/** Sidebar passes the new order after drag; global only assigns `idx` + cache. */

	async applyCollectionsOrder(ordered: Collection[]) {
		const next = ordered.map((c, i) => ({ ...c, idx: i }))
		if (use_mocks) {
			this.collections = next
			this.rebuildCollectionIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('applyCollectionsOrder: live mode enabled but DB is not available')
		}
		await Promise.all(next.map((c, i) => db.collections.patch(c.id, { idx: i })))
		await db.collectionOrder.replace(
			COLLECTIONS_ORDER_KEY,
			next.map((c, i) => ({ collectionId: c.id, sortIndex: i }))
		)
		this.collections = next
		this.rebuildCollectionIndicesFromState()
	}

	collectionIndexList(): readonly { id: string; idx: number }[] {
		const rows = this.COLLECTION_INDICES.get(COLLECTIONS_ORDER_KEY)
		return rows ? [...rows] : []
	}

	syncCollectionOrderCache() {
		this.rebuildCollectionIndicesFromState()
	}

	private rebuildCollectionIndicesFromState() {
		this.COLLECTION_INDICES.clear()
		const rows = [...this.collections]
			.map((c) => ({ id: c.id, idx: c.idx ?? 0 }))
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
		this.COLLECTION_INDICES.set(COLLECTIONS_ORDER_KEY, rows)
	}

	/* ⛳️ items */

	async fetchItems() {
		if (use_mocks) {
			return libraryContent.items
		}
		if (!db.isAvailable) {
			throw new Error('fetchItems: live mode enabled but DB is not available')
		}
		return (await db.libraryItems.list()) as ContentItem[]
	}

	itemSliceKey(collectionId: string, filter: ContentToolbarFilter): string {
		const cid = collectionId.trim()
		if (!filter || filter === 'all') return cid
		return `${cid}::${String(filter).trim()}`
	}

	/** Ordered `{ id, idx }` for that slice; shallow copy. */
	itemIndexList(collectionId: string, filter: ContentToolbarFilter): readonly { id: string; idx: number }[] {
		const rows = this.ITEM_INDICES.get(this.itemSliceKey(collectionId, filter))
		return rows ? [...rows] : []
	}

	getItemIdx(collectionId: string, filter: ContentToolbarFilter, itemId: string) {
		const row = this.ITEM_INDICES.get(this.itemSliceKey(collectionId, filter))?.find((r) => r.id === itemId)
		const live = libraryContent.items.find((i) => i.id === itemId)
		return row?.idx ?? live?.idx ?? 0
	}

	/** Remove one item and compact `idx` to `0..n-1` in every slice it belonged to. */
	async onDeleteItem(id: string) {
		const removed = libraryContent.items.find((i) => i.id === id)
		if (!removed) return
		if (use_mocks) {
			libraryContent.items = libraryContent.items.filter((i) => i.id !== id)
			for (const scope of this.itemScopesForContentItem(removed)) {
				this.compactItemSliceOrder(scope.collectionId, scope.filter)
			}
			this.rebuildItemIndicesFromLibrary()
			return
		}
		if (!db.isAvailable) {
			throw new Error('onDeleteItem: live mode enabled but DB is not available')
		}
		await db.libraryItems.delete(id)
		libraryContent.items = libraryContent.items.filter((i) => i.id !== id)
		for (const scope of this.itemScopesForContentItem(removed)) {
			this.compactItemSliceOrder(scope.collectionId, scope.filter)
		}
		this.rebuildItemIndicesFromLibrary()
	}

	/** Call after a new row is appended to `libraryContent` (idx already set). */
	onAddItem(id: string) {
		if (!libraryContent.items.some((i) => i.id === id)) return
		this.rebuildItemIndicesFromLibrary()
	}

	/** Renumber `idx` in one slice to `0..n-1` (sort by current idx, then id) and refresh `ITEM_INDICES`. */
	enforceItemOrder(collectionId: string, filter: ContentToolbarFilter) {
		this.compactItemSliceOrder(collectionId, filter)
		this.rebuildItemIndicesFromLibrary()
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

	/** Refresh `ITEM_INDICES` from `libraryContent` (e.g. after drag reorder patches `idx`). */
	syncItemOrderCache() {
		this.rebuildItemIndicesFromLibrary()
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

	private rebuildItemIndicesFromLibrary() {
		this.ITEM_INDICES.clear()
		const buckets = new Map<string, { id: string; idx: number }[]>()
		for (const it of libraryContent.items) {
			for (const cid of it.collectionIds) {
				const allKey = this.itemSliceKey(cid, 'all')
				let allRows = buckets.get(allKey)
				if (!allRows) {
					allRows = []
					buckets.set(allKey, allRows)
				}
				allRows.push({ id: it.id, idx: it.idx })
				for (const tid of it.tags) {
					const tagKey = this.itemSliceKey(cid, tid)
					let tagRows = buckets.get(tagKey)
					if (!tagRows) {
						tagRows = []
						buckets.set(tagKey, tagRows)
					}
					tagRows.push({ id: it.id, idx: it.idx })
				}
			}
		}
		for (const [key, rows] of buckets) {
			rows.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
			this.ITEM_INDICES.set(key, rows)
		}
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
		const rows = this.FAVORITE_INDICES.get(FAVORITES_ORDER_KEY)
		return rows ? [...rows] : []
	}

	getFavoriteIdx(favoriteId: string) {
		const row = this.FAVORITE_INDICES.get(FAVORITES_ORDER_KEY)?.find((r) => r.id === favoriteId)
		const live = this.favorites.find((f) => f.id === favoriteId)
		return row?.idx ?? live?.idx ?? 0
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
			this.rebuildFavoriteIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('addFavoriteFromCollection: live mode enabled but DB is not available')
		}
		await db.favorites.insert({
			id: row.id,
			idx: row.idx,
			emoji: row.emoji,
			name: row.name,
			count: row.count,
			collectionId: col.id
		})
		this.favorites = [...this.favorites, row]
		this.rebuildFavoriteIndicesFromState()
	}

	async removeFavoriteAndReindex(favoriteId: string) {
		if (!this.favorites.some((f) => f.id === favoriteId)) return
		if (use_mocks) {
			this.favorites = this.favorites
				.filter((f) => f.id !== favoriteId)
				.map((f, i) => ({ ...f, idx: i }))
			this.rebuildFavoriteIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('removeFavoriteAndReindex: live mode enabled but DB is not available')
		}
		await db.favorites.delete(favoriteId)
		this.favorites = this.favorites
			.filter((f) => f.id !== favoriteId)
			.map((f, i) => ({ ...f, idx: i }))
		this.rebuildFavoriteIndicesFromState()
	}

	/** Sidebar passes the new order after drag; global only assigns `idx` + cache. */
	async applyFavoritesOrder(ordered: FavoriteFolder[]) {
		const next = ordered.map((f, i) => ({ ...f, idx: i }))
		if (use_mocks) {
			this.favorites = next
			this.rebuildFavoriteIndicesFromState()
			return
		}
		if (!db.isAvailable) {
			throw new Error('applyFavoritesOrder: live mode enabled but DB is not available')
		}
		await Promise.all(next.map((f) => db.favorites.update(f.id, { idx: f.idx })))
		this.favorites = next
		this.rebuildFavoriteIndicesFromState()
	}

	/** Renumber favorites to `0..n-1` by current `idx` sort and refresh `FAVORITE_INDICES`. */
	enforceFavoriteOrder() {
		const next = [...this.favorites]
			.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id))
			.map((f, i) => ({ ...f, idx: i }))
		this.favorites = next
		this.rebuildFavoriteIndicesFromState()
	}

	syncFavoriteOrderCache() {
		this.rebuildFavoriteIndicesFromState()
	}

	private rebuildFavoriteIndicesFromState() {
		this.FAVORITE_INDICES.clear()
		const rows = [...this.favorites]
			.map((f) => ({ id: f.id, idx: f.idx ?? 0 }))
			.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
		this.FAVORITE_INDICES.set(FAVORITES_ORDER_KEY, rows)
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

	/** Ordered `{ id, idx }` for `collectionId` (toolbar slots); rebuilt with `libraryTags`. */
	tagIndexList(collectionId: string): readonly { id: string; idx: number }[] {
		const rows = this.TAG_INDICES.get(collectionId)
		return rows ? [...rows] : []
	}

	getTagIdx(cId: string, tId: string) {
		const row = this.TAG_INDICES.get(cId)?.find((r) => r.id === tId)
		return row?.idx ?? libraryTags.byId[tId]?.idx ?? 0
	}

	/* ⛳️ tags ordering */

	/** Sort `currTags` using indices map / `libraryTags` idx for the active collection. */
	enforceTagOrder() {
		const cid = this.selectedCollectionId
		this.currTags = [...this.currTags].sort((a, b) => {
			const ai = this.getTagIdx(cid, a.id)
			const bi = this.getTagIdx(cid, b.id)
			if (ai !== bi) return ai - bi
			return a.id.localeCompare(b.id)
		})
	}

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

	private rebuildIndicesMapFromLibrary() {
		this.TAG_INDICES.clear()
		const buckets = new Map<string, { id: string; idx: number }[]>()
		for (const t of Object.values(libraryTags.byId)) {
			const cid = t.collectionId
			let rows = buckets.get(cid)
			if (!rows) {
				rows = []
				buckets.set(cid, rows)
			}
			rows.push({ id: t.id, idx: t.idx ?? 0 })
		}
		for (const [cid, rows] of buckets) {
			rows.sort((a, b) => a.idx - b.idx || a.id.localeCompare(b.id))
			this.TAG_INDICES.set(cid, rows)
		}
	}

	/**
	 * Reorder toolbar tags for `collectionId` using `reorderItemArr` (`srcIdx` / `targetIdx` are tag `idx` slots).
	 * Updates `libraryTags`, indices map, and `currTags` when that collection is active.
	 */
	async reorderTagsInCollection(collectionId: string, srcIdx: number, targetIdx: number) {
		const arr = this.collectionTagClonesForReorder(collectionId)
		const { updated } = reorderItemArr({ array: arr, srcIdx, targetIdx })
		this.applyIdxPatches(updated)
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('reorderTagsInCollection: live mode enabled but DB is not available')
			}
			for (const u of updated) {
				await db.tags.patch(u.id, { idx: u.idx })
			}
			const orderAfter = this.collectionTagClonesForReorder(collectionId)
			await db.tags.replaceOrder(
				collectionId,
				orderAfter.map((t, i) => ({ tagId: t.id, sortIndex: i }))
			)
		}
		this.rebuildIndicesMapFromLibrary()
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
		const { updated } = removeItemArr({ array: arr, idx: removedIdx })
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('deleteTagAndReindex: live mode enabled but DB is not available')
			}
			await db.tags.delete(tagId)
		}
		deleteLibraryTag(tagId)
		this.applyIdxPatches(updated)
		if (!use_mocks) {
			for (const u of updated) {
				await db.tags.patch(u.id, { idx: u.idx })
			}
			const orderAfter = this.collectionTagClonesForReorder(cid)
			await db.tags.replaceOrder(
				cid,
				orderAfter.map((t, i) => ({ tagId: t.id, sortIndex: i }))
			)
		}
		this.rebuildIndicesMapFromLibrary()
		if (this.selectedCollectionId === cid) this.syncTagsFromLibrary()
	}

	/** Bump sibling `idx` with `insertItemArr`, then `upsertLibraryTag` (call instead of raw upsert for toolbar order). */
	async registerNewTagOrder(tag: Tag) {
		const cid = tag.collectionId
		const arr = this.collectionTagClonesForReorder(cid)
		const item: TagRow = {
			...tag,
			color: { ...tag.color },
			idx: tag.idx ?? arr.length
		}
		const next = insertItemArr({ array: arr, item, atIdx: item.idx }) as TagRow[]
		const finalNew = next.find((r) => r.id === tag.id)
		if (!finalNew) return
		for (const row of next) {
			if (row.id === tag.id) continue
			patchLibraryTag(row.id, { idx: row.idx })
		}
		upsertLibraryTag({ ...tag, idx: finalNew.idx })
		if (!use_mocks) {
			if (!db.isAvailable) {
				throw new Error('registerNewTagOrder: live mode enabled but DB is not available')
			}
			await db.tags.insert({ ...tag, idx: finalNew.idx })
			for (const row of next) {
				if (row.id === tag.id) continue
				await db.tags.patch(row.id, { idx: row.idx })
			}
			await db.tags.replaceOrder(
				cid,
				next.map((r, i) => ({ tagId: String(r.id), sortIndex: i }))
			)
		}
		this.rebuildIndicesMapFromLibrary()
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
		this.rebuildIndicesMapFromLibrary()
	}
}

export const global = new Global()
if (use_mocks) {
	global.setCollection(global.selectedCollectionId)
}
global.syncItemOrderCache()
global.syncFavoriteOrderCache()
global.syncCollectionOrderCache()

export default global
