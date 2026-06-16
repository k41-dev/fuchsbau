import type { TimeEntry } from '../../domain/entities/TimeEntry';
import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { ClockInUseCase } from './ClockInUseCase';
import { ClockOutUseCase } from './ClockOutUseCase';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

export class SwitchProjectUseCase {
	private readonly clockOutUseCase: ClockOutUseCase;
	private readonly clockInUseCase: ClockInUseCase;

	constructor(private readonly timeEntryRepository: TimeEntryRepository) {
		const breakRepository = new DrizzleBreakRepository();
		this.clockOutUseCase = new ClockOutUseCase(timeEntryRepository, breakRepository);
		this.clockInUseCase = new ClockInUseCase(timeEntryRepository);
	}

	async execute(params: {
		userId: string;
		projectId: number;
		roleId?: number | null;
		switchTime?: Date;
	}): Promise<TimeEntry> {
		const switchTime = params.switchTime ?? new Date();
		const activeEntry = await this.timeEntryRepository.findActiveByUserId(params.userId);

		if (activeEntry?.projectId === params.projectId) {
			throw new Error('You are already clocked in at this job site');
		}

		if (activeEntry) {
			await this.clockOutUseCase.execute(params.userId, switchTime);
		}

		return this.clockInUseCase.execute({
			userId: params.userId,
			projectId: params.projectId,
			roleId: params.roleId,
			startTime: switchTime
		});
	}
}