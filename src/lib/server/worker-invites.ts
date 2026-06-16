import { and, eq, gt, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '../../infrastructure/db/client';
import { project, projectMember, workerInvite } from '../../infrastructure/db/schema';
import {
	buildRegisterInvitePath,
	INVITE_TTL_DAYS,
	normalizeInviteEmail,
	type InviteStatus
} from '../invites';

export type InviteRegistrationDetails = {
	token: string;
	email: string;
	projectId: number;
	projectName: string;
	expiresAt: Date;
};

export type PendingWorkerInvite = {
	id: number;
	email: string;
	token: string;
	invitePath: string;
	expiresAt: Date;
	createdAt: Date;
};

function inviteExpiryDate(): Date {
	return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildInviteUrl(token: string, origin?: string): string {
	const base = (origin ?? env.BETTER_AUTH_URL ?? 'http://localhost:5173').replace(/\/$/, '');
	return `${base}${buildRegisterInvitePath(token)}`;
}

export async function getInviteRegistrationDetails(
	token: string
): Promise<InviteRegistrationDetails | null> {
	const [row] = await db
		.select({
			token: workerInvite.token,
			email: workerInvite.email,
			projectId: workerInvite.projectId,
			projectName: project.name,
			expiresAt: workerInvite.expiresAt,
			status: workerInvite.status
		})
		.from(workerInvite)
		.innerJoin(project, eq(workerInvite.projectId, project.id))
		.where(eq(workerInvite.token, token))
		.limit(1);

	if (!row || row.status !== 'pending' || row.expiresAt <= new Date()) {
		return null;
	}

	return {
		token: row.token,
		email: row.email,
		projectId: row.projectId,
		projectName: row.projectName,
		expiresAt: row.expiresAt
	};
}

export async function assertWorkerRegistrationAllowed(
	email: string,
	inviteToken: string | undefined,
	resolveRole: (email: string) => Promise<'worker' | 'supervisor'>
): Promise<void> {
	const accountRole = await resolveRole(email);
	if (accountRole === 'supervisor') return;

	if (!inviteToken) {
		throw new Error('An invite link is required to create a worker account');
	}

	const invite = await getInviteRegistrationDetails(inviteToken);
	if (!invite) {
		throw new Error('This invite link is invalid or has expired');
	}

	if (invite.email !== normalizeInviteEmail(email)) {
		throw new Error('This invite was sent to a different email address');
	}
}

export async function acceptPendingInvitesForUser(userId: string, email: string): Promise<number> {
	const normalizedEmail = normalizeInviteEmail(email);
	const now = new Date();

	const invites = await db
		.select()
		.from(workerInvite)
		.where(
			and(
				sql`lower(${workerInvite.email}) = ${normalizedEmail}`,
				eq(workerInvite.status, 'pending'),
				gt(workerInvite.expiresAt, now)
			)
		);

	let accepted = 0;

	for (const invite of invites) {
		const existing = await db
			.select({ id: projectMember.id })
			.from(projectMember)
			.where(
				and(eq(projectMember.projectId, invite.projectId), eq(projectMember.userId, userId))
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(projectMember).values({
				projectId: invite.projectId,
				userId
			});
		}

		await db
			.update(workerInvite)
			.set({
				status: 'accepted',
				acceptedByUserId: userId,
				acceptedAt: now
			})
			.where(eq(workerInvite.id, invite.id));

		accepted += 1;
	}

	return accepted;
}

export async function getPendingInvitesForProject(projectId: number): Promise<PendingWorkerInvite[]> {
	const rows = await db
		.select({
			id: workerInvite.id,
			email: workerInvite.email,
			token: workerInvite.token,
			expiresAt: workerInvite.expiresAt,
			createdAt: workerInvite.createdAt
		})
		.from(workerInvite)
		.where(
			and(
				eq(workerInvite.projectId, projectId),
				eq(workerInvite.status, 'pending' as InviteStatus),
				gt(workerInvite.expiresAt, new Date())
			)
		)
		.orderBy(workerInvite.createdAt);

	return rows.map((row) => ({
		id: row.id,
		email: row.email,
		token: row.token,
		invitePath: buildRegisterInvitePath(row.token),
		expiresAt: row.expiresAt,
		createdAt: row.createdAt
	}));
}

export async function createWorkerInvite(params: {
	projectId: number;
	email: string;
	invitedByUserId: string;
}): Promise<{ token: string; expiresAt: Date }> {
	const normalizedEmail = normalizeInviteEmail(params.email);
	const expiresAt = inviteExpiryDate();
	const token = crypto.randomUUID();

	await db.insert(workerInvite).values({
		projectId: params.projectId,
		email: normalizedEmail,
		token,
		invitedByUserId: params.invitedByUserId,
		status: 'pending',
		expiresAt
	});

	return { token, expiresAt };
}

export async function findPendingInvite(projectId: number, email: string) {
	const normalizedEmail = normalizeInviteEmail(email);

	const [row] = await db
		.select()
		.from(workerInvite)
		.where(
			and(
				eq(workerInvite.projectId, projectId),
				sql`lower(${workerInvite.email}) = ${normalizedEmail}`,
				eq(workerInvite.status, 'pending'),
				gt(workerInvite.expiresAt, new Date())
			)
		)
		.limit(1);

	return row ?? null;
}