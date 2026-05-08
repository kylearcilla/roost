import {
	collectionPatchToDb,
	collectionToDbRow,
	favoritePatchToDb,
	favoriteToDbInsert,
	tagPatchToDb,
	tagToDbInsert,
	userPatchToDb,
	userToDbInsert
} from '$lib/lib/types.db'
import type { LibraryItemInsert } from '$shared/db/items.schema'
import type { MediaInsert } from '$shared/db/utils.schema'

type RoostDbDomain = 'collections' | 'items' | 'settings' | 'tags' | 'utils'

/** Same shape as app `ReorderItemPayload` / main `updateIndices` args. */
type ReorderIdxPayload = { id: string; idx: number }[]

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
		},
		updateIndices: (changes: ReorderIdxPayload) => {
			return this.call('collections', 'updateIndices', changes)
		}
	}

	readonly favorites = {
		list: () => {
			return this.call('collections', 'listFavorites')
		},
		get: (id: string) => {
			return this.call('collections', 'getFavoriteById', id)
		},
		insert: (favorite: FavoriteFolder) => {
			return this.call('collections', 'insertFavorite', favoriteToDbInsert(favorite))
		},
		update: (id: string, patch: Partial<FavoriteFolder>) => {
			return this.call('collections', 'updateFavorite', id, favoritePatchToDb(patch))
		},
		delete: (id: string) => {
			return this.call('collections', 'deleteFavorite', id)
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
		insert: (row: LibraryItemInsert) => {
			return this.call('items', 'insertLibraryItem', row)
		},
		update: (id: string, patch: Partial<LibraryItemInsert>) => {
			return this.call('items', 'updateLibraryItem', id, patch)
		},
		delete: (id: string) => {
			return this.call('items', 'deleteLibraryItemById', id)
		},
		deleteBySourceUrl: (sourceUrl: string) => {
			return this.call('items', 'deleteLibraryItemBySourceUrl', sourceUrl)
		},
		deleteOrderScopesForCollection: (collectionId: string, tagIds: string[]) => {
			return this.call('items', 'deleteOrderScopesForCollection', collectionId, tagIds)
		},
		upsertFromMetadata: (metadata: unknown) => {
			return this.call('items', 'upsertLibraryItemFromMetadata', metadata)
		},
		updateIndices: (scopeKey: string, changes: ReorderIdxPayload) => {
			return this.call('items', 'updateIndices', scopeKey, changes)
		}
	}

	readonly users = {
		list: () => {
			return this.call('settings', 'listUsers')
		},
		get: (id: string) => {
			return this.call('settings', 'getUserById', id)
		},
		insert: (user: User) => {
			return this.call('settings', 'insertUser', userToDbInsert(user))
		},
		update: (id: string, patch: Partial<User>) => {
			return this.call('settings', 'updateUser', id, userPatchToDb(patch))
		},
		upsert: (user: User) => {
			return this.call('settings', 'upsertUser', userToDbInsert(user))
		},
		delete: (id: string) => {
			return this.call('settings', 'deleteUser', id)
		}
	}

	readonly tags = {
		listAll: () => {
			return this.call('tags', 'listTagsAll')
		},
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
		updateIndices: (collectionId: string, changes: ReorderIdxPayload) => {
			return this.call('tags', 'updateIndices', collectionId, changes)
		}
	}

	readonly media = {
		list: () => {
			return this.call('utils', 'listMedia')
		},
		get: (id: string) => {
			return this.call('utils', 'getMediaById', id)
		},
		insert: (row: MediaInsert) => {
			return this.call('utils', 'insertMedia', row)
		},
		update: (id: string, patch: Partial<MediaInsert>) => {
			return this.call('utils', 'updateMedia', id, patch)
		},
		delete: (id: string) => {
			return this.call('utils', 'deleteMedia', id)
		}
	}
}

export const db = new DBManager()
