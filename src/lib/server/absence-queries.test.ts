import { describe, expect, it } from 'vitest';
import { summarizeAbsences, type CrewAbsence } from './absence-queries';

describe('summarizeAbsences', () => {
	it('aggregates sick and vacation days per worker', () => {
		const absences: CrewAbsence[] = [
			{
				userId: 'u1',
				userName: 'Alex',
				userEmail: 'alex@test',
				date: '2026-06-16',
				type: 'sick',
				note: null
			},
			{
				userId: 'u1',
				userName: 'Alex',
				userEmail: 'alex@test',
				date: '2026-06-17',
				type: 'vacation',
				note: null
			},
			{
				userId: 'u2',
				userName: 'Bea',
				userEmail: 'bea@test',
				date: '2026-06-16',
				type: 'vacation',
				note: null
			}
		];

		expect(summarizeAbsences(absences)).toEqual([
			{
				userId: 'u1',
				userName: 'Alex',
				userEmail: 'alex@test',
				sickDays: 1,
				vacationDays: 1
			},
			{
				userId: 'u2',
				userName: 'Bea',
				userEmail: 'bea@test',
				sickDays: 0,
				vacationDays: 1
			}
		]);
	});
});