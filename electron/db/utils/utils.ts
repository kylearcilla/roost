import { eq } from 'drizzle-orm'
import { db } from '../context'
import { media } from './utils.schema'
import type { MediaInsert, MediaRow } from './utils.schema'

export function listMedia(): MediaRow[] {
	return db().select().from(media).all()
}

export function getMediaById(id: string): MediaRow | undefined {
	return db().select().from(media).where(eq(media.id, id)).get()
}

export function insertMedia(row: MediaInsert): MediaRow {
	return db().insert(media).values(row).returning().get()
}

export function updateMedia(id: string, patch: Partial<MediaInsert>): MediaRow | undefined {
	return db().update(media).set(patch).where(eq(media.id, id)).returning().get()
}

export function deleteMedia(id: string): { changes: number } {
	return db().delete(media).where(eq(media.id, id)).run()
}
