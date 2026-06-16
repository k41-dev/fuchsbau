import type { WorkerStatus } from '$lib/server/worker-status';

export type CachedProject = {
	id: number;
	name: string;
	address: string | null;
	roles: { id: number; name: string }[];
};

export type WorkerActionName =
	| 'clock-in'
	| 'clock-out'
	| 'start-break'
	| 'end-break'
	| 'report-absence'
	| 'cancel-absence';

export type PendingWorkerAction = {
	id: string;
	action: WorkerActionName;
	payload: Record<string, unknown>;
	clientTimestamp: string;
	createdAt: number;
};

export type WorkerCacheRecord = {
	userId: string;
	projects: CachedProject[];
	status: WorkerStatus | null;
	updatedAt: number;
};

export type WorkerActionResult = {
	success: boolean;
	status?: WorkerStatus;
	error?: string;
	queued?: boolean;
};