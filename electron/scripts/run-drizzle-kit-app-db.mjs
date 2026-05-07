/**
 * Launches drizzle kit against the app's library database (same as electron app)
 * If `ROOST_LIBRARY_DB` is already set, uses that path instead (no Electron).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function binDirCmd(name) {
	const win = process.platform === 'win32'
	if (name === 'electron') return path.join(root, 'node_modules', '.bin', win ? 'electron.cmd' : 'electron')
	return path.join(root, 'node_modules', '.bin', win ? `${name}.cmd` : name)
}

const args = process.argv.slice(2)
if (args.length === 0) {
	process.stderr.write('usage: node electron/scripts/run-drizzle-kit-app-db.mjs <drizzle-kit-args…>\n')
	process.exit(1)
}

let dbPath = process.env.ROOST_LIBRARY_DB?.trim()
if (!dbPath) {
	const printScript = path.join(root, 'electron', 'scripts', 'print-user-data-db.cjs')
	const el = spawnSync(binDirCmd('electron'), [printScript], { cwd: root, encoding: 'utf8' })
	if (el.status !== 0) {
		process.stderr.write(el.stderr || 'electron print-user-data-db failed\n')
		process.exit(el.status ?? 1)
	}
	dbPath = el.stdout.trim()
}

function fsPathForMkdir(raw) {
	if (raw.startsWith('file:')) return fileURLToPath(new URL(raw))
	if (path.isAbsolute(raw)) return raw
	return path.resolve(root, raw)
}

fs.mkdirSync(path.dirname(fsPathForMkdir(dbPath)), { recursive: true })

const dk = spawnSync(binDirCmd('drizzle-kit'), args, {
	cwd: root,
	stdio: 'inherit',
	env: { ...process.env, ROOST_LIBRARY_DB: dbPath }
})
process.exit(dk.status ?? 1)
