import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence, project, projectMember, user } from '../../infrastructure/db/schema';
import type { AbsenceStatus, AbsenceType } from '../absence';
import { getReportProjects } from './reports';

export type CrewAbsence = {
	userId: string;
	userName: string | null;
	userEmail: string;
	date: string;
	type: AbsenceType;
	status: AbsenceStatus;
	requestGroupId: string;
	note: string | null;
};

export async function getProjectCrewUserIds(projectId: number): Promise<string[]> {
	const [proj] = await db
		.select({ ownerId: project.userId })
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);

	if (!proj) return [];

	const members = await db
		.select({ userId: projectMember.userId })
		.from(projectMember)
		.where(eq(projectMember.projectId, projectId));

	const ids = new Set<string>([proj.ownerId, ...members.map((m) => m.userId)]);
	return Array.from(ids);
}

export async function getAbsencesForUsers(params: {
	userIds: string[];
	from: string;
	to: string;
	statuses?: AbsenceStatus[];
}): Promise<CrewAbsence[]> {
	if (params.userIds.length === 0) return [];

	const statuses = params.statuses ?? ['approved'];

	const rows = await db
		.select({
			userId: absence.userId,
			userName: user.name,
			userEmail: user.email,
			date: absence.date,
			type: absence.type,
			status: absence.status,
			requestGroupId: absence.requestGroupId,
			note: absence.note
		})
		.from(absence)
		.innerJoin(user, eq(absence.userId, user.id))
		.where(
			and(
				inArray(absence.userId, params.userIds),
				inArray(absence.status, statuses),
				gte(absence.date, params.from),
				lte(absence.date, params.to)
			)
		)
		.orderBy(absence.date, user.name);

	return rows.map((row) => ({
		userId: row.userId,
		userName: row.userName,
		userEmail: row.userEmail,
		date: row.date,
		type: row.type as AbsenceType,
		status: row.status as AbsenceStatus,
		requestGroupId: row.requestGroupId,
		note: row.note
	}));
}

export async function getProjectDayAbsences(
	projectId: number,
	dateStr: string
): Promise<CrewAbsence[]> {
	const crewIds = await getProjectCrewUserIds(projectId);
	return getAbsencesForUsers({ userIds: crewIds, from: dateStr, to: dateStr });
}

export async function getReportAbsenceScope(
	userId: string,
	projectId?: number | null
): Promise<{ userIds: string[]; isOwnerView: boolean }> {
	const reportProjects = await getReportProjects(userId);
	const ownedIds = reportProjects.filter((p) => p.isOwner).map((p) => p.id);

	if (reportProjects.length === 0) {
		return { userIds: [], isOwnerView: false };
	}

	if (projectId) {
		const accessible = reportProjects.find((p) => p.id === projectId);
		if (!accessible) return { userIds: [], isOwnerView: false };

		if (accessible.isOwner) {
			return { userIds: await getProjectCrewUserIds(projectId), isOwnerView: true };
		}

		return { userIds: [userId], isOwnerView: false };
	}

	const userIdSet = new Set<string>();

	for (const ownedId of ownedIds) {
		const crewIds = await getProjectCrewUserIds(ownedId);
		for (const id of crewIds) userIdSet.add(id);
	}

	if (ownedIds.length === 0) {
		userIdSet.add(userId);
	}

	return { userIds: Array.from(userIdSet), isOwnerView: ownedIds.length > 0 };
}

export type AbsenceSummaryRow = {
	userId: string;
	userName: string | null;
	userEmail: string;
	sickDays: number;
	vacationDays: number;
};

export function summarizeAbsences(absences: CrewAbsence[]): AbsenceSummaryRow[] {
	const map = new Map<string, AbsenceSummaryRow>();

	for (const row of absences) {
		const existing = map.get(row.userId);
		if (existing) {
			if (row.type === 'sick') existing.sickDays += 1;
			else existing.vacationDays += 1;
		} else {
			map.set(row.userId, {
				userId: row.userId,
				userName: row.userName,
				userEmail: row.userEmail,
				sickDays: row.type === 'sick' ? 1 : 0,
				vacationDays: row.type === 'vacation' ? 1 : 0
			});
		}
	}

	return Array.from(map.values()).sort((a, b) =>
		(a.userName ?? a.userEmail).localeCompare(b.userName ?? b.userEmail)
	);
}