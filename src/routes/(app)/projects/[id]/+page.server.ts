import type { PageServerLoad, Actions } from './$types';
import { db } from '../../../../infrastructure/db/client';
import { projectMember, user } from '../../../../infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ClockInUseCase } from '../../../../application/clocking/ClockInUseCase';
import { ClockOutUseCase } from '../../../../application/clocking/ClockOutUseCase';
import { DrizzleTimeEntryRepository } from '../../../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { DrizzleRoleRepository } from '../../../../domain/repositories/DrizzleRoleRepository';
import { Role } from '../../../../domain/entities/Role';
import { requireUser } from '$lib/server/require-auth';
import { getProjectAccess } from '$lib/server/project-access';
import { AddProjectMemberUseCase } from '../../../../application/projects/AddProjectMemberUseCase';
import { RemoveProjectMemberUseCase } from '../../../../application/projects/RemoveProjectMemberUseCase';
import { getActiveWorkers, getDaySummary, getTodayString } from '$lib/server/supervisor';

const timeEntryRepo = new DrizzleTimeEntryRepository();
const clockInUseCase = new ClockInUseCase(timeEntryRepo);
const clockOutUseCase = new ClockOutUseCase(timeEntryRepo);
const roleRepo = new DrizzleRoleRepository();
const addMemberUseCase = new AddProjectMemberUseCase();
const removeMemberUseCase = new RemoveProjectMemberUseCase();

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const currentUser = requireUser(locals);
	const projectId = parseInt(params.id);
	const access = await getProjectAccess(projectId, currentUser);

	const selectedDate = url.searchParams.get('date') ?? getTodayString();
	const roles = (await roleRepo.findByProjectId(projectId)).map((r) => r.toRecord());

	const activeWorkers = await getActiveWorkers(projectId);
	const daySummary = await getDaySummary(projectId, selectedDate);

	const crew = await db
		.select({
			memberId: projectMember.id,
			userId: user.id,
			name: user.name,
			email: user.email,
			joinedAt: projectMember.createdAt
		})
		.from(projectMember)
		.innerJoin(user, eq(projectMember.userId, user.id))
		.where(eq(projectMember.projectId, projectId))
		.orderBy(user.name);

	const myActive = activeWorkers.find((w) => w.userId === currentUser.id);

	return {
		project: access.project,
		roles,
		crew,
		selectedDate,
		activeWorkers: activeWorkers.map((w) => ({
			...w,
			startTime: w.startTime.toISOString()
		})),
		daySummary: {
			...daySummary,
			workers: daySummary.workers,
			staleWorkers: daySummary.staleWorkers.map((w) => ({
				...w,
				startTime: w.startTime.toISOString()
			}))
		},
		stats: {
			activeCount: activeWorkers.length,
			totalHours: daySummary.totalHours,
			clockInCount: daySummary.clockInCount,
			workerCount: daySummary.workerCount,
			staleCount: daySummary.staleWorkers.length,
			allClockedOut: daySummary.allClockedOut,
			absenceCount: daySummary.absenceCount,
			sickCount: daySummary.sickCount,
			vacationCount: daySummary.vacationCount
		},
		currentUserId: currentUser.id,
		isOwner: access.isOwner,
		canManage: access.canManage,
		canClockIn: access.canClockIn,
		myActiveEntry: myActive
			? { id: myActive.entryId, startTime: myActive.startTime.toISOString() }
			: null
	};
};

export const actions: Actions = {
	takeOverRole: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);
		const projectId = parseInt(params.id);
		await getProjectAccess(projectId, currentUser);

		const formData = await request.formData();
		const roleId = parseInt(formData.get('roleId') as string);

		try {
			await clockInUseCase.execute({
				userId: currentUser.id,
				projectId,
				roleId,
				description: null
			});
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to take over role';
			return { success: false, error: message };
		}
	},

	addRole: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can add roles' };
		}

		const formData = await request.formData();
		const name = ((formData.get('name') as string) || '').trim();

		if (!name) return { success: false, error: 'Role name is required' };

		try {
			const newRole = Role.create({ projectId, name });
			await roleRepo.save(newRole);
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to add role';
			return { success: false, error: message };
		}
	},

	addMember: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);
		const projectId = parseInt(params.id);
		const formData = await request.formData();
		const email = (formData.get('email') as string) || '';

		try {
			await addMemberUseCase.execute({
				projectId,
				email,
				requesterId: currentUser.id
			});
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to add crew member';
			return { success: false, error: message };
		}
	},

	removeMember: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);
		const projectId = parseInt(params.id);
		const formData = await request.formData();
		const memberUserId = formData.get('memberUserId') as string;

		try {
			await removeMemberUseCase.execute({
				projectId,
				memberUserId,
				requesterId: currentUser.id
			});
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to remove crew member';
			return { success: false, error: message };
		}
	},

	clockOut: async ({ params, locals }) => {
		const currentUser = requireUser(locals);
		await getProjectAccess(parseInt(params.id), currentUser);

		try {
			await clockOutUseCase.execute(currentUser.id);
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to clock out';
			return { success: false, error: message };
		}
	},

	forceClockOut: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can clock out crew members' };
		}

		const formData = await request.formData();
		const workerUserId = formData.get('userId') as string;

		try {
			await clockOutUseCase.execute(workerUserId);
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to clock out worker';
			return { success: false, error: message };
		}
	}
};