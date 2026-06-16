import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

export class StartBreakUseCase {
	constructor(
		private readonly timeEntryRepository: TimeEntryRepository,
		private readonly breakRepository: DrizzleBreakRepository
	) {}

	async execute(userId: string) {
		const activeEntry = await this.timeEntryRepository.findActiveByUserId(userId);
		if (!activeEntry?.id) {
			throw new Error('You need to be clocked in to start a break');
		}

		const openBreak = await this.breakRepository.findOpenByTimeEntryId(activeEntry.id);
		if (openBreak) {
			throw new Error('You are already on a break');
		}

		const breakPeriod = await this.breakRepository.start(activeEntry.id);
		return { entry: activeEntry, breakPeriod };
	}
}