import { DrizzleProjectRepository } from '../../infrastructure/repositories/DrizzleProjectRepository';
import { DrizzleRoleRepository } from '../../domain/repositories/DrizzleRoleRepository';
import { getWorkerStatus } from './worker-status';

const projectRepo = new DrizzleProjectRepository();
const roleRepo = new DrizzleRoleRepository();

export async function loadWorkerDashboard(userId: string) {
	const projectEntities = await projectRepo.findByUserId(userId);
	const projects = await Promise.all(
		projectEntities.map(async (p) => {
			const roles = (await roleRepo.findByProjectId(p.id!)).map((r) => ({
				id: r.id!,
				name: r.name
			}));
			return { ...p.toRecord(), roles };
		})
	);
	const workerStatus = await getWorkerStatus(userId);

	return { projects, workerStatus };
}