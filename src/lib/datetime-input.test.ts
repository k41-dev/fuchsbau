import { describe, expect, it } from 'vitest';
import { parseLocalDateTimeInput, toLocalDateTimeInputValue } from './datetime-input';

describe('datetime input helpers', () => {
	it('parses datetime-local values', () => {
		const date = parseLocalDateTimeInput('2026-06-16T17:30', 'End time');
		expect(date.getFullYear()).toBe(2026);
		expect(date.getMonth()).toBe(5);
		expect(date.getDate()).toBe(16);
	});

	it('round-trips through input format', () => {
		const original = new Date('2026-06-16T07:15:00');
		expect(toLocalDateTimeInputValue(original)).toMatch(/^2026-06-16T\d{2}:\d{2}$/);
	});
});