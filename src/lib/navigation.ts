import type { AccountRole } from '$lib/account-role';

const SUPERVISOR_PREFIXES = ['/projects', '/reports'];

export function isSupervisorRoute(pathname: string): boolean {
	return SUPERVISOR_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

export function resolveRedirectTarget(redirectTo: string | null | undefined): string {
	if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
		return '/';
	}

	if (redirectTo.startsWith('/login') || redirectTo.startsWith('/register')) {
		return '/';
	}

	return redirectTo;
}

export function resolvePostLoginRedirect(
	redirectTo: string | null | undefined,
	accountRole: AccountRole
): string {
	const target = resolveRedirectTarget(redirectTo);

	if (accountRole === 'worker' && isSupervisorRoute(target)) {
		return '/';
	}

	if ((!redirectTo || redirectTo === '/') && accountRole === 'supervisor') {
		return '/projects';
	}

	return target;
}