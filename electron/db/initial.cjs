/**
 * Electron main-process DB: opens SQLite under `userData`, runs Drizzle migrations,
 * and exposes IPC-friendly helpers for the content library (`library_item`).
 *
 * Schema tables live under `shared/db/` and are re-exported from `./schema.ts`;
 * this file loads that barrel with {@link https://github.com/unjs/jiti | jiti} (CJS → TS).
 *
 * @module electron/db/initial
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const jiti = require('jiti')(__filename)
const roostContext = jiti(path.join(__dirname, 'context.ts'))
const { desc, eq } = require('drizzle-orm')
/** Loaded inside {@link openDb} so `better-sqlite3` native is not pulled at `require('./initial.cjs')` time. */

/**
 * Raw `better-sqlite3` handle; owns the file. Cleared in {@link closeDb}.
 * @type {import('better-sqlite3').Database | null}
 */
let sqlite = null

/**
 * Drizzle ORM wrapper around `sqlite`; null when closed.
 * @type {ReturnType<typeof drizzle> | null}
 */
let drizzleDb = null

/** All table exports from `./schema.ts` for `drizzle(client, { schema })`. */
const schema = jiti('./schema.ts')
/** `library_item` table ref (destructured for queries below). */
const { libraryItem } = schema

/**
 * Absolute path to the app’s SQLite file (not the Drizzle Kit dev DB).
 *
 * @param {import('electron').App} app - Electron app; `getPath('userData')` is OS-specific app data dir.
 * @returns {string} Path to `roost-library.db`.
 */
function getDbPath(app) {
	return path.join(app.getPath('userData'), 'roost-library.db')
}

/**
 * Opens the DB file (creates parent dirs + file if missing), enables WAL, wires Drizzle,
 * and applies pending SQL from `electron/db/migrations`.
 *
 * @param {import('electron').App} app - Electron app instance.
 * @returns {import('better-sqlite3').Database} The underlying `better-sqlite3` client.
 */
function openDb(app) {
	if (sqlite) return sqlite
	const { drizzle } = require('drizzle-orm/better-sqlite3')
	const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
	const Database = require('better-sqlite3')
	const fp = getDbPath(app)
	fs.mkdirSync(path.dirname(fp), { recursive: true })
	sqlite = new Database(fp)
	sqlite.pragma('journal_mode = WAL')
	drizzleDb = drizzle(sqlite, { schema })
	roostContext.setRoostDb(drizzleDb)
	migrate(drizzleDb, { migrationsFolder: path.join(__dirname, 'migrations') })
	return sqlite
}

/**
 * Closes the SQLite connection and drops Drizzle refs. Prefer calling from `before-quit`.
 *
 * @returns {void}
 */
function closeDb() {
	if (sqlite) {
		roostContext.clearRoostDb()
		sqlite.close()
		sqlite = null
		drizzleDb = null
	}
}

/**
 * @typedef {Object} LibraryListRow
 * @property {string} id - Row PK (UUID from first insert; unchanged on upsert).
 * @property {string} sourceUrl - Unique `source_url`; upsert key.
 * @property {string} provider - Denormalized for list views.
 * @property {string | null} title - Denormalized title.
 * @property {number} fetchedAt - Last upsert, Unix ms (`fetched_at`).
 * @property {Record<string, unknown>} metadata - Parsed `payload_json` (renderer: fetched metadata).
 */

/**
 * Returns all `library_item` rows, newest {@link LibraryListRow#fetchedAt} first.
 *
 * @param {import('electron').App} app - Electron app instance.
 * @returns {LibraryListRow[]}
 */
function libraryList(app) {
	openDb(app)
	if (!drizzleDb) throw new Error('Drizzle not initialized')
	const rows = drizzleDb.select().from(libraryItem).orderBy(desc(libraryItem.fetchedAt)).all()
	return rows.map((r) => ({
		id: r.id,
		sourceUrl: r.sourceUrl,
		provider: r.provider,
		title: r.title,
		fetchedAt: r.fetchedAt,
		metadata: JSON.parse(r.payloadJson)
	}))
}

/**
 * Inserts a row or updates on `source_url` conflict. New inserts get a fresh {@link https://nodejs.org/api/crypto.html#cryptorandomuuidoptions | crypto.randomUUID} `id`;
 * updates refresh denormalized fields + JSON payload but **do not** replace `id`.
 *
 * @param {import('electron').App} app - Electron app instance.
 * @param {Record<string, unknown>} metadata - Must include non-empty `sourceUrl`; whole object is stringified into `payload_json`.
 * @returns {{ ok: true }}
 * @throws {TypeError} If `metadata.sourceUrl` is missing or whitespace-only.
 */
function libraryUpsert(app, metadata) {
	if (!metadata || typeof metadata.sourceUrl !== 'string' || !metadata.sourceUrl.trim()) {
		throw new TypeError('metadata.sourceUrl is required')
	}
	openDb(app)
	if (!drizzleDb) throw new Error('Drizzle not initialized')
	const sourceUrl = metadata.sourceUrl.trim()
	const id = crypto.randomUUID()
	const now = Date.now()
	const provider = typeof metadata.provider === 'string' ? metadata.provider : 'unknown'
	const title = typeof metadata.title === 'string' ? metadata.title : null
	const payloadJson = JSON.stringify(metadata)
	drizzleDb
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
	return { ok: true }
}

/**
 * Deletes the row matching `source_url` (trimmed).
 *
 * @param {import('electron').App} app - Electron app instance.
 * @param {string} sourceUrl - Same URL key as {@link libraryUpsert}.
 * @returns {{ ok: true, changes: number }} `changes` is SQLite rows affected (0 if none).
 * @throws {TypeError} If `sourceUrl` is not a non-empty string.
 */
function libraryDelete(app, sourceUrl) {
	if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
		throw new TypeError('sourceUrl is required')
	}
	openDb(app)
	if (!drizzleDb) throw new Error('Drizzle not initialized')
	const result = drizzleDb.delete(libraryItem).where(eq(libraryItem.sourceUrl, sourceUrl.trim())).run()
	return { ok: true, changes: result.changes }
}

module.exports = {
	getDbPath,
	openDb,
	closeDb,
	libraryList,
	libraryUpsert,
	libraryDelete
}
