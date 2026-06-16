import { describe, expect, it } from 'vitest';
import { applyAction } from './optimistic-status';
import type { CachedProject } from './types';

const projects: CachedProject[] = [
	{
		id: 1,
		name: 'Site A',
		address: null,
		roles: [{ id: 10, name: 'Electrician' }]
	}
];

describe('applyAction', () => {
	it('optimistically clocks in with project and role names', () => {
		const status = applyAction(
			null,
			'clock-in',
			{ projectId: 1, roleId: 10 },
			projects,
			'2026-06-16T07:00:00.000Z'
		);

		expect(status.state).toBe('working');
		expect(status.entry?.projectName).toBe('Site A');
		expect(status.entry?.roleName).toBe('Electrician');
		expect(status.entry?.startTime).toBe('2026-06-16T07:00:00.000Z');
	});

	it('optimistically switches projects', () => {
		let status = applyAction(
			null,
			'clock-in',
			{ projectId: 1, roleId: 10 },
			projects,
			'2026-06-16T07:00:00.000Z'
		);

		status = applyAction(
			status,
			'switch-project',
			{ projectId: 1, roleId: 10 },
			projects,
			'2026-06-16T12:00:00.000Z'
		);

		expect(status.state).toBe('working');
		expect(status.entry?.projectName).toBe('Site A');
		expect(status.entry?.startTime).toBe('2026-06-16T12:00:00.000Z');
		expect(status.openBreak).toBeNull();
	});

	it('optimistically moves to break and back', () => {
		let status = applyAction(
			null,
			'clock-in',
			{ projectId: 1 },
			projects,
			'2026-06-16T07:00:00.000Z'
		);

		status = applyAction(
			status,
			'start-break',
			{},
			projects,
			'2026-06-16T09:00:00.000Z'
		);
		expect(status.state).toBe('on_break');

		status = applyAction(status, 'end-break', {}, projects, '2026-06-16T09:15:00.000Z');
		expect(status.state).toBe('working');
		expect(status.openBreak).toBeNull();
	});
});