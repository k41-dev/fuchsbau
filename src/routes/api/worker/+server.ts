import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { User } from 'better-auth';
import { auth } from '$lib/server/auth';
import { getProjectAccess } from '$lib/server/project-access';
import { getWorkerStatus } from '$lib/server/worker-status';
import { DrizzleTimeEntryRepository } from '../../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { DrizzleBreakRepository } from '../../../infrastructure/repositories/DrizzleBreakRepository';
import { DrizzleRoleRepository } from '../../../domain/repositories/DrizzleRoleRepository';
import { ClockInUseCase } from '../../../application/clocking/ClockInUseCase';
import { ClockOutUseCase } from '../../../application/clocking/ClockOutUseCase';
import { StartBreakUseCase } from '../../../application/clocking/StartBreakUseCase';
import { EndBreakUseCase } from '../../../application/clocking/EndBreakUseCase';
import { ReportAbsenceUseCase } from '../../../application/clocking/ReportAbsenceUseCase';
import { CancelAbsenceUseCase } from '../../../application/clocking/CancelAbsenceUseCase';
import type { AbsenceType } from '$lib/absence';

const timeEntryRepo = new DrizzleTimeEntryRepository();
const breakRepo = new DrizzleBreakRepository();
const roleRepo = new DrizzleRoleRepository();
const clockInUseCase = new ClockInUseCase(timeEntryRepo);
const clockOutUseCase = new ClockOutUseCase(timeEntryRepo, breakRepo);
const startBreakUseCase = new StartBreakUseCase(timeEntryRepo, breakRepo);
const endBreakUseCase = new EndBreakUseCase(timeEntryRepo, breakRepo);
const reportAbsenceUseCase = new ReportAbsenceUseCase(timeEntryRepo);
const cancelAbsenceUseCase = new CancelAbsenceUseCase();

async function handleAction(
	userId: string,
	user: User,
	body: {
		action: string;
		projectId?: number;
		roleId?: number;
		type?: AbsenceType;
		note?: string;
		startDate?: string;
		endDate?: string;
	}
) {
	switch (body.action) {
		case 'status':
			return { status: await getWorkerStatus(userId) };

		case 'clock-in': {
			if (!body.projectId) throw new Error('projectId is required');
			await getProjectAccess(body.projectId, user);

			const projectRoles = await roleRepo.findByProjectId(body.projectId);
			if (projectRoles.length > 0) {
				if (!body.roleId) throw new Error('Select your role before clocking in');
				const validRole = projectRoles.some((r) => r.id === body.roleId);
				if (!validRole) throw new Error('Invalid role for this job site');
			}

			await clockInUseCase.execute({
				userId,
				projectId: body.projectId,
				roleId: body.roleId ?? null
			});
			return { status: await getWorkerStatus(userId) };
		}

		case 'clock-out':
			await clockOutUseCase.execute(userId);
			return { status: await getWorkerStatus(userId) };

		case 'start-break':
			await startBreakUseCase.execute(userId);
			return { status: await getWorkerStatus(userId) };

		case 'end-break':
			await endBreakUseCase.execute(userId);
			return { status: await getWorkerStatus(userId) };

		case 'report-absence':
		case 'report-sick': {
			const type = body.type ?? (body.action === 'report-sick' ? 'sick' : undefined);
			if (!type) throw new Error('Absence type is required');
			await reportAbsenceUseCase.execute({
				userId,
				type,
				note: body.note,
				startDate: body.startDate,
				endDate: body.endDate
			});
			return { status: await getWorkerStatus(userId) };
		}

		case 'cancel-absence':
		case 'cancel-sick':
			await cancelAbsenceUseCase.execute(userId);
			return { status: await getWorkerStatus(userId) };

		default:
			throw new Error('Unknown action');
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const status = await getWorkerStatus(session.user.id);
	return json({ success: true, status });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const result = await handleAction(session.user.id, session.user, body);
		return json({ success: true, ...result });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status =
			error && typeof error === 'object' && 'status' in error && error.status === 403 ? 403 : 400;
		return json({ success: false, error: message }, { status });
	}
};