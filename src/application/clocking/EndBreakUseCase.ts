import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

export class EndBreakUseCase {
	constructor(
		private readonly timeEntryRepository: TimeEntryRepository,
		private readonly breakRepository: DrizzleBreakRepository
	) {}

	async execute(userId: string) {
		const activeEntry = await this.timeEntryRepository.findActiveByUserId(userId);
		if (!activeEntry?.id) {
			throw new Error('No active time entry found');
		}

		const openBreak = await this.breakRepository.findOpenByTimeEntryId(activeEntry.id);
		if (!openBreak) {
			throw new Error('You are not currently on a break');
		}

		const breakPeriod = await this.breakRepository.end(openBreak.id);
		return { entry: activeEntry, breakPeriod };
	}
}