import { asc, eq } from 'drizzle-orm'
import { db } from '../context'
import { collection, collectionOrder, favorite } from './collections.schema'
import type {
	CollectionInsert,
	CollectionOrderInsert,
	CollectionRow,
	FavoriteInsert,
	FavoriteRow
} from './collections.schema'
import type { ReorderItemPayload } from '../utils'

export function listCollections(): CollectionRow[] {
	return db().select().from(collection).orderBy(asc(collection.idx), asc(collection.id)).all()
}

export function getCollectionById(id: string): CollectionRow | undefined {
	return db().select().from(collection).where(eq(collection.id, id)).get()
}

export function insertCollection(row: CollectionInsert): CollectionRow {
	return db().insert(collection).values(row).returning().get()
}

export function updateCollection(id: string, patch: Partial<CollectionInsert>): CollectionRow | undefined {
	return db().update(collection).set(patch).where(eq(collection.id, id)).returning().get()
}

export function deleteCollection(id: string): { changes: number } {
	return db().delete(collection).where(eq(collection.id, id)).run()
}

export function listFavorites(): FavoriteRow[] {
	return db().select().from(favorite).orderBy(asc(favorite.idx), asc(favorite.id)).all()
}

export function getFavoriteById(id: string): FavoriteRow | undefined {
	return db().select().from(favorite).where(eq(favorite.id, id)).get()
}

export function insertFavorite(row: FavoriteInsert): FavoriteRow {
	return db().insert(favorite).values(row).returning().get()
}

export function updateFavorite(id: string, patch: Partial<FavoriteInsert>): FavoriteRow | undefined {
	return db().update(favorite).set(patch).where(eq(favorite.id, id)).returning().get()
}

export function deleteFavorite(id: string): { changes: number } {
	return db().delete(favorite).where(eq(favorite.id, id)).run()
}

/** Apply `idx` patches, then rebuild `collection_order` from current rows. */
export function updateIndices(changes: ReorderItemPayload): { changes: number } {
	return db().transaction((tx) => {
		let total = 0
		for (const change of changes) {
			const r = tx.update(collection).set({ idx: change.idx }).where(eq(collection.id, change.id)).run()
			total += r.changes
		}
		const rows = tx
			.select()
			.from(collection)
			.orderBy(asc(collection.idx), asc(collection.id))
			.all()
		tx.delete(collectionOrder).run()
		for (let i = 0; i < rows.length; i++) {
			tx.insert(collectionOrder)
				.values({ collectionId: rows[i].id, sortIndex: i })
				.run()
		}
		return { changes: total }
	})
}

export function listCollectionOrder() {
	return db()
		.select()
		.from(collectionOrder)
		.orderBy(asc(collectionOrder.sortIndex), asc(collectionOrder.collectionId))
		.all()
}

export function replaceCollectionOrder(rows: Pick<CollectionOrderInsert, 'collectionId' | 'sortIndex'>[]) {
	db().transaction((tx) => {
		tx.delete(collectionOrder).run()
		for (const r of rows) {
			tx.insert(collectionOrder).values({ collectionId: r.collectionId, sortIndex: r.sortIndex }).run()
		}
	})
}

export function clearCollectionOrder(): { changes: number } {
	return db().delete(collectionOrder).run()
}
