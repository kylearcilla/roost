import path from 'node:path'
import { fileURLToPath } from 'node:url'
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		/** Electron `app://` origin: pathname routing is flaky; hash keeps the document URL path stable (`/`). */
		router: {
			type: 'hash'
		},
		/** Works with `file://` and custom protocols when packaged in Electron */
		paths: {
			relative: true
		},
		alias: {
			$shared: path.resolve(__dirname, 'shared')
		}
	}
}

export default config
