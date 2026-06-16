import { eq, and, gte, lt, or, inArray } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { timeEntry, project, projectMember, user, role } from '../../infrastructure/db/schema';
import { toDateString, type AbsenceType } from '../absence';
import { getNetWorkSeconds } from './time-utils';
import {
	getAbsencesForUsers,
	getReportAbsenceScope,
	summarizeAbsences,
	type AbsenceSummaryRow,
	type CrewAbsence
} from './absence-queries';

export type ReportEntry = {
	entryId: number;
	userId: string;
	userName: string | null;
	userEmail: string;
	projectId: number | null;
	projectName: string;
	roleName: string | null;
	date: string;
	startTime: Date;
	endTime: Date | null;
	hours: number;
	description: string | null;
	isRunning: boolean;
};

export type ReportSummary = {
	userId: string;
	userName: string | null;
	userEmail: string;
	projectId: number;
	projectName: string;
	totalHours: number;
	entryCount: number;
};

export type ReportAbsence = CrewAbsence;

export type { AbsenceSummaryRow };

export type ReportProject = {
	id: number;
	name: string;
	isOwner: boolean;
};

export function getDefaultDateRange(): { from: string; to: string } {
	const now = new Date();
	const day = now.getDay();
	const diffToMonday = day === 0 ? 6 : day - 1;
	const monday = new Date(now);
	monday.setDate(now.getDate() - diffToMonday);
	monday.setHours(0, 0, 0, 0);

	return {
		from: toDateString(monday),
		to: toDateString(now)
	};
}

export async function getReportProjects(userId: string): Promise<ReportProject[]> {
	const owned = await db
		.select({ id: project.id, name: project.name })
		.from(project)
		.where(eq(project.userId, userId));

	const memberRows = await db
		.select({ id: project.id, name: project.name, ownerId: project.userId })
		.from(projectMember)
		.innerJoin(project, eq(projectMember.projectId, project.id))
		.where(eq(projectMember.userId, userId));

	const projectMap = new Map<number, ReportProject>();

	for (const p of owned) {
		projectMap.set(p.id, { id: p.id, name: p.name, isOwner: true });
	}

	for (const p of memberRows) {
		if (!projectMap.has(p.id)) {
			projectMap.set(p.id, { id: p.id, name: p.name, isOwner: false });
		}
	}

	return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTimeReport(params: {
	userId: string;
	from: string;
	to: string;
	projectId?: number | null;
}): Promise<{ entries: ReportEntry[]; summaries: ReportSummary[]; isOwnerView: boolean }> {
	const fromDate = new Date(params.from);
	fromDate.setHours(0, 0, 0, 0);

	const toDate = new Date(params.to);
	toDate.setHours(23, 59, 59, 999);

	const reportProjects = await getReportProjects(params.userId);
	const ownedIds = reportProjects.filter((p) => p.isOwner).map((p) => p.id);
	const memberIds = reportProjects.map((p) => p.id);

	if (memberIds.length === 0) {
		return { entries: [], summaries: [], isOwnerView: false };
	}

	if (params.projectId) {
		const accessible = reportProjects.find((p) => p.id === params.projectId);
		if (!accessible) {
			return { entries: [], summaries: [], isOwnerView: false };
		}
	}

	const accessConditions = [];

	if (params.projectId) {
		const isOwner = ownedIds.includes(params.projectId);
		if (isOwner) {
			accessConditions.push(eq(timeEntry.projectId, params.projectId));
		} else {
			accessConditions.push(
				and(eq(timeEntry.projectId, params.projectId), eq(timeEntry.userId, params.userId))
			);
		}
	} else {
		const ownerProjectFilter =
			ownedIds.length > 0 ? inArray(timeEntry.projectId, ownedIds) : undefined;
		const memberOnlyIds = reportProjects.filter((p) => !p.isOwner).map((p) => p.id);
		const ownEntriesOnMemberProjects =
			memberOnlyIds.length > 0
				? and(inArray(timeEntry.projectId, memberOnlyIds), eq(timeEntry.userId, params.userId))
				: undefined;

		if (ownerProjectFilter && ownEntriesOnMemberProjects) {
			accessConditions.push(or(ownerProjectFilter, ownEntriesOnMemberProjects));
		} else if (ownerProjectFilter) {
			accessConditions.push(ownerProjectFilter);
		} else if (ownEntriesOnMemberProjects) {
			accessConditions.push(ownEntriesOnMemberProjects);
		}
	}

	const rows = await db
		.select({
			entry: timeEntry,
			userName: user.name,
			userEmail: user.email,
			projectName: project.name,
			roleName: role.name
		})
		.from(timeEntry)
		.innerJoin(user, eq(timeEntry.userId, user.id))
		.leftJoin(project, eq(timeEntry.projectId, project.id))
		.leftJoin(role, eq(timeEntry.roleId, role.id))
		.where(
			and(
				gte(timeEntry.startTime, fromDate),
				lt(timeEntry.startTime, new Date(toDate.getTime() + 1)),
				accessConditions.length === 1 ? accessConditions[0] : undefined
			)
		)
		.orderBy(timeEntry.startTime);

	const entries: ReportEntry[] = [];
	for (const row of rows) {
		const seconds = await getNetWorkSeconds({ ...row.entry, id: row.entry.id });
		entries.push({
			entryId: row.entry.id,
			userId: row.entry.userId,
			userName: row.userName,
			userEmail: row.userEmail,
			projectId: row.entry.projectId,
			projectName: row.projectName ?? 'No job site',
			roleName: row.roleName,
			date: toDateString(row.entry.startTime),
			startTime: row.entry.startTime,
			endTime: row.entry.endTime,
			hours: Math.round((seconds / 3600) * 100) / 100,
			description: row.entry.description,
			isRunning: row.entry.isRunning
		});
	}

	const summaryMap = new Map<string, ReportSummary>();

	for (const entry of entries) {
		if (!entry.projectId) continue;

		const key = `${entry.userId}-${entry.projectId}`;
		const existing = summaryMap.get(key);

		if (existing) {
			existing.totalHours = Math.round((existing.totalHours + entry.hours) * 100) / 100;
			existing.entryCount += 1;
		} else {
			summaryMap.set(key, {
				userId: entry.userId,
				userName: entry.userName,
				userEmail: entry.userEmail,
				projectId: entry.projectId,
				projectName: entry.projectName,
				totalHours: entry.hours,
				entryCount: 1
			});
		}
	}

	const summaries = Array.from(summaryMap.values()).sort((a, b) => {
		const nameCompare = (a.userName ?? a.userEmail).localeCompare(b.userName ?? b.userEmail);
		if (nameCompare !== 0) return nameCompare;
		return a.projectName.localeCompare(b.projectName);
	});

	const isOwnerView = params.projectId
		? ownedIds.includes(params.projectId)
		: ownedIds.length > 0;

	return { entries, summaries, isOwnerView };
}

export async function getAbsenceReport(params: {
	userId: string;
	from: string;
	to: string;
	projectId?: number | null;
}): Promise<{ absences: ReportAbsence[]; summaries: AbsenceSummaryRow[]; isOwnerView: boolean }> {
	const scope = await getReportAbsenceScope(params.userId, params.projectId);
	if (scope.userIds.length === 0) {
		return { absences: [], summaries: [], isOwnerView: scope.isOwnerView };
	}

	const absences = await getAbsencesForUsers({
		userIds: scope.userIds,
		from: params.from,
		to: params.to
	});

	return {
		absences,
		summaries: summarizeAbsences(absences),
		isOwnerView: scope.isOwnerView
	};
}

export function absenceTypeLabel(type: AbsenceType): string {
	return type === 'vacation' ? 'Vacation' : 'Sick';
}