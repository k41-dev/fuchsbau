import type { WorkerStatus } from '$lib/server/worker-status';
import type { AbsenceType } from '$lib/absence';
import { todayString } from '$lib/absence';
import type { CachedProject, PendingWorkerAction, WorkerActionName } from './types';

function findProject(projects: CachedProject[], projectId: number) {
	return projects.find((p) => p.id === projectId) ?? null;
}

function applyOne(
	status: WorkerStatus,
	action: WorkerActionName,
	payload: Record<string, unknown>,
	projects: CachedProject[],
	clientTimestamp: string
): WorkerStatus {
	const at = clientTimestamp;

	switch (action) {
		case 'clock-in': {
			const projectId = payload.projectId as number;
			const roleId = payload.roleId as number | undefined;
			const project = findProject(projects, projectId);
			const role = project?.roles.find((r) => r.id === roleId);

			return {
				state: 'working',
				entry: {
					id: -1,
					projectId,
					projectName: project?.name ?? 'Job site',
					roleName: role?.name ?? null,
					description: null,
					startTime: at,
					workSeconds: 0,
					breakSeconds: 0
				},
				openBreak: null,
				absence: null,
				forgottenClockOut: null
			};
		}

		case 'start-break':
			if (!status.entry) return status;
			return {
				...status,
				state: 'on_break',
				openBreak: { id: -1, startTime: at, elapsedSeconds: 0 }
			};

		case 'end-break':
			if (!status.entry) return status;
			return {
				...status,
				state: 'working',
				openBreak: null
			};

		case 'switch-project': {
			const projectId = payload.projectId as number;
			const roleId = payload.roleId as number | undefined;
			const project = findProject(projects, projectId);
			const role = project?.roles.find((r) => r.id === roleId);

			return {
				state: 'working',
				entry: {
					id: -1,
					projectId,
					projectName: project?.name ?? 'Job site',
					roleName: role?.name ?? null,
					description: null,
					startTime: at,
					workSeconds: 0,
					breakSeconds: 0
				},
				openBreak: null,
				absence: null,
				forgottenClockOut: null
			};
		}

		case 'clock-out':
			return {
				state: 'idle',
				entry: null,
				openBreak: null,
				absence: null,
				forgottenClockOut: null
			};

		case 'report-absence': {
			const type = payload.type as AbsenceType;
			return {
				state: 'pending_absence',
				entry: null,
				openBreak: null,
				absence: {
					type,
					status: 'pending',
					requestGroupId: 'offline',
					note: (payload.note as string | undefined) ?? null,
					date: todayString()
				},
				forgottenClockOut: null
			};
		}

		case 'cancel-absence':
			return {
				state: 'idle',
				entry: null,
				openBreak: null,
				absence: null,
				forgottenClockOut: null
			};

		default:
			return status;
	}
}

export function applyPendingActions(
	baseStatus: WorkerStatus | null,
	pending: PendingWorkerAction[],
	projects: CachedProject[]
): WorkerStatus | null {
	let status =
		baseStatus ??
		({
			state: 'idle',
			entry: null,
			openBreak: null,
			absence: null,
			forgottenClockOut: null
		} satisfies WorkerStatus);

	for (const item of pending) {
		status = applyOne(status, item.action, item.payload, projects, item.clientTimestamp);
	}

	return status;
}

export function applyAction(
	status: WorkerStatus | null,
	action: WorkerActionName,
	payload: Record<string, unknown>,
	projects: CachedProject[],
	clientTimestamp: string
): WorkerStatus {
	const base =
		status ??
		({
			state: 'idle',
			entry: null,
			openBreak: null,
			absence: null,
			forgottenClockOut: null
		} satisfies WorkerStatus);

	return applyOne(base, action, payload, projects, clientTimestamp);
}