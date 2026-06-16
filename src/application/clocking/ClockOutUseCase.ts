import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import type { TimeEntry } from '../../domain/entities/TimeEntry';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

export class ClockOutUseCase {
	constructor(
		private readonly timeEntryRepository: TimeEntryRepository,
		private readonly breakRepository: DrizzleBreakRepository = new DrizzleBreakRepository()
	) {}

	async execute(userId: string): Promise<TimeEntry> {
		const activeEntry = await this.timeEntryRepository.findActiveByUserId(userId);

		if (!activeEntry) {
			throw new Error('No active time entry found for this user.');
		}

		if (!activeEntry.isRunning) {
			throw new Error('Time entry is already stopped.');
		}

		const endTime = new Date();
		if (activeEntry.id) {
			await this.breakRepository.closeOpenBreaks(activeEntry.id, endTime);
		}

		const breakSeconds = activeEntry.id
			? await this.breakRepository.getTotalBreakSeconds(activeEntry.id)
			: 0;

		const stoppedEntry = activeEntry.stop(endTime, breakSeconds);
		return this.timeEntryRepository.update(stoppedEntry);
	}
}