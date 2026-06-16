import {
	DEFAULT_STALE_SHIFT_CONFIG,
	type StaleShiftConfig
} from '$lib/stale-shift';

function parseHour(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) return fallback;
	return parsed;
}

function parseMaxHours(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 1) return fallback;
	return parsed;
}

export function getStaleShiftConfig(): StaleShiftConfig {
	return {
		maxShiftHours: parseMaxHours(
			process.env.STALE_SHIFT_HOURS,
			DEFAULT_STALE_SHIFT_CONFIG.maxShiftHours
		),
		endOfDayHour: parseHour(
			process.env.STALE_END_OF_DAY_HOUR,
			DEFAULT_STALE_SHIFT_CONFIG.endOfDayHour
		)
	};
}