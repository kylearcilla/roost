import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { media } from './utils.schema'

export const collection = sqliteTable(
	'collection',
	{
		id: text('id').primaryKey().notNull(),
		/** Sidebar / list order (same meaning as `Collection.idx`). */
		idx: integer('idx', { mode: 'number' }).notNull().default(0),
		name: text('name').notNull(),
		headline: text('headline'),
		emoji: text('emoji'),
		subtitle: text('subtitle'),
		/** `GridColumnSize`: small | medium | large | xlarge */
		columnSize: text('column_size').notNull().default('large'),
		/** Denormalized count; optional cache. */
		itemCount: integer('item_count', { mode: 'number' }),
		/** FK to `media` for collection wallpaper; null = none. */
		wallpaperId: text('wallpaper_id').references(() => media.id, { onDelete: 'set null' }),
		/** Scroll / focal position for wallpaper (e.g. 0–1). */
		wallpaperFocusY: real('wallpaper_focus_y')
	},
	(t) => [index('collection_idx_order').on(t.idx)]
)

/**
 * Pinned favorite row (`FavoriteFolder` in `src/lib/lib/types.ts`).
 * Mirrors `Global.favorites` / `FAVORITES_ORDER_KEY` ordering via `idx`.
 */
export const favorite = sqliteTable(
	'favorite',
	{
		id: text('id').primaryKey().notNull(),
		idx: integer('idx', { mode: 'number' }).notNull().default(0),
		emoji: text('emoji').notNull(),
		name: text('name').notNull(),
		count: integer('count', { mode: 'number' }).notNull().default(0),
		/** Pinned collection; null = non-collection favorite slot if you add those later. */
		collectionId: text('collection_id').references(() => collection.id, { onDelete: 'set null' })
	},
	(t) => [index('favorite_idx_order').on(t.idx), index('favorite_collection_id_idx').on(t.collectionId)]
)

/**
 * Sidebar collection order: one row per `collection_id`; `sort_index` is drag order.
 */
export const collectionOrder = sqliteTable(
	'collection_order',
	{
		collectionId: text('collection_id')
			.primaryKey()
			.notNull()
			.references(() => collection.id, { onDelete: 'cascade' }),
		sortIndex: integer('sort_index', { mode: 'number' }).notNull()
	},
	(t) => [index('collection_order_sort_idx').on(t.sortIndex)]
)

export type CollectionRow = typeof collection.$inferSelect
export type CollectionInsert = typeof collection.$inferInsert
export type FavoriteRow = typeof favorite.$inferSelect
export type FavoriteInsert = typeof favorite.$inferInsert
export type CollectionOrderRow = typeof collectionOrder.$inferSelect
export type CollectionOrderInsert = typeof collectionOrder.$inferInsert
