/**
 * One-shot: print absolute path to `roost-library.db` (same as `openDb` in `db/initial.cjs`).
 * Run via `electron electron/scripts/print-user-data-db.cjs` from repo root.
 */
const path = require('node:path')
const { app } = require('electron')

app.whenReady().then(() => {
	process.stdout.write(path.join(app.getPath('userData'), 'roost-library.db'))
	app.exit(0)
})
