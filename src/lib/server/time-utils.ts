import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';

const breakRepo = new DrizzleBreakRepository();

export async function getNetWorkSeconds(entry: {
	id: number | null;
	startTime: Date;
	endTime: Date | null;
	duration: number | null;
	isRunning: boolean;
}): Promise<number> {
	if (!entry.id) return 0;

	if (!entry.isRunning && entry.duration !== null) {
		return entry.duration;
	}

	const breakSeconds = await breakRepo.getTotalBreakSeconds(entry.id, entry.isRunning);
	const gross = Math.floor(
		((entry.isRunning ? Date.now() : entry.endTime!.getTime()) - entry.startTime.getTime()) / 1000
	);

	return Math.max(0, gross - breakSeconds);
}