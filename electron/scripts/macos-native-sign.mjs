/**
 * macOS: strip quarantine xattrs and ad-hoc sign native `.node` addons so Electron
 * does not hit `CODE SIGNING: cs_invalid_page … denying page sending SIGKILL` when
 * loading `better-sqlite3` (see kernel log). No-op on non-macOS.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') process.exit(0)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(import.meta.url)

function xattrCr(p) {
	if (fs.existsSync(p)) {
		execFileSync('xattr', ['-cr', p], { stdio: 'inherit' })
	}
}

function walkNodeFiles(dir, out = []) {
	if (!fs.existsSync(dir)) return out
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, ent.name)
		if (ent.isDirectory()) walkNodeFiles(full, out)
		else if (ent.name.endsWith('.node')) out.push(full)
	}
	return out
}

function codesignAdHoc(target) {
	execFileSync('codesign', ['--sign', '-', '--force', target], { stdio: 'inherit' })
}

// Electron.app: strip quarantine, ad-hoc sign main binary (helps some cs_invalid_page cases with local addons)
const electronBin = require('electron')
const electronApp = path.resolve(electronBin, '..', '..', '..')
xattrCr(electronApp)
codesignAdHoc(electronBin)

// better-sqlite3 (xattr + every .node under the package)
const bs3 = path.join(root, 'node_modules', 'better-sqlite3')
xattrCr(bs3)
for (const nodePath of walkNodeFiles(bs3)) {
	codesignAdHoc(nodePath)
}
