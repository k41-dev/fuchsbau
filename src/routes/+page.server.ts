import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/require-auth';
import { DrizzleProjectRepository } from '../infrastructure/repositories/DrizzleProjectRepository';
import { DrizzleRoleRepository } from '../domain/repositories/DrizzleRoleRepository';
import { getWorkerStatus } from '$lib/server/worker-status';

const projectRepo = new DrizzleProjectRepository();
const roleRepo = new DrizzleRoleRepository();

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, projects: [], workerStatus: null };
	}

	const user = requireUser(locals);
	const projectEntities = await projectRepo.findByUserId(user.id);
	const projects = await Promise.all(
		projectEntities.map(async (p) => {
			const roles = (await roleRepo.findByProjectId(p.id!)).map((r) => ({
				id: r.id!,
				name: r.name
			}));
			return { ...p.toRecord(), roles };
		})
	);
	const workerStatus = await getWorkerStatus(user.id);

	return {
		user: locals.user,
		projects,
		workerStatus
	};
};