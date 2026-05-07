/**
 * Dev entry: one Node parent spawns Vite, waits for 5173, optionally rebuilds native, then spawns Electron.
 * Avoids `concurrently -k` + shell pipelines (odd signal / SIGKILL interactions on some macOS setups).
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const wantRebuild = process.argv.includes('--rebuild')
const isWin = process.platform === 'win32'

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms))
}

function waitForVite(url, maxMs = 120_000) {
	const deadline = Date.now() + maxMs
	return new Promise((resolve, reject) => {
		function tryOnce() {
			if (Date.now() > deadline) {
				reject(new Error('Timeout waiting for Vite at ' + url))
				return
			}
			const req = http.get(url, { timeout: 2000 }, (res) => {
				res.resume()
				resolve()
			})
			req.on('error', () => setTimeout(tryOnce, 250))
			req.on('timeout', () => {
				req.destroy()
				setTimeout(tryOnce, 250)
			})
		}
		tryOnce()
	})
}

function run(cmd, args, opts = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: root,
			stdio: 'inherit',
			shell: isWin,
			...opts
		})
		child.on('error', reject)
		child.on('close', (code) => {
			if (code === 0) resolve()
			else reject(new Error(cmd + ' ' + args.join(' ') + ' exited ' + code))
		})
	})
}

const viteCmd = isWin ? 'npx.cmd' : 'npx'
const vite = spawn(viteCmd, ['vite', 'dev'], { cwd: root, stdio: 'inherit', shell: isWin })

vite.on('error', (err) => {
	console.error(err)
	process.exit(1)
})

try {
	await waitForVite('http://127.0.0.1:5173/')
	await sleep(400)
	if (wantRebuild) {
		await run('npm', ['run', 'electron:rebuild'], { shell: true })
		await sleep(200)
	}
} catch (e) {
	console.error(e)
	vite.kill('SIGTERM')
	process.exit(1)
}

const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js')
const el = spawn(process.execPath, [electronCli, '.'], {
	cwd: root,
	stdio: 'inherit',
	env: { ...process.env, ELECTRON_DEV: '1' }
})

el.on('error', (err) => {
	console.error(err)
	vite.kill('SIGTERM')
	process.exit(1)
})

function shutdown() {
	vite.kill('SIGTERM')
	el.kill('SIGTERM')
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

el.on('close', (code, signal) => {
	if (signal) console.error('[electron]', signal)
	vite.kill('SIGTERM')
	process.exit(code ?? 1)
})

vite.on('close', (code) => {
	if (code !== 0 && code !== null) {
		el.kill('SIGTERM')
		process.exit(code ?? 1)
	}
})
