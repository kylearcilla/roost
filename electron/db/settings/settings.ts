import { eq } from 'drizzle-orm'
import { db } from '../context'
import { user } from './settings.schema'
import type { UserInsert, UserRow } from './settings.schema'

export { user } from './settings.schema'
export type { UserInsert, UserRow } from './settings.schema'

export function listUsers(): UserRow[] {
	return db().select().from(user).all()
}

export function getUserById(id: string): UserRow | undefined {
	return db().select().from(user).where(eq(user.id, id)).get()
}

export function insertUser(row: UserInsert): UserRow {
	return db().insert(user).values(row).returning().get()
}

export function updateUser(id: string, patch: Partial<UserInsert>): UserRow | undefined {
	return db().update(user).set(patch).where(eq(user.id, id)).returning().get()
}

/** Insert or replace row with the same primary key. */
export function upsertUser(row: UserInsert): UserRow {
	return db()
		.insert(user)
		.values(row)
		.onConflictDoUpdate({
			target: user.id,
			set: {
				displayName: row.displayName,
				avatarUrl: row.avatarUrl
			}
		})
		.returning()
		.get()
}

export function deleteUser(id: string): { changes: number } {
	return db().delete(user).where(eq(user.id, id)).run()
}
