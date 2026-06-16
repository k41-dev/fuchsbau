import { redirect } from '@sveltejs/kit';
import { sql, eq } from 'drizzle-orm';
import type { AppUser } from '$lib/auth-user';
import type { AccountRole } from '$lib/account-role';
import { env } from '$env/dynamic/private';
import { db } from '../../infrastructure/db/client';
import { user } from '../../infrastructure/db/schema';
import { getAccountRole as getRole } from '$lib/account-role';
import { requireUser } from './require-auth';

export function getAccountRole(user: AppUser | null | undefined): AccountRole {
	return getRole(user);
}

export async function loadAccountRoleFromDb(userId: string): Promise<AccountRole> {
	const [row] = await db
		.select({ accountRole: user.accountRole })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	return row?.accountRole === 'supervisor' ? 'supervisor' : 'worker';
}

/** Session payloads may omit custom fields — always trust the database. */
export async function enrichUserAccountRole(user: AppUser): Promise<AppUser> {
	const accountRole = await loadAccountRoleFromDb(user.id);
	return { ...user, accountRole };
}

export function isSupervisor(user: AppUser | null | undefined): boolean {
	return getAccountRole(user) === 'supervisor';
}

export function requireSupervisor(locals: App.Locals): AppUser {
	const currentUser = requireUser(locals);

	if (!isSupervisor(currentUser)) {
		throw redirect(303, '/');
	}

	return currentUser;
}

export async function resolveInitialAccountRole(email: string): Promise<AccountRole> {
	const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(user);

	if (count === 0) {
		return 'supervisor';
	}

	const bootstrapEmail = env.BOOTSTRAP_SUPERVISOR_EMAIL?.trim().toLowerCase();
	if (bootstrapEmail && email.trim().toLowerCase() === bootstrapEmail) {
		return 'supervisor';
	}

	return 'worker';
}

export async function promoteUserToSupervisor(params: {
	requesterId: string;
	email: string;
}): Promise<void> {
	const [requester] = await db
		.select({ accountRole: user.accountRole })
		.from(user)
		.where(eq(user.id, params.requesterId))
		.limit(1);

	if (!requester || requester.accountRole !== 'supervisor') {
		throw new Error('Only supervisors can grant supervisor access');
	}

	const normalizedEmail = params.email.trim().toLowerCase();

	const [target] = await db
		.select()
		.from(user)
		.where(sql`lower(${user.email}) = ${normalizedEmail}`)
		.limit(1);

	if (!target) {
		throw new Error('No user found with that email. Invite them to register first.');
	}

	if (target.accountRole === 'supervisor') {
		throw new Error('This user is already a supervisor');
	}

	await db
		.update(user)
		.set({ accountRole: 'supervisor', updatedAt: new Date() })
		.where(eq(user.id, target.id));
}

