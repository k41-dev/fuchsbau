import { eq, and } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence } from '../../infrastructure/db/schema';

export class CancelAbsenceUseCase {
	async execute(userId: string) {
		const today = new Date().toISOString().slice(0, 10);

		const result = await db
			.delete(absence)
			.where(and(eq(absence.userId, userId), eq(absence.date, today)))
			.returning();

		if (result.length === 0) {
			throw new Error('No absence reported for today');
		}

		return result[0];
	}
}