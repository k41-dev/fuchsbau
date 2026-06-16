import { browser } from '$app/environment';
import Dexie, { type Table } from 'dexie';
import type { PendingWorkerAction, WorkerCacheRecord } from './types';

export class FuchsbauOfflineDB extends Dexie {
	pendingActions!: Table<PendingWorkerAction, string>;
	workerCache!: Table<WorkerCacheRecord, string>;

	constructor() {
		super('fuchsbau-offline');
		this.version(1).stores({
			pendingActions: 'id, createdAt',
			workerCache: 'userId'
		});
	}
}

let offlineDb: FuchsbauOfflineDB | null = null;

export function getOfflineDb(): FuchsbauOfflineDB | null {
	if (!browser) return null;
	if (!offlineDb) offlineDb = new FuchsbauOfflineDB();
	return offlineDb;
}