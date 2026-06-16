import { eq, inArray } from 'drizzle-orm';
import { db } from '../infrastructure/db/client';
import { absence, timeEntry, user } from '../infrastructure/db/schema';

export async function createTestUser(suffix: string) {
	const id = `test-${suffix}`;
	const email = `test-${suffix}@fuchsbau.test`;

	await db.insert(user).values({
		id,
		name: `Test ${suffix}`,
		email,
		emailVerified: true
	});

	return { id, email };
}

export async function deleteTestUsers(userIds: string[]) {
	if (userIds.length === 0) return;

	await db.delete(absence).where(inArray(absence.userId, userIds));
	await db.delete(timeEntry).where(inArray(timeEntry.userId, userIds));
	await db.delete(user).where(inArray(user.id, userIds));
}

export async function deleteAbsencesForUser(userId: string) {
	await db.delete(absence).where(eq(absence.userId, userId));
}

export async function deleteTimeEntriesForUser(userId: string) {
	await db.delete(timeEntry).where(eq(timeEntry.userId, userId));
}

export function hasDatabaseUrl(): boolean {
	return Boolean(process.env.DATABASE_URL);
}