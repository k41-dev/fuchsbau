import { describe, expect, it } from 'vitest';
import { getProjectImageUrl } from './project-image';

describe('project image helpers', () => {
	it('builds the image route when a background exists', () => {
		expect(getProjectImageUrl(12, true)).toBe('/project-images/12');
	});

	it('returns null when no background is stored', () => {
		expect(getProjectImageUrl(12, false)).toBeNull();
	});
});