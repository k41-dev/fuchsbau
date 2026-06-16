import { eq, and, gte, lt } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { timeEntry, user, role } from '../../infrastructure/db/schema';
import { todayString, type AbsenceType } from '../absence';
import { getNetWorkSeconds } from './time-utils';
import { getStaleShiftInfo } from '$lib/stale-shift';
import { getProjectDayAbsences, type CrewAbsence } from './absence-queries';
import { getStaleShiftConfig } from './stale-shift-config';

export type ActiveWorker = {
	entryId: number;
	userId: string;
	userName: string | null;
	userEmail: string;
	roleId: number | null;
	roleName: string | null;
	startTime: Date;
	isStale: boolean;
	staleReason: string | null;
};

export type WorkerDaySummary = {
	userId: string;
	userName: string | null;
	userEmail: string;
	totalHours: number;
	entryCount: number;
	isActiveNow: boolean;
	absenceType: AbsenceType | null;
	absenceNote: string | null;
};

function getDayBounds(dateStr: string): { start: Date; end: Date } {
	const start = new Date(dateStr);
	start.setHours(0, 0, 0, 0);
	const end = new Date(dateStr);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

function getStaleInfo(startTime: Date): { isStale: boolean; reason: string | null } {
	return getStaleShiftInfo(startTime, getStaleShiftConfig());
}

export async function getActiveWorkers(projectId: number): Promise<ActiveWorker[]> {
	const rows = await db
		.select({
			entry: timeEntry,
			userName: user.name,
			userEmail: user.email,
			roleName: role.name
		})
		.from(timeEntry)
		.innerJoin(user, eq(timeEntry.userId, user.id))
		.leftJoin(role, eq(timeEntry.roleId, role.id))
		.where(and(eq(timeEntry.projectId, projectId), eq(timeEntry.isRunning, true)))
		.orderBy(timeEntry.startTime);

	return rows.map((row) => {
		const stale = getStaleInfo(row.entry.startTime);
		return {
			entryId: row.entry.id,
			userId: row.entry.userId,
			userName: row.userName,
			userEmail: row.userEmail,
			roleId: row.entry.roleId,
			roleName: row.roleName,
			startTime: row.entry.startTime,
			isStale: stale.isStale,
			staleReason: stale.reason
		};
	});
}

export async function getDaySummary(projectId: number, dateStr: string) {
	const { start, end } = getDayBounds(dateStr);
	const isToday = dateStr === todayString();
	const dayAbsences = await getProjectDayAbsences(projectId, dateStr);
	const absenceByUser = new Map<string, CrewAbsence>(
		dayAbsences.map((a) => [a.userId, a])
	);

	const dayEntries = await db
		.select({
			entry: timeEntry,
			userName: user.name,
			userEmail: user.email
		})
		.from(timeEntry)
		.innerJoin(user, eq(timeEntry.userId, user.id))
		.where(
			and(
				eq(timeEntry.projectId, projectId),
				gte(timeEntry.startTime, start),
				lt(timeEntry.startTime, new Date(end.getTime() + 1))
			)
		);

	const activeUserIds = new Set(
		isToday
			? (await getActiveWorkers(projectId)).map((w) => w.userId)
			: []
	);

	const workerMap = new Map<string, WorkerDaySummary>();

	for (const row of dayEntries) {
		const seconds = await getNetWorkSeconds({ ...row.entry, id: row.entry.id });
		const hours = Math.round((seconds / 3600) * 100) / 100;
		const existing = workerMap.get(row.entry.userId);

		if (existing) {
			existing.totalHours = Math.round((existing.totalHours + hours) * 100) / 100;
			existing.entryCount += 1;
			if (!existing.absenceType) {
				const absence = absenceByUser.get(row.entry.userId);
				existing.absenceType = absence?.type ?? null;
				existing.absenceNote = absence?.note ?? null;
			}
		} else {
			const absence = absenceByUser.get(row.entry.userId);
			workerMap.set(row.entry.userId, {
				userId: row.entry.userId,
				userName: row.userName,
				userEmail: row.userEmail,
				totalHours: hours,
				entryCount: 1,
				isActiveNow: activeUserIds.has(row.entry.userId),
				absenceType: absence?.type ?? null,
				absenceNote: absence?.note ?? null
			});
		}
	}

	for (const row of workerMap.values()) {
		if (row.absenceType) continue;
		const absence = absenceByUser.get(row.userId);
		if (absence) {
			row.absenceType = absence.type;
			row.absenceNote = absence.note;
		}
	}

	for (const userId of activeUserIds) {
		if (!workerMap.has(userId)) {
			const active = (await getActiveWorkers(projectId)).find((w) => w.userId === userId);
			if (active) {
				const absence = absenceByUser.get(userId);
				workerMap.set(userId, {
					userId: active.userId,
					userName: active.userName,
					userEmail: active.userEmail,
					totalHours: 0,
					entryCount: 0,
					isActiveNow: true,
					absenceType: absence?.type ?? null,
					absenceNote: absence?.note ?? null
				});
			}
		}
	}

	for (const absence of dayAbsences) {
		if (workerMap.has(absence.userId)) continue;
		workerMap.set(absence.userId, {
			userId: absence.userId,
			userName: absence.userName,
			userEmail: absence.userEmail,
			totalHours: 0,
			entryCount: 0,
			isActiveNow: false,
			absenceType: absence.type,
			absenceNote: absence.note
		});
	}

	const workers = Array.from(workerMap.values()).sort((a, b) =>
		(a.userName ?? a.userEmail).localeCompare(b.userName ?? b.userEmail)
	);

	let totalSeconds = 0;
	for (const row of dayEntries) {
		totalSeconds += await getNetWorkSeconds({ ...row.entry, id: row.entry.id });
	}
	const staleWorkers = isToday ? (await getActiveWorkers(projectId)).filter((w) => w.isStale) : [];
	const sickCount = dayAbsences.filter((a) => a.type === 'sick').length;
	const vacationCount = dayAbsences.filter((a) => a.type === 'vacation').length;

	return {
		date: dateStr,
		isToday,
		totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
		clockInCount: dayEntries.length,
		workerCount: workers.length,
		workers,
		staleWorkers,
		allClockedOut: isToday && activeUserIds.size === 0,
		absences: dayAbsences,
		sickCount,
		vacationCount,
		absenceCount: dayAbsences.length
	};
}