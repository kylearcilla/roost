import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Local profile (`User` in `src/lib/lib/types.ts`).
 * Typically one row (e.g. `id = 'local'`); PK stays flexible for multi-profile later.
 */
export const user = sqliteTable('user', {
	id: text('id').primaryKey().notNull(),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url')
})

export type UserRow = typeof user.$inferSelect
export type UserInsert = typeof user.$inferInsert
