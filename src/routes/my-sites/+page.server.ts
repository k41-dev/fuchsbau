import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/require-auth';
import { loadWorkerDashboard } from '$lib/server/worker-page-data';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, projects: [], workerStatus: null };
	}

	const user = requireUser(locals);
	const { projects, workerStatus } = await loadWorkerDashboard(user.id);

	return {
		user: locals.user,
		projects,
		workerStatus
	};
};