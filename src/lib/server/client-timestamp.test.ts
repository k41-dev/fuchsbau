import { describe, expect, it } from 'vitest';
import { parseClientTimestamp } from './client-timestamp';

describe('parseClientTimestamp', () => {
	it('returns undefined when omitted', () => {
		expect(parseClientTimestamp()).toBeUndefined();
	});

	it('accepts a recent timestamp', () => {
		const iso = new Date(Date.now() - 60_000).toISOString();
		expect(parseClientTimestamp(iso)?.toISOString()).toBe(iso);
	});

	it('rejects timestamps too far in the past', () => {
		const iso = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
		expect(() => parseClientTimestamp(iso)).toThrow('too far in the past');
	});
});