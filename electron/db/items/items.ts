import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../context'
import type { ReorderItemPayload } from '../utils'
import { libraryItem, libraryItemOrder } from './items.schema'
import type { LibraryItemInsert, LibraryItemOrderInsert, LibraryItemRow } from './items.schema'

export function listLibraryItems(): LibraryItemRow[] {
	return db().select().from(libraryItem).orderBy(desc(libraryItem.fetchedAt)).all()
}

export function getLibraryItemById(id: string): LibraryItemRow | undefined {
	return db().select().from(libraryItem).where(eq(libraryItem.id, id)).get()
}

export function getLibraryItemBySourceUrl(sourceUrl: string): LibraryItemRow | undefined {
	return db().select().from(libraryItem).where(eq(libraryItem.sourceUrl, sourceUrl)).get()
}

export function insertLibraryItem(row: LibraryItemInsert): LibraryItemRow {
	return db().insert(libraryItem).values(row).returning().get()
}

export function updateLibraryItem(id: string, patch: Partial<LibraryItemInsert>): LibraryItemRow | undefined {
	return db().update(libraryItem).set(patch).where(eq(libraryItem.id, id)).returning().get()
}

export function deleteLibraryItemById(id: string): { changes: number } {
	return db().delete(libraryItem).where(eq(libraryItem.id, id)).run()
}

export function deleteLibraryItemBySourceUrl(sourceUrl: string): { changes: number } {
	return db().delete(libraryItem).where(eq(libraryItem.sourceUrl, sourceUrl)).run()
}

/**
 * Upsert by `source_url` (same semantics as `initial.cjs` `libraryUpsert`):
 * new `id` on insert; on conflict refresh denormalized fields + `payload_json`.
 */
export function upsertLibraryItemFromMetadata(metadata: Record<string, unknown>) {
	if (!metadata || typeof metadata.sourceUrl !== 'string' || !metadata.sourceUrl.trim()) {
		throw new TypeError('metadata.sourceUrl is required')
	}
	const sourceUrl = metadata.sourceUrl.trim()
	const id = randomUUID()
	const now = Date.now()
	const provider = typeof metadata.provider === 'string' ? metadata.provider : 'unknown'
	const title = typeof metadata.title === 'string' ? metadata.title : null
	const payloadJson = JSON.stringify(metadata)
	db()
		.insert(libraryItem)
		.values({
			id,
			sourceUrl,
			provider,
			title,
			fetchedAt: now,
			payloadJson
		})
		.onConflictDoUpdate({
			target: libraryItem.sourceUrl,
			set: {
				provider,
				title,
				fetchedAt: now,
				payloadJson
			}
		})
		.run()
}

export function listLibraryItemOrderByScope(scopeKey: string) {
	return db()
		.select()
		.from(libraryItemOrder)
		.where(eq(libraryItemOrder.scopeKey, scopeKey))
		.orderBy(asc(libraryItemOrder.sortIndex), asc(libraryItemOrder.libraryItemId))
		.all()
}

export function replaceLibraryItemOrderForScope(
	scopeKey: string,
	rows: Pick<LibraryItemOrderInsert, 'libraryItemId' | 'sortIndex'>[]
) {
	db().transaction((tx) => {
		tx.delete(libraryItemOrder).where(eq(libraryItemOrder.scopeKey, scopeKey)).run()
		for (const r of rows) {
			tx.insert(libraryItemOrder)
				.values({ scopeKey, libraryItemId: r.libraryItemId, sortIndex: r.sortIndex })
				.run()
		}
	})
}

export function deleteLibraryItemOrderForScope(scopeKey: string): { changes: number } {
	return db().delete(libraryItemOrder).where(eq(libraryItemOrder.scopeKey, scopeKey)).run()
}

/** Remove all `library_item_order` rows for `collectionId` (all + each tag slice). */
export function deleteOrderScopesForCollection(collectionId: string, tagIds: string[]): { changes: number } {
	const cid = typeof collectionId === 'string' ? collectionId.trim() : ''
	if (!cid) return { changes: 0 }
	return db().transaction((tx) => {
		let total = tx.delete(libraryItemOrder).where(eq(libraryItemOrder.scopeKey, cid)).run().changes
		for (const tid of tagIds) {
			if (typeof tid !== 'string' || !tid.trim()) continue
			total += tx
				.delete(libraryItemOrder)
				.where(eq(libraryItemOrder.scopeKey, `${cid}::${tid.trim()}`))
				.run().changes
		}
		return { changes: total }
	})
}

/**
 * Batch-update `sort_index` for `library_item_order` in one scope.
 * `changes[].id` → `library_item_id`, `changes[].idx` → `sort_index`.
 */
export function updateIndices(scopeKey: string, changes: ReorderItemPayload): { changes: number } {
	return db().transaction((tx) => {
		let total = 0
		for (const change of changes) {
			const r = tx
				.update(libraryItemOrder)
				.set({ sortIndex: change.idx })
				.where(
					and(
						eq(libraryItemOrder.scopeKey, scopeKey),
						eq(libraryItemOrder.libraryItemId, change.id)
					)
				)
				.run()
			total += r.changes
		}
		return { changes: total }
	})
}
