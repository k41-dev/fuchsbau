import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence } from '../../infrastructure/db/schema';
import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import {
	type AbsenceType,
	ABSENCE_TYPES,
	eachDateInRange,
	todayString
} from '../../lib/absence';

export class ReportAbsenceUseCase {
	constructor(private readonly timeEntryRepository: TimeEntryRepository) {}

	async execute(params: {
		userId: string;
		type: AbsenceType;
		note?: string | null;
		startDate?: string;
		endDate?: string;
	}) {
		if (!ABSENCE_TYPES.includes(params.type)) {
			throw new Error('Invalid absence type');
		}

		const activeEntry = await this.timeEntryRepository.findActiveByUserId(params.userId);
		if (activeEntry) {
			throw new Error('Clock out before reporting an absence');
		}

		const today = todayString();
		const startDate = params.type === 'sick' ? today : (params.startDate ?? today);
		const endDate = params.type === 'sick' ? today : (params.endDate ?? startDate);

		if (endDate < startDate) {
			throw new Error('End date must be on or after start date');
		}

		const dates = eachDateInRange(startDate, endDate);
		if (dates.length === 0) {
			throw new Error('Invalid date range');
		}
		if (params.type === 'vacation' && dates.length > 60) {
			throw new Error('Vacation cannot exceed 60 days at once');
		}

		const existing = await db
			.select({ date: absence.date })
			.from(absence)
			.where(
				and(
					eq(absence.userId, params.userId),
					inArray(absence.date, dates),
					inArray(absence.status, ['pending', 'approved'])
				)
			);

		if (existing.length > 0) {
			throw new Error(`You already have an absence on ${existing[0].date}`);
		}

		const requestGroupId = crypto.randomUUID();

		const rows = await db
			.insert(absence)
			.values(
				dates.map((date) => ({
					userId: params.userId,
					date,
					type: params.type,
					status: 'pending' as const,
					requestGroupId,
					note: params.note ?? null
				}))
			)
			.returning();

		return rows;
	}
}