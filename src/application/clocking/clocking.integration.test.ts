import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClockInUseCase } from './ClockInUseCase';
import { ReportAbsenceUseCase } from './ReportAbsenceUseCase';
import { CancelAbsenceUseCase } from './CancelAbsenceUseCase';
import { DrizzleTimeEntryRepository } from '../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { todayString } from '../../lib/absence';
import {
	createTestUser,
	deleteAbsencesForUser,
	deleteTestUsers,
	deleteTimeEntriesForUser,
	hasDatabaseUrl
} from '../../test/db-helpers';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('clocking use cases', () => {
	const timeEntryRepo = new DrizzleTimeEntryRepository();
	const clockInUseCase = new ClockInUseCase(timeEntryRepo);
	const reportAbsenceUseCase = new ReportAbsenceUseCase(timeEntryRepo);
	const cancelAbsenceUseCase = new CancelAbsenceUseCase();

	const suffix = `tier1-${Date.now()}`;
	let userId = '';

	beforeAll(async () => {
		const user = await createTestUser(suffix);
		userId = user.id;
	});

	afterAll(async () => {
		await deleteTestUsers([userId]);
	});

	it('creates pending sick leave that does not block clock-in until approved', async () => {
		await deleteTimeEntriesForUser(userId);
		await deleteAbsencesForUser(userId);

		const rows = await reportAbsenceUseCase.execute({ userId, type: 'sick' });
		expect(rows[0].status).toBe('pending');

		await expect(clockInUseCase.execute({ userId, projectId: null })).resolves.toBeTruthy();

		await deleteTimeEntriesForUser(userId);
		await deleteAbsencesForUser(userId);
	});

	it('books multi-day vacation and rejects overlapping days', async () => {
		await deleteAbsencesForUser(userId);

		const today = todayString();
		const rows = await reportAbsenceUseCase.execute({
			userId,
			type: 'vacation',
			startDate: today,
			endDate: today
		});

		expect(rows).toHaveLength(1);
		expect(rows[0].type).toBe('vacation');
		expect(rows[0].status).toBe('pending');

		await expect(
			reportAbsenceUseCase.execute({
				userId,
				type: 'sick',
				startDate: today,
				endDate: today
			})
		).rejects.toThrow('already have an absence');

		await deleteAbsencesForUser(userId);
	});
});