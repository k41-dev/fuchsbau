import { eq } from 'drizzle-orm';
import { TimeEntry } from '../../domain/entities/TimeEntry';
import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { db } from '../../infrastructure/db/client';
import { project, timeEntryCorrection } from '../../infrastructure/db/schema';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

export class CorrectTimeEntryUseCase {
	constructor(
		private readonly timeEntryRepository: TimeEntryRepository,
		private readonly breakRepository: DrizzleBreakRepository = new DrizzleBreakRepository()
	) {}

	async execute(params: {
		entryId: number;
		correctedByUserId: string;
		startTime: Date;
		endTime: Date | null;
		reason: string;
	}): Promise<TimeEntry> {
		const entry = await this.timeEntryRepository.findById(params.entryId);
		if (!entry?.id) {
			throw new Error('Time entry not found');
		}

		if (!entry.projectId) {
			throw new Error('Cannot correct an entry without a job site');
		}

		const [proj] = await db
			.select({ ownerId: project.userId })
			.from(project)
			.where(eq(project.id, entry.projectId))
			.limit(1);

		if (!proj || proj.ownerId !== params.correctedByUserId) {
			throw new Error('Only the job site owner can correct this entry');
		}

		const reason = params.reason.trim();
		if (!reason) {
			throw new Error('A reason is required');
		}

		if (params.endTime && params.endTime <= params.startTime) {
			throw new Error('End time must be after start time');
		}

		const isRunning = !params.endTime;
		let duration: number | null = null;

		if (!isRunning) {
			const breakSeconds = await this.breakRepository.getTotalBreakSeconds(entry.id, false);
			const gross = Math.floor(
				(params.endTime!.getTime() - params.startTime.getTime()) / 1000
			);
			duration = Math.max(0, gross - breakSeconds);
		}

		await db.insert(timeEntryCorrection).values({
			timeEntryId: entry.id,
			correctedByUserId: params.correctedByUserId,
			previousStartTime: entry.startTime,
			previousEndTime: entry.endTime,
			previousDuration: entry.duration,
			newStartTime: params.startTime,
			newEndTime: params.endTime,
			newDuration: duration,
			reason
		});

		const updated = new TimeEntry(
			entry.id,
			entry.userId,
			entry.projectId,
			entry.roleId,
			entry.description,
			params.startTime,
			params.endTime,
			duration,
			isRunning,
			entry.createdAt,
			new Date()
		);

		return this.timeEntryRepository.update(updated);
	}
}