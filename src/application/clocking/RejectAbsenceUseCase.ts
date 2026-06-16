import { and, eq } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence } from '../../infrastructure/db/schema';
import { assertCanReviewWorkerAbsence } from '../../lib/server/absence-review';

export class RejectAbsenceUseCase {
	async execute(params: {
		requestGroupId: string;
		reviewedByUserId: string;
		reviewNote?: string | null;
	}) {
		const rows = await db
			.select()
			.from(absence)
			.where(
				and(eq(absence.requestGroupId, params.requestGroupId), eq(absence.status, 'pending'))
			);

		if (rows.length === 0) {
			throw new Error('No pending absence request found');
		}

		await assertCanReviewWorkerAbsence(params.reviewedByUserId, rows[0].userId);

		const reviewedAt = new Date();
		const reviewNote = params.reviewNote?.trim() || null;

		await db
			.update(absence)
			.set({
				status: 'rejected',
				reviewedByUserId: params.reviewedByUserId,
				reviewedAt,
				reviewNote
			})
			.where(
				and(eq(absence.requestGroupId, params.requestGroupId), eq(absence.status, 'pending'))
			);

		return rows.length;
	}
}