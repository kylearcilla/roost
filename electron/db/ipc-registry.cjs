/**
 * Loads Drizzle CRUD modules (same process as `openDb` / `context.setRoostDb`) and dispatches
 * `{ domain, method, args }` from `ipcMain.handle('db-api', …)` in `main.cjs`.
 *
 * Only **function** exports from each module are callable (skips e.g. `user` table re-export).
 *
 * @module electron/db/ipc-registry
 */

const jiti = require('jiti')(__filename)
const collections = jiti('./collections/collections.ts')
const items = jiti('./items/items.ts')
const settings = jiti('./settings/settings.ts')
const tags = jiti('./tags/tags.ts')
const utils = jiti('./utils/utils.ts')

const modules = { collections, items, settings, tags, utils }

/** @type {Record<string, Record<string, (...args: unknown[]) => unknown>>} */
const registry = {}
for (const [domain, mod] of Object.entries(modules)) {
	const map = {}
	for (const [name, value] of Object.entries(mod)) {
		if (typeof value === 'function') map[name] = value
	}
	registry[domain] = map
}

/**
 * @param {string} domain - `collections` | `items` | `settings` | `tags` | `utils`
 * @param {string} method - export name on that module
 * @param {unknown[]} [args] - JSON-serializable args forwarded to the function
 * @returns {unknown} Return value (cloned through IPC structured clone)
 */
function invoke(domain, method, args = []) {
	if (typeof domain !== 'string' || typeof method !== 'string') {
		throw new TypeError('domain and method must be strings')
	}
	if (!Array.isArray(args)) throw new TypeError('args must be an array')
	const mod = registry[domain]
	if (!mod) throw new TypeError(`Unknown db domain: ${domain}`)
	const fn = mod[method]
	if (!fn) throw new TypeError(`Unknown db method: ${domain}.${method}`)
	return fn(...args)
}

module.exports = { invoke }
