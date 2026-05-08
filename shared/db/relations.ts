import { relations } from 'drizzle-orm'
import { collection, collectionOrder, favorite } from './collections.schema'
import { libraryItem, libraryItemOrder } from './items.schema'
import { tag, tagOrder } from './tags.schema'
import { media } from './utils.schema'

export const collectionRelations = relations(collection, ({ one, many }) => ({
	wallpaper: one(media, {
		fields: [collection.wallpaperId],
		references: [media.id]
	}),
	tags: many(tag),
	favorites: many(favorite),
	orderRows: many(collectionOrder),
	tagOrderRows: many(tagOrder)
}))

export const mediaRelations = relations(media, ({ many }) => ({
	collectionsWithWallpaper: many(collection)
}))

export const favoriteRelations = relations(favorite, ({ one }) => ({
	collection: one(collection, {
		fields: [favorite.collectionId],
		references: [collection.id]
	})
}))

export const collectionOrderRelations = relations(collectionOrder, ({ one }) => ({
	collection: one(collection, {
		fields: [collectionOrder.collectionId],
		references: [collection.id]
	})
}))

export const tagRelations = relations(tag, ({ one, many }) => ({
	collection: one(collection, {
		fields: [tag.collectionId],
		references: [collection.id]
	}),
	orderSlots: many(tagOrder)
}))

export const tagOrderRelations = relations(tagOrder, ({ one }) => ({
	collection: one(collection, {
		fields: [tagOrder.collectionId],
		references: [collection.id]
	}),
	tag: one(tag, {
		fields: [tagOrder.tagId],
		references: [tag.id]
	})
}))

export const libraryItemRelations = relations(libraryItem, ({ many }) => ({
	scopeOrderRows: many(libraryItemOrder)
}))

export const libraryItemOrderRelations = relations(libraryItemOrder, ({ one }) => ({
	item: one(libraryItem, {
		fields: [libraryItemOrder.libraryItemId],
		references: [libraryItem.id]
	})
}))
