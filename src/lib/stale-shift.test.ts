import { describe, expect, it } from 'vitest';
import { getStaleShiftInfo } from './stale-shift';

const config = { maxShiftHours: 12, endOfDayHour: 18 };

describe('getStaleShiftInfo', () => {
	it('flags shifts from a previous day', () => {
		const now = new Date('2026-06-16T09:00:00');
		const start = new Date('2026-06-15T16:00:00');

		expect(getStaleShiftInfo(start, config, now).isStale).toBe(true);
	});

	it('flags very long same-day shifts', () => {
		const now = new Date('2026-06-16T20:00:00');
		const start = new Date('2026-06-16T07:00:00');

		expect(getStaleShiftInfo(start, config, now)).toEqual({
			isStale: true,
			reason: 'Clocked in for 13+ hours'
		});
	});

	it('flags open shifts after end-of-day hour', () => {
		const now = new Date('2026-06-16T19:30:00');
		const start = new Date('2026-06-16T14:00:00');

		expect(getStaleShiftInfo(start, config, now)).toEqual({
			isStale: true,
			reason: 'Still clocked in after 18:00'
		});
	});

	it('allows normal active shifts', () => {
		const now = new Date('2026-06-16T15:00:00');
		const start = new Date('2026-06-16T07:00:00');

		expect(getStaleShiftInfo(start, config, now)).toEqual({
			isStale: false,
			reason: null
		});
	});
});