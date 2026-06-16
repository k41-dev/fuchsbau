import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ApproveAbsenceUseCase } from './ApproveAbsenceUseCase';
import { RejectAbsenceUseCase } from './RejectAbsenceUseCase';
import { ClockInUseCase } from './ClockInUseCase';
import { ReportAbsenceUseCase } from './ReportAbsenceUseCase';
import { DrizzleTimeEntryRepository } from '../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { db } from '../../infrastructure/db/client';
import { absence, project, projectMember } from '../../infrastructure/db/schema';
import {
	createTestUser,
	deleteAbsencesForUser,
	deleteTestUsers,
	deleteTimeEntriesForUser,
	hasDatabaseUrl
} from '../../test/db-helpers';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('absence approval', () => {
	const timeEntryRepo = new DrizzleTimeEntryRepository();
	const clockInUseCase = new ClockInUseCase(timeEntryRepo);
	const reportAbsenceUseCase = new ReportAbsenceUseCase(timeEntryRepo);
	const approveAbsenceUseCase = new ApproveAbsenceUseCase();
	const rejectAbsenceUseCase = new RejectAbsenceUseCase();

	const suffix = `absence-approval-${Date.now()}`;
	let ownerId = '';
	let workerId = '';
	let projectId = 0;

	beforeAll(async () => {
		const owner = await createTestUser(`${suffix}-owner`);
		const worker = await createTestUser(`${suffix}-worker`);
		ownerId = owner.id;
		workerId = worker.id;

		const [createdProject] = await db
			.insert(project)
			.values({
				name: `Absence approval ${suffix}`,
				userId: ownerId
			})
			.returning();

		projectId = createdProject.id;

		await db.insert(projectMember).values({
			projectId,
			userId: workerId
		});
	});

	afterAll(async () => {
		await deleteTimeEntriesForUser(workerId);
		await deleteAbsencesForUser(workerId);
		await db.delete(projectMember).where(eq(projectMember.projectId, projectId));
		await db.delete(project).where(eq(project.id, projectId));
		await deleteTestUsers([ownerId, workerId]);
	});

	it('creates pending sick leave and blocks clock-in only after approval', async () => {
		await deleteTimeEntriesForUser(workerId);
		await deleteAbsencesForUser(workerId);

		const rows = await reportAbsenceUseCase.execute({ userId: workerId, type: 'sick' });
		expect(rows[0].status).toBe('pending');

		await expect(clockInUseCase.execute({ userId: workerId, projectId })).resolves.toBeTruthy();
		await deleteTimeEntriesForUser(workerId);

		const approvedRows = await reportAbsenceUseCase.execute({ userId: workerId, type: 'sick' });
		await approveAbsenceUseCase.execute({
			requestGroupId: approvedRows[0].requestGroupId,
			reviewedByUserId: ownerId
		});

		await expect(clockInUseCase.execute({ userId: workerId, projectId })).rejects.toThrow(
			/approved absence today/i
		);

		await db.delete(absence).where(eq(absence.userId, workerId));
	});

	it('lets the site owner reject a vacation request', async () => {
		await deleteAbsencesForUser(workerId);

		const rows = await reportAbsenceUseCase.execute({
			userId: workerId,
			type: 'vacation',
			startDate: '2026-07-01',
			endDate: '2026-07-03'
		});

		expect(rows).toHaveLength(3);
		expect(rows.every((row) => row.status === 'pending')).toBe(true);

		const rejectedCount = await rejectAbsenceUseCase.execute({
			requestGroupId: rows[0].requestGroupId,
			reviewedByUserId: ownerId,
			reviewNote: 'Coverage needed'
		});

		expect(rejectedCount).toBe(3);

		const stored = await db.select().from(absence).where(eq(absence.userId, workerId));
		expect(stored.every((row) => row.status === 'rejected')).toBe(true);
		expect(stored[0].reviewNote).toBe('Coverage needed');

		await deleteAbsencesForUser(workerId);
	});

	it('rejects approval from non-owners', async () => {
		await deleteAbsencesForUser(workerId);

		const rows = await reportAbsenceUseCase.execute({ userId: workerId, type: 'sick' });

		await expect(
			approveAbsenceUseCase.execute({
				requestGroupId: rows[0].requestGroupId,
				reviewedByUserId: workerId
			})
		).rejects.toThrow(/job site owner/i);

		await deleteAbsencesForUser(workerId);
	});
});