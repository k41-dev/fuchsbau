import type { WorkerStatus } from '$lib/server/worker-status';
import { getOfflineDb } from './db';
import { applyAction, applyPendingActions } from './optimistic-status';
import type {
	CachedProject,
	PendingWorkerAction,
	WorkerActionName,
	WorkerActionResult,
	WorkerCacheRecord
} from './types';

function createActionId() {
	return crypto.randomUUID();
}

export function isNetworkError(error: unknown): boolean {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
	if (error instanceof TypeError) return true;
	return false;
}

export async function saveWorkerCache(record: WorkerCacheRecord) {
	const db = getOfflineDb();
	if (!db) return;
	await db.workerCache.put(record);
}

export async function loadWorkerCache(userId: string): Promise<WorkerCacheRecord | null> {
	const db = getOfflineDb();
	if (!db) return null;
	return (await db.workerCache.get(userId)) ?? null;
}

export async function getPendingActions(): Promise<PendingWorkerAction[]> {
	const db = getOfflineDb();
	if (!db) return [];
	return db.pendingActions.orderBy('createdAt').toArray();
}

export async function getPendingCount(): Promise<number> {
	const db = getOfflineDb();
	if (!db) return 0;
	return db.pendingActions.count();
}

export async function enqueueAction(
	action: WorkerActionName,
	payload: Record<string, unknown>,
	clientTimestamp = new Date().toISOString()
): Promise<PendingWorkerAction> {
	const item: PendingWorkerAction = {
		id: createActionId(),
		action,
		payload,
		clientTimestamp,
		createdAt: Date.now()
	};
	const db = getOfflineDb();
	if (!db) throw new Error('Offline storage is unavailable');
	await db.pendingActions.add(item);
	return item;
}

export async function removePendingAction(id: string) {
	const db = getOfflineDb();
	if (!db) return;
	await db.pendingActions.delete(id);
}

export async function clearPendingActions() {
	const db = getOfflineDb();
	if (!db) return;
	await db.pendingActions.clear();
}

export async function buildOfflineStatus(
	userId: string,
	projects: CachedProject[]
): Promise<WorkerStatus | null> {
	const cache = await loadWorkerCache(userId);
	const pending = await getPendingActions();
	if (!cache && pending.length === 0) return null;
	return applyPendingActions(cache?.status ?? null, pending, projects);
}

async function postWorkerAction(
	action: WorkerActionName,
	payload: Record<string, unknown>,
	clientTimestamp?: string
): Promise<WorkerActionResult> {
	const res = await fetch('/api/worker', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({
			action,
			...payload,
			clientTimestamp
		})
	});

	const result = await res.json();
	if (!result.success) {
		return { success: false, error: result.error ?? 'Request failed' };
	}

	return { success: true, status: result.status as WorkerStatus };
}

export async function syncPendingActions(): Promise<{
	synced: number;
	failed: string | null;
	status: WorkerStatus | null;
}> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		return { synced: 0, failed: null, status: null };
	}

	const pending = await getPendingActions();
	if (pending.length === 0) {
		return { synced: 0, failed: null, status: null };
	}

	let synced = 0;
	for (const item of pending) {
		const result = await postWorkerAction(item.action, item.payload, item.clientTimestamp);
		if (!result.success) {
			return { synced, failed: result.error ?? 'Sync failed', status: null };
		}
		await removePendingAction(item.id);
		synced += 1;
	}

	const statusRes = await fetch('/api/worker', { credentials: 'include' });
	const statusJson = await statusRes.json();
	return {
		synced,
		failed: null,
		status: statusJson.success ? (statusJson.status as WorkerStatus) : null
	};
}

export async function performWorkerAction(params: {
	userId: string;
	action: WorkerActionName;
	payload?: Record<string, unknown>;
	projects: CachedProject[];
	currentStatus: WorkerStatus | null;
}): Promise<WorkerActionResult> {
	const payload = params.payload ?? {};
	const clientTimestamp = new Date().toISOString();

	try {
		const result = await postWorkerAction(params.action, payload, clientTimestamp);
		if (result.success) {
			await saveWorkerCache({
				userId: params.userId,
				projects: params.projects,
				status: result.status ?? null,
				updatedAt: Date.now()
			});
			return result;
		}

		return result;
	} catch (error: unknown) {
		if (!isNetworkError(error)) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Something went wrong'
			};
		}
	}

	await enqueueAction(params.action, payload, clientTimestamp);
	const optimistic = applyAction(
		params.currentStatus,
		params.action,
		payload,
		params.projects,
		clientTimestamp
	);

	await saveWorkerCache({
		userId: params.userId,
		projects: params.projects,
		status: optimistic,
		updatedAt: Date.now()
	});

	return { success: true, status: optimistic, queued: true };
}