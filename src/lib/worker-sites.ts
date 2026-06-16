import type { WorkerStatus } from '$lib/server/worker-status';

export function getActiveProjectId(status: WorkerStatus | null): number | null {
	return status?.entry?.projectId ?? null;
}

export function isClockedIn(status: WorkerStatus | null): boolean {
	return status?.state === 'working' || status?.state === 'on_break';
}

export function needsProjectSwitch(
	status: WorkerStatus | null,
	targetProjectId: number
): boolean {
	const activeProjectId = getActiveProjectId(status);
	return isClockedIn(status) && activeProjectId !== null && activeProjectId !== targetProjectId;
}