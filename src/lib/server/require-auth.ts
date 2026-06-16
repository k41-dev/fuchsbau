import { redirect } from '@sveltejs/kit';
import type { User } from 'better-auth';

export function requireUser(locals: App.Locals): User {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	return locals.user;
}