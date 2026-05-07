import {
	collectionPatchToDb,
	collectionToDbRow,
	tagPatchToDb,
	tagToDbInsert
} from '$lib/lib/types.db'

type RoostDbDomain = 'collections' | 'items' | 'settings' | 'tags' | 'utils'

function getElectronApi() {
	if (typeof window === 'undefined') return undefined
	return window.electronAPI
}

/**
 * Renderer-only facade over `electronAPI.dbInvoke` (`db-api` IPC).
 * Naming: `db.<resource>.<action>(...)` maps to main-process method names.
 */
export class DBManager {
	get isAvailable(): boolean {
		const api = getElectronApi()
		return typeof api?.dbInvoke === 'function'
	}

	private async call(domain: RoostDbDomain, backendMethod: string, ...args: unknown[]): Promise<unknown> {
		const api = getElectronApi()
		if (typeof api?.dbInvoke !== 'function') {
			throw new Error('DBManager: not in Electron or electronAPI.dbInvoke missing (preload)')
		}
		const res = await api.dbInvoke(domain, backendMethod, ...args)
		if (!res.ok) throw new Error(res.error)
		return res.data
	}

	readonly collections = {
		list: () => {
			return this.call('collections', 'listCollections')
		},
		get: (id: string) => {
			return this.call('collections', 'getCollectionById', id)
		},
		insert: (collection: Collection) => {
			return this.call('collections', 'insertCollection', collectionToDbRow(collection))
		},
		update: (id: string, collection: Collection) => {
			return this.call('collections', 'updateCollection', id, collectionToDbRow(collection))
		},
		patch: (id: string, patch: Partial<Collection>) => {
			return this.call('collections', 'updateCollection', id, collectionPatchToDb(patch))
		},
		delete: (id: string) => {
			return this.call('collections', 'deleteCollection', id)
		}
	}

	readonly favorites = {
		list: () => {
			return this.call('collections', 'listFavorites')
		},
		get: (id: string) => {
			return this.call('collections', 'getFavoriteById', id)
		},
		insert: (row: unknown) => {
			return this.call('collections', 'insertFavorite', row)
		},
		update: (id: string, patch: unknown) => {
			return this.call('collections', 'updateFavorite', id, patch)
		},
		delete: (id: string) => {
			return this.call('collections', 'deleteFavorite', id)
		}
	}

	readonly collectionOrder = {
		list: (bucketKey: string) => {
			return this.call('collections', 'listCollectionOrder', bucketKey)
		},
		replace: (bucketKey: string, rows: unknown) => {
			return this.call('collections', 'replaceCollectionOrder', bucketKey, rows)
		},
		clear: (bucketKey: string) => {
			return this.call('collections', 'deleteCollectionOrderForBucket', bucketKey)
		}
	}

	readonly libraryItems = {
		list: () => {
			return this.call('items', 'listLibraryItems')
		},
		get: (id: string) => {
			return this.call('items', 'getLibraryItemById', id)
		},
		getBySourceUrl: (sourceUrl: string) => {
			return this.call('items', 'getLibraryItemBySourceUrl', sourceUrl)
		},
		insert: (row: unknown) => {
			return this.call('items', 'insertLibraryItem', row)
		},
		update: (id: string, patch: unknown) => {
			return this.call('items', 'updateLibraryItem', id, patch)
		},
		delete: (id: string) => {
			return this.call('items', 'deleteLibraryItemById', id)
		},
		deleteBySourceUrl: (sourceUrl: string) => {
			return this.call('items', 'deleteLibraryItemBySourceUrl', sourceUrl)
		},
		upsertFromMetadata: (metadata: unknown) => {
			return this.call('items', 'upsertLibraryItemFromMetadata', metadata)
		},
		listOrder: (scopeKey: string) => {
			return this.call('items', 'listLibraryItemOrderByScope', scopeKey)
		},
		replaceOrder: (scopeKey: string, rows: unknown) => {
			return this.call('items', 'replaceLibraryItemOrderForScope', scopeKey, rows)
		},
		clearOrder: (scopeKey: string) => {
			return this.call('items', 'deleteLibraryItemOrderForScope', scopeKey)
		}
	}

	readonly users = {
		list: () => {
			return this.call('settings', 'listUsers')
		},
		get: (id: string) => {
			return this.call('settings', 'getUserById', id)
		},
		insert: (row: unknown) => {
			return this.call('settings', 'insertUser', row)
		},
		update: (id: string, patch: unknown) => {
			return this.call('settings', 'updateUser', id, patch)
		},
		upsert: (row: unknown) => {
			return this.call('settings', 'upsertUser', row)
		},
		delete: (id: string) => {
			return this.call('settings', 'deleteUser', id)
		}
	}

	readonly tags = {
		list: (collectionId: string) => {
			return this.call('tags', 'listTagsByCollection', collectionId)
		},
		get: (id: string) => {
			return this.call('tags', 'getTagById', id)
		},
		insert: (tag: Tag) => {
			return this.call('tags', 'insertTag', tagToDbInsert(tag))
		},
		patch: (id: string, patch: Partial<Tag>) => {
			return this.call('tags', 'updateTag', id, tagPatchToDb(patch))
		},
		delete: (id: string) => {
			return this.call('tags', 'deleteTag', id)
		},
		listOrder: (collectionId: string) => {
			return this.call('tags', 'listTagOrderByCollection', collectionId)
		},
		replaceOrder: (collectionId: string, rows: unknown) => {
			return this.call('tags', 'replaceTagOrder', collectionId, rows)
		},
		clearOrder: (collectionId: string) => {
			return this.call('tags', 'deleteTagOrderForCollection', collectionId)
		}
	}

	readonly media = {
		list: () => {
			return this.call('utils', 'listMedia')
		},
		get: (id: string) => {
			return this.call('utils', 'getMediaById', id)
		},
		insert: (row: unknown) => {
			return this.call('utils', 'insertMedia', row)
		},
		update: (id: string, patch: unknown) => {
			return this.call('utils', 'updateMedia', id, patch)
		},
		delete: (id: string) => {
			return this.call('utils', 'deleteMedia', id)
		}
	}
}

export const db = new DBManager()
