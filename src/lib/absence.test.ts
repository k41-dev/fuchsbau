import { describe, expect, it } from 'vitest';
import { eachDateInRange } from './absence';

describe('eachDateInRange', () => {
	it('returns a single day when start equals end', () => {
		expect(eachDateInRange('2026-06-16', '2026-06-16')).toEqual(['2026-06-16']);
	});

	it('returns consecutive days inclusive of both ends', () => {
		expect(eachDateInRange('2026-06-16', '2026-06-18')).toEqual([
			'2026-06-16',
			'2026-06-17',
			'2026-06-18'
		]);
	});

	it('returns empty array when end is before start', () => {
		expect(eachDateInRange('2026-06-18', '2026-06-16')).toEqual([]);
	});
});