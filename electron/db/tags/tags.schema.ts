import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { collection } from '../collections/collections.schema'

/**
 * Library tag (`Tag` in `src/lib/lib/types.ts`).
 * `color_json` holds serialized `Color`; items reference tag `id` in `ContentItem.tags`.
 */
export const tag = sqliteTable(
	'tag',
	{
		id: text('id').primaryKey().notNull(),
		name: text('name').notNull(),
		collectionId: text('collection_id')
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		/** `GridColumnSize` */
		columnSize: text('column_size').notNull().default('medium'),
		idx: integer('idx', { mode: 'number' }),
		description: text('description'),
		colorJson: text('color_json').notNull()
	},
	(t) => [
		index('tag_collection_id_idx').on(t.collectionId),
		index('tag_collection_idx_order').on(t.collectionId, t.idx)
	]
)

/**
 * Toolbar tag order per collection (`Global.TAG_INDICES`).
 * Sort by `sort_index`; can diverge from `tag.idx` if you sync both in app code.
 */
export const tagOrder = sqliteTable(
	'tag_order',
	{
		collectionId: text('collection_id')
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' }),
		sortIndex: integer('sort_index', { mode: 'number' }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.collectionId, t.tagId] }),
		index('tag_order_collection_sort_idx').on(t.collectionId, t.sortIndex)
	]
)

export type TagRow = typeof tag.$inferSelect
export type TagInsert = typeof tag.$inferInsert
export type TagOrderRow = typeof tagOrder.$inferSelect
export type TagOrderInsert = typeof tagOrder.$inferInsert
