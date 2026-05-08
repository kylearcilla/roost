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
			/** Finder / Explorer: open `userData` folder, `roost-library.db` selected when it exists. */
			revealUserDataInFileManager: () => Promise<{ ok: true } | { ok: false; error: string }>
			/** Copy into `<Electron userData>/media/...` (never references external paths). Use `sourceAbsolutePath` or `buffer`. */
			saveImportedMedia: (payload: {
				buffer?: ArrayBuffer
				sourceAbsolutePath?: string
				mimeType?: string
				originalName?: string
				scope?: 'collection' | 'user'
				collectionId?: string
				collectionName?: string
			}) => Promise<{ ok: true; absolutePath: string } | { ok: false; error: string }>
			/** Native filesystem path for a real `File` (Electron); empty string if none. */
			getNativePathForFile?: (file: File) => string
			/** Stable `roost-media://` href for managed paths (avoids blocked `file://` under `http` dev). */
			roostMediaUrlFromPath?: (absolutePath: string) => string
			/** Removes a file under managed media dirs if path is allowed (no-op otherwise). */
			deleteImportedMedia: (payload: {
				absolutePath: string
			}) => Promise<{ ok: true } | { ok: false; error: string }>
			/** `fs.rm` recursive on `userData/media/<slug>-<id>/` (+ legacy root) when no `remainingMediaPaths` lie under it. */
			deleteCollectionMediaFolder: (payload: {
				collectionId: string
				collectionName?: string
				remainingMediaPaths?: string[]
			}) => Promise<{ ok: true; removed: number } | { ok: false; error: string }>
			/** On collection rename: `fs.rename` folder `…/media/<oldSlug>--<id>/` → `…/media/<newSlug>--<id>/` (+ legacy sources). */
			renameCollectionMediaFolder: (payload: {
				collectionId: string
				oldCollectionName: string
				newCollectionName: string
			}) => Promise<
				| { ok: true; renames: Array<{ from: string; to: string }> }
				| { ok: false; error: string }
			>
		}
		roost?: {
			isElectron: boolean
			insetTitleBar: boolean
			/** Absolute path: Electron `userData` (parent of `roost-library.db`). */
			userDataPath: string
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
