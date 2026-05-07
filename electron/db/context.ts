import type { RoostDb } from './roost-db'

let _db: RoostDb | null = null

/** Called from main `openDb` after `drizzle(..., { schema })`. */
export function setRoostDb(instance: RoostDb) {
	_db = instance
}

/** Called from main `closeDb` before closing SQLite. */
export function clearRoostDb() {
	_db = null
}

/** Active Drizzle client — use in CRUD modules instead of threading `db` through every call. */
export function db(): RoostDb {
	if (_db === null) {
		throw new Error('Roost DB not open — openDb() must run before any db() access')
	}
	return _db
}
