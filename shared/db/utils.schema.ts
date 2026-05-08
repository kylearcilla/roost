import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Normalized media row (image / video asset).
 * Aligns with app `Media` in `src/lib/lib/types.ts` (`type`, `url?`, `path?`, `dims`).
 */
export const media = sqliteTable('media', {
	id: text('id').primaryKey().notNull(),
	kind: text('kind', { enum: ['image', 'video'] }).notNull(),
	url: text('url'),
	path: text('path'),
	/** `ImageDimsType` */
	dims: text('dims', {
		enum: ['3x2', 'portrait', 'square', 'video', 'default', 'auto']
	})
		.notNull()
		.default('default')
})

export type MediaRow = typeof media.$inferSelect
export type MediaInsert = typeof media.$inferInsert
