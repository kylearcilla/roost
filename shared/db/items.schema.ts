import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Saved library card: denormalized fields + full metadata JSON. */
export const libraryItem = sqliteTable(
	'library_item',
	{
		id: text('id').primaryKey().notNull(),
		sourceUrl: text('source_url').notNull().unique(),
		provider: text('provider').notNull(),
		title: text('title'),
		fetchedAt: integer('fetched_at', { mode: 'number' }).notNull(),
		payloadJson: text('payload_json').notNull()
	},
	(t) => [index('library_item_fetched_at_idx').on(t.fetchedAt)]
)

/**
 * Item order per scope (collection + optional tag filter).
 * `scope_key` is `collectionId` for “all”, or `collectionId::tagId` for a tag filter.
 */
export const libraryItemOrder = sqliteTable(
	'library_item_order',
	{
		scopeKey: text('scope_key').notNull(),
		libraryItemId: text('library_item_id')
			.notNull()
			.references(() => libraryItem.id, { onDelete: 'cascade' }),
		sortIndex: integer('sort_index', { mode: 'number' }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.scopeKey, t.libraryItemId] }),
		index('library_item_order_scope_sort_idx').on(t.scopeKey, t.sortIndex)
	]
)

export type LibraryItemRow = typeof libraryItem.$inferSelect
export type LibraryItemInsert = typeof libraryItem.$inferInsert
export type LibraryItemOrderRow = typeof libraryItemOrder.$inferSelect
export type LibraryItemOrderInsert = typeof libraryItemOrder.$inferInsert
