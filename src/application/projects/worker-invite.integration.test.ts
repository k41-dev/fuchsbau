import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { InviteProjectMemberUseCase } from './InviteProjectMemberUseCase';
import { RevokeWorkerInviteUseCase } from './RevokeWorkerInviteUseCase';
import { db } from '../../infrastructure/db/client';
import { project, projectMember, workerInvite } from '../../infrastructure/db/schema';
import {
	acceptPendingInvitesForUser,
	assertWorkerRegistrationAllowed
} from '../../lib/server/worker-invites';
import {
	createTestUser,
	deleteTestUsers,
	hasDatabaseUrl
} from '../../test/db-helpers';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('worker invites', () => {
	const inviteUseCase = new InviteProjectMemberUseCase();
	const revokeUseCase = new RevokeWorkerInviteUseCase();

	const suffix = `invite-${Date.now()}`;
	let ownerId = '';
	let existingWorkerId = '';
	let projectId = 0;
	const newWorkerEmail = `new-worker-${suffix}@fuchsbau.test`;
	const existingWorkerEmail = `existing-worker-${suffix}@fuchsbau.test`;

	beforeAll(async () => {
		const owner = await createTestUser(`${suffix}-owner`);
		const existingWorker = await createTestUser(`${suffix}-existing`, existingWorkerEmail);
		ownerId = owner.id;
		existingWorkerId = existingWorker.id;

		const [createdProject] = await db
			.insert(project)
			.values({
				name: `Invite test ${suffix}`,
				userId: ownerId
			})
			.returning();

		projectId = createdProject.id;
	});

	afterAll(async () => {
		await db.delete(projectMember).where(eq(projectMember.projectId, projectId));
		await db.delete(workerInvite).where(eq(workerInvite.projectId, projectId));
		await db.delete(project).where(eq(project.id, projectId));
		await deleteTestUsers([ownerId, existingWorkerId]);
	});

	it('creates an invite for unknown emails', async () => {
		const result = await inviteUseCase.execute({
			projectId,
			email: newWorkerEmail,
			requesterId: ownerId,
			origin: 'http://localhost:5173'
		});

		expect(result.type).toBe('invited');
		if (result.type === 'invited') {
			expect(result.inviteUrl).toContain('/register?invite=');
		}
	});

	it('adds an existing user directly to the crew', async () => {
		const result = await inviteUseCase.execute({
			projectId,
			email: existingWorkerEmail,
			requesterId: ownerId
		});

		expect(result.type).toBe('added');

		const [membership] = await db
			.select()
			.from(projectMember)
			.where(
				and(eq(projectMember.projectId, projectId), eq(projectMember.userId, existingWorkerId))
			);

		expect(membership).toBeTruthy();
	});

	it('accepts pending invites when a worker registers', async () => {
		const invite = await inviteUseCase.execute({
			projectId,
			email: `accept-${suffix}@fuchsbau.test`,
			requesterId: ownerId
		});

		expect(invite.type === 'invited' || invite.type === 'existing_invite').toBe(true);

		const worker = await createTestUser(`${suffix}-accepted`, `accept-${suffix}@fuchsbau.test`);
		const accepted = await acceptPendingInvitesForUser(worker.id, worker.email);

		expect(accepted).toBeGreaterThan(0);

		const [membership] = await db
			.select()
			.from(projectMember)
			.where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, worker.id)));

		expect(membership).toBeTruthy();

		await db.delete(projectMember).where(eq(projectMember.userId, worker.id));
		await deleteTestUsers([worker.id]);
	});

	it('requires an invite token for worker self-registration', async () => {
		await expect(
			assertWorkerRegistrationAllowed(newWorkerEmail, undefined, async () => 'worker')
		).rejects.toThrow(/invite/i);
	});

	it('lets owners revoke pending invites', async () => {
		const result = await inviteUseCase.execute({
			projectId,
			email: `revoke-${suffix}@fuchsbau.test`,
			requesterId: ownerId
		});

		expect(result.type === 'invited' || result.type === 'existing_invite').toBe(true);

		const [pending] = await db
			.select()
			.from(workerInvite)
			.where(
				and(
					eq(workerInvite.projectId, projectId),
					eq(workerInvite.email, `revoke-${suffix}@fuchsbau.test`)
				)
			);

		await revokeUseCase.execute({ inviteId: pending.id, requesterId: ownerId });

		const [revoked] = await db
			.select()
			.from(workerInvite)
			.where(eq(workerInvite.id, pending.id));

		expect(revoked.status).toBe('revoked');
	});
});