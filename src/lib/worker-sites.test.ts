import { describe, expect, it } from 'vitest';
import { needsProjectSwitch, isClockedIn } from './worker-sites';
import type { WorkerStatus } from '$lib/server/worker-status';

const workingAtSiteA: WorkerStatus = {
	state: 'working',
	entry: {
		id: 1,
		projectId: 1,
		projectName: 'Site A',
		roleName: 'Electrician',
		description: null,
		startTime: '2026-06-16T07:00:00.000Z',
		workSeconds: 0,
		breakSeconds: 0
	},
	openBreak: null,
	absence: null,
	forgottenClockOut: null
};

describe('worker site helpers', () => {
	it('detects when a switch is required', () => {
		expect(isClockedIn(workingAtSiteA)).toBe(true);
		expect(needsProjectSwitch(workingAtSiteA, 1)).toBe(false);
		expect(needsProjectSwitch(workingAtSiteA, 2)).toBe(true);
	});
});