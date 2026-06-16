import type { PageServerLoad, Actions } from './$types';
import { db } from '../../../../infrastructure/db/client';
import { projectMember, user } from '../../../../infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ClockInUseCase } from '../../../../application/clocking/ClockInUseCase';
import { ClockOutUseCase } from '../../../../application/clocking/ClockOutUseCase';
import { DrizzleTimeEntryRepository } from '../../../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { DrizzleRoleRepository } from '../../../../domain/repositories/DrizzleRoleRepository';
import { Role } from '../../../../domain/entities/Role';
import { requireSupervisor } from '$lib/server/account-role';
import { getProjectAccess } from '$lib/server/project-access';
import { InviteProjectMemberUseCase } from '../../../../application/projects/InviteProjectMemberUseCase';
import { RemoveProjectMemberUseCase } from '../../../../application/projects/RemoveProjectMemberUseCase';
import { RevokeWorkerInviteUseCase } from '../../../../application/projects/RevokeWorkerInviteUseCase';
import {
	attachProjectBackgroundImage,
	getBackgroundFileFromForm,
	removeProjectBackgroundImage
} from '$lib/server/project-images';
import { getPendingInvitesForProject } from '$lib/server/worker-invites';
import { ApproveAbsenceUseCase } from '../../../../application/clocking/ApproveAbsenceUseCase';
import { RejectAbsenceUseCase } from '../../../../application/clocking/RejectAbsenceUseCase';
import { getPendingAbsenceRequestsForProject } from '$lib/server/absence-review';
import { getActiveWorkers, getDaySummary } from '$lib/server/supervisor';
import { todayString } from '$lib/absence';

const approveAbsenceUseCase = new ApproveAbsenceUseCase();
const rejectAbsenceUseCase = new RejectAbsenceUseCase();

const timeEntryRepo = new DrizzleTimeEntryRepository();
const clockInUseCase = new ClockInUseCase(timeEntryRepo);
const clockOutUseCase = new ClockOutUseCase(timeEntryRepo);
const roleRepo = new DrizzleRoleRepository();
const inviteMemberUseCase = new InviteProjectMemberUseCase();
const removeMemberUseCase = new RemoveProjectMemberUseCase();
const revokeInviteUseCase = new RevokeWorkerInviteUseCase();

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const currentUser = requireSupervisor(locals);
	const projectId = parseInt(params.id);
	const access = await getProjectAccess(projectId, currentUser);

	const selectedDate = url.searchParams.get('date') ?? todayString();
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
	const pendingAbsenceRequests = access.canManage
		? await getPendingAbsenceRequestsForProject(projectId)
		: [];
	const pendingInvites = access.canManage ? await getPendingInvitesForProject(projectId) : [];

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
			: null,
		pendingAbsenceRequests: pendingAbsenceRequests.map((request) => ({
			...request,
			submittedAt: request.submittedAt.toISOString()
		})),
		pendingInvites: pendingInvites.map((invite) => ({
			...invite,
			expiresAt: invite.expiresAt.toISOString(),
			createdAt: invite.createdAt.toISOString()
		}))
	};
};

export const actions: Actions = {
	takeOverRole: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
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
		const currentUser = requireSupervisor(locals);
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

	inviteMember: async ({ request, params, locals, url }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		const formData = await request.formData();
		const email = (formData.get('email') as string) || '';

		try {
			const result = await inviteMemberUseCase.execute({
				projectId,
				email,
				requesterId: currentUser.id,
				origin: url.origin
			});

			if (result.type === 'added') {
				return { success: true, memberAdded: true, email: result.email };
			}

			return {
				success: true,
				inviteCreated: true,
				email: result.email,
				inviteUrl: result.inviteUrl,
				resentInvite: result.type === 'existing_invite'
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to invite crew member';
			return { success: false, error: message };
		}
	},

	revokeInvite: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		await getProjectAccess(projectId, currentUser);

		const formData = await request.formData();
		const inviteId = Number.parseInt(formData.get('inviteId') as string, 10);

		if (!inviteId || Number.isNaN(inviteId)) {
			return { success: false, error: 'Invalid invite' };
		}

		try {
			await revokeInviteUseCase.execute({
				inviteId,
				requesterId: currentUser.id
			});
			return { success: true, inviteRevoked: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to revoke invite';
			return { success: false, error: message };
		}
	},

	removeMember: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
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
		const currentUser = requireSupervisor(locals);
		await getProjectAccess(parseInt(params.id), currentUser);

		try {
			await clockOutUseCase.execute(currentUser.id);
			return { success: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to clock out';
			return { success: false, error: message };
		}
	},

	approveAbsence: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can approve absences' };
		}

		const formData = await request.formData();
		const requestGroupId = (formData.get('requestGroupId') as string) || '';

		if (!requestGroupId) {
			return { success: false, error: 'Invalid absence request' };
		}

		try {
			const count = await approveAbsenceUseCase.execute({
				requestGroupId,
				reviewedByUserId: currentUser.id
			});
			return { success: true, absenceReviewed: true, reviewedCount: count };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to approve absence';
			return { success: false, error: message };
		}
	},

	rejectAbsence: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can reject absences' };
		}

		const formData = await request.formData();
		const requestGroupId = (formData.get('requestGroupId') as string) || '';
		const reviewNote = (formData.get('reviewNote') as string) || '';

		if (!requestGroupId) {
			return { success: false, error: 'Invalid absence request' };
		}

		try {
			const count = await rejectAbsenceUseCase.execute({
				requestGroupId,
				reviewedByUserId: currentUser.id,
				reviewNote
			});
			return { success: true, absenceReviewed: true, reviewedCount: count };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to reject absence';
			return { success: false, error: message };
		}
	},

	updateBackground: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can change the cover image' };
		}

		const formData = await request.formData();
		const background = getBackgroundFileFromForm(formData);

		if (!background) {
			return { success: false, error: 'Choose an image to upload' };
		}

		try {
			await attachProjectBackgroundImage(projectId, background);
			return { success: true, backgroundUpdated: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to update cover image';
			return { success: false, error: message };
		}
	},

	removeBackground: async ({ params, locals }) => {
		const currentUser = requireSupervisor(locals);
		const projectId = parseInt(params.id);
		const access = await getProjectAccess(projectId, currentUser);

		if (!access.canManage) {
			return { success: false, error: 'Only the project owner can remove the cover image' };
		}

		try {
			await removeProjectBackgroundImage(projectId);
			return { success: true, backgroundRemoved: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to remove cover image';
			return { success: false, error: message };
		}
	},

	forceClockOut: async ({ request, params, locals }) => {
		const currentUser = requireSupervisor(locals);
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