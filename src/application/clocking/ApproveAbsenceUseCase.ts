import { and, eq } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence } from '../../infrastructure/db/schema';
import { assertCanReviewWorkerAbsence } from '../../lib/server/absence-review';

export class ApproveAbsenceUseCase {
	async execute(params: { requestGroupId: string; reviewedByUserId: string }) {
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

		await db
			.update(absence)
			.set({
				status: 'approved',
				reviewedByUserId: params.reviewedByUserId,
				reviewedAt
			})
			.where(
				and(eq(absence.requestGroupId, params.requestGroupId), eq(absence.status, 'pending'))
			);

		return rows.length;
	}
}