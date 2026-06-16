import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { CorrectTimeEntryUseCase } from './CorrectTimeEntryUseCase';
import { ClockInUseCase } from './ClockInUseCase';
import { DrizzleTimeEntryRepository } from '../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { db } from '../../infrastructure/db/client';
import { project, timeEntryCorrection } from '../../infrastructure/db/schema';
import {
	createTestUser,
	deleteTestUsers,
	deleteTimeEntriesForUser,
	hasDatabaseUrl
} from '../../test/db-helpers';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('CorrectTimeEntryUseCase', () => {
	const timeEntryRepo = new DrizzleTimeEntryRepository();
	const clockInUseCase = new ClockInUseCase(timeEntryRepo);
	const correctUseCase = new CorrectTimeEntryUseCase(timeEntryRepo);

	const suffix = `correct-${Date.now()}`;
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
				name: `Correction test ${suffix}`,
				userId: ownerId
			})
			.returning();

		projectId = createdProject.id;

		await clockInUseCase.execute({
			userId: workerId,
			projectId,
			startTime: new Date('2026-06-16T07:00:00')
		});
	});

	afterAll(async () => {
		await deleteTimeEntriesForUser(workerId);
		await db.delete(project).where(eq(project.id, projectId));
		await deleteTestUsers([ownerId, workerId]);
	});

	it('lets the site owner correct start and end times with audit trail', async () => {
		const active = await timeEntryRepo.findActiveByUserId(workerId);
		expect(active?.id).toBeTruthy();

		const corrected = await correctUseCase.execute({
			entryId: active!.id!,
			correctedByUserId: ownerId,
			startTime: new Date('2026-06-16T06:30:00'),
			endTime: new Date('2026-06-16T15:30:00'),
			reason: 'Forgot to clock out'
		});

		expect(corrected.isRunning).toBe(false);
		expect(corrected.duration).toBeGreaterThan(0);

		const audits = await db
			.select()
			.from(timeEntryCorrection)
			.where(eq(timeEntryCorrection.timeEntryId, active!.id!));

		expect(audits).toHaveLength(1);
		expect(audits[0].reason).toBe('Forgot to clock out');
		expect(audits[0].correctedByUserId).toBe(ownerId);
	});

	it('rejects corrections from non-owners', async () => {
		const entry = await timeEntryRepo.findByUserId(workerId, 1);
		const target = entry[0];
		expect(target?.id).toBeTruthy();

		await expect(
			correctUseCase.execute({
				entryId: target!.id!,
				correctedByUserId: workerId,
				startTime: new Date('2026-06-16T06:00:00'),
				endTime: new Date('2026-06-16T16:00:00'),
				reason: 'Self edit'
			})
		).rejects.toThrow(/job site owner/i);
	});
});