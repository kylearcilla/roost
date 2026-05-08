import { asc, eq } from 'drizzle-orm'
import { db } from '../context'
import type { ReorderItemPayload } from '../utils'
import { tag, tagOrder } from './tags.schema'
import type { TagInsert, TagOrderInsert, TagRow } from './tags.schema'

export function listTagsByCollection(collectionId: string): TagRow[] {
	return db()
		.select()
		.from(tag)
		.where(eq(tag.collectionId, collectionId))
		.orderBy(asc(tag.idx), asc(tag.id))
		.all()
}

export function listTagsAll(): TagRow[] {
	return db()
		.select()
		.from(tag)
		.orderBy(asc(tag.collectionId), asc(tag.idx), asc(tag.id))
		.all()
}

export function getTagById(id: string): TagRow | undefined {
	return db().select().from(tag).where(eq(tag.id, id)).get()
}

export function insertTag(row: TagInsert): TagRow {
	return db().insert(tag).values(row).returning().get()
}

export function updateTag(id: string, patch: Partial<TagInsert>): TagRow | undefined {
	return db().update(tag).set(patch).where(eq(tag.id, id)).returning().get()
}

export function deleteTag(id: string): { changes: number } {
	return db().delete(tag).where(eq(tag.id, id)).run()
}

/** Apply `idx` patches for tags in `collectionId`, then rebuild `tag_order`. */
export function updateIndices(collectionId: string, changes: ReorderItemPayload): { changes: number } {
	return db().transaction((tx) => {
		let total = 0
		for (const change of changes) {
			const r = tx.update(tag).set({ idx: change.idx }).where(eq(tag.id, change.id)).run()
			total += r.changes
		}
		const rows = tx
			.select()
			.from(tag)
			.where(eq(tag.collectionId, collectionId))
			.orderBy(asc(tag.idx), asc(tag.id))
			.all()
		tx.delete(tagOrder).where(eq(tagOrder.collectionId, collectionId)).run()
		for (let i = 0; i < rows.length; i++) {
			tx.insert(tagOrder).values({ collectionId, tagId: rows[i].id, sortIndex: i }).run()
		}
		return { changes: total }
	})
}

export function listTagOrderByCollection(collectionId: string) {
	return db()
		.select()
		.from(tagOrder)
		.where(eq(tagOrder.collectionId, collectionId))
		.orderBy(asc(tagOrder.sortIndex), asc(tagOrder.tagId))
		.all()
}

/** Replaces all `tag_order` rows for a collection inside one transaction. */
export function replaceTagOrder(collectionId: string, rows: Pick<TagOrderInsert, 'tagId' | 'sortIndex'>[]) {
	db().transaction((tx) => {
		tx.delete(tagOrder).where(eq(tagOrder.collectionId, collectionId)).run()
		for (const r of rows) {
			tx.insert(tagOrder)
				.values({ collectionId, tagId: r.tagId, sortIndex: r.sortIndex })
				.run()
		}
	})
}

export function deleteTagOrderForCollection(collectionId: string): { changes: number } {
	return db().delete(tagOrder).where(eq(tagOrder.collectionId, collectionId)).run()
}
