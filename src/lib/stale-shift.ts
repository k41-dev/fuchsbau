export type StaleShiftConfig = {
	/** Flag shifts running longer than this many hours. */
	maxShiftHours: number;
	/** Local hour (0–23) after which same-day open shifts are flagged. */
	endOfDayHour: number;
};

export const DEFAULT_STALE_SHIFT_CONFIG: StaleShiftConfig = {
	maxShiftHours: 12,
	endOfDayHour: 18
};

export type StaleShiftInfo = {
	isStale: boolean;
	reason: string | null;
};

function startOfLocalDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function getStaleShiftInfo(
	startTime: Date,
	config: StaleShiftConfig = DEFAULT_STALE_SHIFT_CONFIG,
	now: Date = new Date()
): StaleShiftInfo {
	const todayStart = startOfLocalDay(now);

	if (startTime < todayStart) {
		return { isStale: true, reason: 'Still clocked in since a previous day' };
	}

	const elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

	if (elapsedHours >= config.maxShiftHours) {
		return {
			isStale: true,
			reason: `Clocked in for ${Math.floor(elapsedHours)}+ hours`
		};
	}

	if (now.getHours() >= config.endOfDayHour) {
		return {
			isStale: true,
			reason: `Still clocked in after ${String(config.endOfDayHour).padStart(2, '0')}:00`
		};
	}

	return { isStale: false, reason: null };
}