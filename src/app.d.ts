// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface ImportMetaEnv {
	readonly VITE_USE_MOCK_DATA?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

/** Result of `electronAPI.dbInvoke` (main `db-api` IPC). */
type RoostDbIpcResult<T = unknown> =
	| { ok: true; data: T }
	| { ok: false; error: string }

type RoostDbDomain = 'collections' | 'items' | 'settings' | 'tags' | 'utils'

declare global {
	interface Window {
		/** Electron preload: main `net.fetch`, no CORS */
		electronAPI?: {
			/** Returns a plain payload; `fetch-content` builds `Response` in the renderer. */
			fetchMetadata: (
				url: string,
				init?: RequestInit & { timeoutMs?: number }
			) => Promise<{
				__roostNet: true
				body: string
				status: number
				headers: Record<string, string>
			}>
			/** Main-process SQLite (`userData/roost-library.db`). */
			libraryList: () => Promise<
				| {
						ok: true
						items: Array<{
							id: string
							sourceUrl: string
							provider: string
							title: string | null
							fetchedAt: number
							metadata: import('./lib/lib/fetch-content').FetchedContentMetadata
						}>
				  }
				| { ok: false; error: string }
			>
			libraryUpsert: (
				metadata: import('./lib/lib/fetch-content').FetchedContentMetadata
			) => Promise<{ ok: true } | { ok: false; error: string }>
			libraryDelete: (sourceUrl: string) => Promise<
				{ ok: true; changes: number } | { ok: false; error: string }
			>
			/** `db-api` IPC: `{ domain, method, args }` → Drizzle modules under `electron/db/`. */
			dbInvoke: (
				domain: RoostDbDomain,
				method: string,
				...args: unknown[]
			) => Promise<RoostDbIpcResult>
		}
		roost?: {
			isElectron: boolean
			insetTitleBar: boolean
		}
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
