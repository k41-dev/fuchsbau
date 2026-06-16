import { eq, inArray } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project } from '../../infrastructure/db/schema';
import { getActiveWorkers } from './supervisor';

export type StaleShiftAlert = {
	projectId: number;
	projectName: string;
	entryId: number;
	userId: string;
	userName: string | null;
	userEmail: string;
	roleName: string | null;
	startTime: string;
	staleReason: string;
};

export type ProjectStaleSummary = {
	projectId: number;
	staleCount: number;
};

function toAlert(
	projectId: number,
	projectName: string,
	worker: Awaited<ReturnType<typeof getActiveWorkers>>[number]
): StaleShiftAlert {
	return {
		projectId,
		projectName,
		entryId: worker.entryId,
		userId: worker.userId,
		userName: worker.userName,
		userEmail: worker.userEmail,
		roleName: worker.roleName,
		startTime: worker.startTime.toISOString(),
		staleReason: worker.staleReason ?? 'Forgotten clock-out'
	};
}

export async function getStaleAlertsForProjects(
	projectIds: number[]
): Promise<StaleShiftAlert[]> {
	if (projectIds.length === 0) return [];

	const projects = await db
		.select({ id: project.id, name: project.name })
		.from(project)
		.where(inArray(project.id, projectIds));

	const alerts: StaleShiftAlert[] = [];

	for (const proj of projects) {
		const activeWorkers = await getActiveWorkers(proj.id);
		for (const worker of activeWorkers) {
			if (!worker.isStale) continue;
			alerts.push(toAlert(proj.id, proj.name, worker));
		}
	}

	return alerts.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export async function getSupervisorStaleAlerts(supervisorId: string): Promise<StaleShiftAlert[]> {
	const owned = await db
		.select({ id: project.id })
		.from(project)
		.where(eq(project.userId, supervisorId));

	return getStaleAlertsForProjects(owned.map((p) => p.id));
}

export async function getProjectStaleSummaries(
	projectIds: number[]
): Promise<ProjectStaleSummary[]> {
	const alerts = await getStaleAlertsForProjects(projectIds);
	const counts = new Map<number, number>();

	for (const alert of alerts) {
		counts.set(alert.projectId, (counts.get(alert.projectId) ?? 0) + 1);
	}

	return projectIds.map((projectId) => ({
		projectId,
		staleCount: counts.get(projectId) ?? 0
	}));
}