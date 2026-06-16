import type { LayoutServerLoad } from './$types';
import { getAccountRole, isSupervisor } from '$lib/server/account-role';
import { getSupervisorStaleAlerts } from '$lib/server/stale-alerts';

export const load: LayoutServerLoad = async ({ locals }) => {
	const accountRole = getAccountRole(locals.user);
	const staleAlerts =
		locals.user && isSupervisor(locals.user)
			? await getSupervisorStaleAlerts(locals.user.id)
			: [];

	return {
		user: locals.user,
		session: locals.session,
		accountRole,
		staleAlerts
	};
};