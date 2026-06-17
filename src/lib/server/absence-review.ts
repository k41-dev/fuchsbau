import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { absence, project, projectMember, user } from '../../infrastructure/db/schema';
import type { AbsenceType } from '../absence';

async function canReviewWorkerAbsence(
	ownerId: string,
	workerUserId: string
): Promise<boolean> {
	if (ownerId === workerUserId) return false;

	const [membership] = await db
		.select({ projectId: projectMember.projectId })
		.from(projectMember)
		.innerJoin(project, eq(projectMember.projectId, project.id))
		.where(and(eq(project.userId, ownerId), eq(projectMember.userId, workerUserId)))
		.limit(1);

	return Boolean(membership);
}

export async function assertCanReviewWorkerAbsence(
	ownerId: string,
	workerUserId: string
): Promise<void> {
	const allowed = await canReviewWorkerAbsence(ownerId, workerUserId);
	if (!allowed) {
		throw new Error('Only the job site owner can review this absence request');
	}
}

export type PendingAbsenceRequest = {
	requestGroupId: string;
	userId: string;
	userName: string | null;
	userEmail: string;
	type: AbsenceType;
	note: string | null;
	startDate: string;
	endDate: string;
	dayCount: number;
	submittedAt: Date;
};

export async function getPendingAbsenceRequestsForProject(
	projectId: number
): Promise<PendingAbsenceRequest[]> {
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

	const crewIds = members.map((m) => m.userId);
	if (crewIds.length === 0) return [];

	const rows = await db
		.select({
			requestGroupId: absence.requestGroupId,
			userId: absence.userId,
			userName: user.name,
			userEmail: user.email,
			date: absence.date,
			type: absence.type,
			note: absence.note,
			createdAt: absence.createdAt
		})
		.from(absence)
		.innerJoin(user, eq(absence.userId, user.id))
		.where(and(inArray(absence.userId, crewIds), eq(absence.status, 'pending')))
		.orderBy(absence.createdAt, absence.date);

	const grouped = new Map<string, PendingAbsenceRequest>();

	for (const row of rows) {
		const existing = grouped.get(row.requestGroupId);
		if (existing) {
			if (row.date < existing.startDate) existing.startDate = row.date;
			if (row.date > existing.endDate) existing.endDate = row.date;
			existing.dayCount += 1;
			if (!existing.note && row.note) existing.note = row.note;
		} else {
			grouped.set(row.requestGroupId, {
				requestGroupId: row.requestGroupId,
				userId: row.userId,
				userName: row.userName,
				userEmail: row.userEmail,
				type: row.type as AbsenceType,
				note: row.note,
				startDate: row.date,
				endDate: row.date,
				dayCount: 1,
				submittedAt: row.createdAt
			});
		}
	}

	return Array.from(grouped.values()).sort((a, b) => {
		const nameA = a.userName ?? a.userEmail;
		const nameB = b.userName ?? b.userEmail;
		return nameA.localeCompare(nameB) || b.submittedAt.getTime() - a.submittedAt.getTime();
	});
}