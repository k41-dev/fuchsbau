import { eq, and } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence, project, role } from '../../infrastructure/db/schema';
import { DrizzleTimeEntryRepository } from '../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { DrizzleBreakRepository } from '../../infrastructure/repositories/DrizzleBreakRepository';
import type { AbsenceType } from '../absence';
import { todayString } from '../absence';

export type WorkerStatus = {
	state: 'idle' | 'working' | 'on_break' | 'absent';
	entry: {
		id: number;
		projectId: number | null;
		projectName: string | null;
		roleName: string | null;
		description: string | null;
		startTime: string;
		workSeconds: number;
		breakSeconds: number;
	} | null;
	openBreak: {
		id: number;
		startTime: string;
		elapsedSeconds: number;
	} | null;
	absence: {
		type: AbsenceType;
		note: string | null;
		date: string;
	} | null;
};

export async function getWorkerStatus(userId: string): Promise<WorkerStatus> {
	const today = todayString();
	const timeEntryRepo = new DrizzleTimeEntryRepository();
	const breakRepo = new DrizzleBreakRepository();

	const [todayAbsence] = await db
		.select()
		.from(absence)
		.where(and(eq(absence.userId, userId), eq(absence.date, today)))
		.limit(1);

	const activeEntry = await timeEntryRepo.findActiveByUserId(userId);

	if (!activeEntry?.id) {
		return {
			state: todayAbsence ? 'absent' : 'idle',
			entry: null,
			openBreak: null,
			absence: todayAbsence
				? {
						type: todayAbsence.type as AbsenceType,
						note: todayAbsence.note,
						date: todayAbsence.date
					}
				: null
		};
	}

	const openBreak = await breakRepo.findOpenByTimeEntryId(activeEntry.id);
	const completedBreakSeconds = await breakRepo.getTotalBreakSeconds(activeEntry.id, false);
	const currentBreakSeconds = openBreak
		? Math.floor((Date.now() - openBreak.startTime.getTime()) / 1000)
		: 0;
	const totalBreakSeconds = completedBreakSeconds + currentBreakSeconds;

	const grossSeconds = Math.floor((Date.now() - activeEntry.startTime.getTime()) / 1000);
	const workSeconds = Math.max(0, grossSeconds - totalBreakSeconds);

	let projectName: string | null = null;
	let roleName: string | null = null;

	if (activeEntry.projectId) {
		const [proj] = await db
			.select({ name: project.name })
			.from(project)
			.where(eq(project.id, activeEntry.projectId))
			.limit(1);
		projectName = proj?.name ?? null;
	}

	if (activeEntry.roleId) {
		const [r] = await db
			.select({ name: role.name })
			.from(role)
			.where(eq(role.id, activeEntry.roleId))
			.limit(1);
		roleName = r?.name ?? null;
	}

	return {
		state: openBreak ? 'on_break' : 'working',
		entry: {
			id: activeEntry.id,
			projectId: activeEntry.projectId,
			projectName,
			roleName,
			description: activeEntry.description,
			startTime: activeEntry.startTime.toISOString(),
			workSeconds,
			breakSeconds: totalBreakSeconds
		},
		openBreak: openBreak
			? {
					id: openBreak.id,
					startTime: openBreak.startTime.toISOString(),
					elapsedSeconds: currentBreakSeconds
				}
			: null,
		absence: null
	};
}