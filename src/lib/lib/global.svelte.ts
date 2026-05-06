import { findItems } from '$lib/lib/collections'
import { libraryContent, patchLibraryItem } from '$lib/libraryContent.svelte'
import { deleteLibraryTag, libraryTags, patchLibraryTag, upsertLibraryTag } from '$lib/libraryTags.svelte'
import { mockCollections, mockFavorites, mockUser } from '$lib/mocks'
import { insertItemArr, removeItemArr, reorderItemArr } from '$lib/lib/utils'

/** Single bucket key for sidebar lists (`*_INDICES`). */
const FAVORITES_ORDER_KEY = 'sidebar'
const COLLECTIONS_ORDER_KEY = 'sidebar'

type TagRow = Tag & { idx: number }

export class Global {
	user = $state<LibraryUser>({ ...mockUser })
    onHomePage = $state(false)

    
	collections = $state<Collection[]>(mockCollections.map((c) => ({ ...c })))
	selectedCollectionId = $state('advice')
	currFilterTab = $state<ContentToolbarFilter>('all')
	currTags = $state<Tag[]>([])
	favorites = $state<FavoriteFolder[]>(mockFavorites.map((f) => ({ ...f })))

	/** Per-collection toolbar order: `collectionId` → `{ id, idx }[]` sorted by `idx`. */
	private TAG_INDICES = new Map<string, { id: string; idx: number }[]>()
	/** Item order per `findItems` slice: key is `collectionId` for “all”, else `collectionId::tagId`. */
	private ITEM_INDICES = new Map<string, { id: string; idx: number }[]>()
	/** Sidebar favorites: one bucket (`FAVORITES_ORDER_KEY`) → `{ id, idx }[]` by `idx`. */
	private FAVORITE_INDICES = new Map<string, { id: string; idx: number }[]>()
    private COLLECTION_INDICES = new Map<string, { id: string; idx: number }[]>()

	sortedFavorites = $derived(
		[...this.favorites].sort(
			(a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)
		)
	)

	sortedCollections = $derived(
		[...this.collections].sort(
			(a, b) => (a.idx ?? 0) - (b.idx ?? 0) || a.id.localeCompare(b.id)
		)
	)

	setOnHomePage(value: boolean) {
		this.onHomePage = value
		if (value) {
			this.selectedCollectionId = ''
			this.syncTagsFromLibrary()
		}
	}
	/** `id` is a tag id or a collection id (`all` view uses the collection id, not `'all'`). */
	setColSize(id: string, size: GridColumnSize) {
		const tag = libraryTags.byId[id]
		if (tag) {
			if (tag.columnSize === size) return
			patchLibraryTag(id, { columnSize: size })
			return
		}
		const i = this.collections.findIndex((c) => c.id === id)
		if (i === -1) return
		const c = this.collections[i]
		if (!c || c.columnSize === size) return
		const next = [...this.collections]
		next[i] = { ...c, columnSize: size }
		this.collections = next
	}

    /* user  */

    updateUser(user: Partial<LibraryUser>) {
        this.user = { ...this.user, ...user }
    }

	/* ⛳️ collections */

	currCollection = $derived(
		this.collections.find((c) => c.id === this.selectedCollectionId) ?? null
	)

	/** Set `selectedCollectionId` (if id exists) and replace `currTags` from `libraryTags`. */
	setCollection(collectionId: string) {
		if (!this.collections.some((c) => c.id === collectionId)) return
		this.onHomePage = false
		this.selectedCollectionId = collectionId
		this.syncTagsFromLibrary()
	}

	addCollection(collection: Collection) {
		this.collections = [...this.collections, collection]
		this.rebuildCollectionIndicesFromState()
	}

	updateCollection(collection: Collection) {
		this.collections = this.collections.map((c) => (c.id === collection.id ? collection : c))
		this.rebuildCollectionIndicesFromState()
	}

	deleteCollection(collectionId: string) {
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
	applyCollectionsOrder(ordered: Collection[]) {
		this.collections = ordered.map((c, i) => ({ ...c, idx: i }))
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
	onDeleteItem(id: string) {
		const removed = libraryContent.items.find((i) => i.id === id)
		if (!removed) return
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

	addFavoriteFromCollection(col: Collection) {
		if (this.favorites.some((f) => f.collectionId === col.id)) return
		const idx = this.favorites.length
		this.favorites = [
			...this.favorites,
			{
				id: `fav-${col.id}`,
				idx,
				emoji: col.emoji ?? '📌',
				name: col.name,
				count: col.itemCount ?? 0,
				collectionId: col.id
			}
		]
		this.rebuildFavoriteIndicesFromState()
	}

	removeFavoriteAndReindex(favoriteId: string) {
		if (!this.favorites.some((f) => f.id === favoriteId)) return
		this.favorites = this.favorites
			.filter((f) => f.id !== favoriteId)
			.map((f, i) => ({ ...f, idx: i }))
		this.rebuildFavoriteIndicesFromState()
	}

	/** Sidebar passes the new order after drag; global only assigns `idx` + cache. */
	applyFavoritesOrder(ordered: FavoriteFolder[]) {
		this.favorites = ordered.map((f, i) => ({ ...f, idx: i }))
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

	getCollectionTags(): Tag[] {
		return this.currTags
	}
	getTags(): Tag[] {
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
	reorderTagsInCollection(collectionId: string, srcIdx: number, targetIdx: number) {
		const arr = this.collectionTagClonesForReorder(collectionId)
		const { updated } = reorderItemArr({ array: arr, srcIdx, targetIdx })
		this.applyIdxPatches(updated)
		this.rebuildIndicesMapFromLibrary()
		if (this.selectedCollectionId === collectionId) this.syncTagsFromLibrary()
	}

	/** Same as `reorderTagsInCollection` for the sidebar-selected collection. */
	reorderTagsInCurrentCollection(srcIdx: number, targetIdx: number) {
		this.reorderTagsInCollection(this.selectedCollectionId, srcIdx, targetIdx)
	}

	/**
	 * Remove tag from library, compacting sibling `idx` with `removeItemArr`, then refresh map + `currTags`.
	 * Call after stripping that tag from items (or before — tag must still exist in `libraryTags` when this runs).
	 */
	deleteTagAndReindex(tagId: string) {
		const meta = libraryTags.byId[tagId]
		if (!meta) return
		const cid = meta.collectionId
		const removedIdx = meta.idx ?? 0
		const arr = this.collectionTagClonesForReorder(cid)
		const { updated } = removeItemArr({ array: arr, idx: removedIdx })
		deleteLibraryTag(tagId)
		this.applyIdxPatches(updated)
		this.rebuildIndicesMapFromLibrary()
		if (this.selectedCollectionId === cid) this.syncTagsFromLibrary()
	}

	/** Bump sibling `idx` with `insertItemArr`, then `upsertLibraryTag` (call instead of raw upsert for toolbar order). */
	registerNewTagOrder(tag: Tag) {
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
global.setCollection(global.selectedCollectionId)
global.syncItemOrderCache()
global.syncFavoriteOrderCache()
global.syncCollectionOrderCache()

export default global
