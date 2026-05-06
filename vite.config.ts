import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	/** Match `electron/main.cjs` + `wait-on` so dev URL is stable */
	server: {
		host: '127.0.0.1',
		port: 5173,
		strictPort: true
	}
});
