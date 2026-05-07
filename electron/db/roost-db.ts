import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/** Drizzle client typing for `drizzle(sqlite, { schema })` using `./schema` barrel. */
export type RoostDb = BetterSQLite3Database<typeof import('./schema')>
