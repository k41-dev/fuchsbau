import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAccountRole } from '$lib/server/account-role';
import { resolvePostLoginRedirect, resolveRedirectTarget } from '$lib/server/route-guard';

export const load: PageServerLoad = async ({ locals, url }) => {
	const requestedRedirect = url.searchParams.get('redirectTo');

	if (locals.user) {
		throw redirect(
			303,
			resolvePostLoginRedirect(requestedRedirect, getAccountRole(locals.user))
		);
	}

	return {
		redirectTo: resolveRedirectTarget(requestedRedirect)
	};
};