import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

/** `ROOST_LIBRARY_DB` is set by `npm run db:*` (see `electron/scripts/run-drizzle-kit-app-db.mjs`). */
function dbCredentialsUrl(): string {
	const raw = process.env.ROOST_LIBRARY_DB?.trim()
	if (!raw) {
		throw new Error(
			'Missing ROOST_LIBRARY_DB. Use npm run db:generate | db:migrate | db:studio (or set ROOST_LIBRARY_DB to your roost-library.db path).'
		)
	}
	if (raw.startsWith('file:')) return raw
	/** Plain absolute path — not `pathToFileURL` (drizzle-kit strips `file:` with `.substring(5)` and would leave `%20` in `Application Support`). */
	const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
	return abs
}

export default defineConfig({
	schema: './shared/db/schema.ts',
	out: './electron/db/migrations',
	dialect: 'sqlite',
	strict: true,
	dbCredentials: {
		url: dbCredentialsUrl()
	}
})
