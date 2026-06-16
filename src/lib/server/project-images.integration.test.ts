import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../infrastructure/db/client';
import { project } from '../../infrastructure/db/schema';
import { CreateProjectUseCase } from '../../application/projects/CreateProjectUseCase';
import { DrizzleProjectRepository } from '../../infrastructure/repositories/DrizzleProjectRepository';
import {
	attachProjectBackgroundImage,
	readProjectBackgroundImage,
	removeProjectBackgroundImage
} from './project-images';
import { createTestUser, deleteTestUsers, hasDatabaseUrl } from '../../test/db-helpers';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('project background images in database', () => {
	const userIds: string[] = [];
	const projectIds: number[] = [];

	afterEach(async () => {
		if (projectIds.length > 0) {
			await db.delete(project).where(eq(project.id, projectIds.pop()!));
		}
		await deleteTestUsers(userIds.splice(0));
	});

	it('stores, reads, and removes image bytes in the project row', async () => {
		const owner = await createTestUser('bg-image-owner');
		userIds.push(owner.id);

		const created = await new CreateProjectUseCase(new DrizzleProjectRepository()).execute({
			name: 'Cover photo site',
			ownerId: owner.id
		});
		projectIds.push(created.id!);

		const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'site.jpg', {
			type: 'image/jpeg'
		});

		await attachProjectBackgroundImage(created.id!, file);

		const stored = await readProjectBackgroundImage(created.id!);
		expect(stored?.contentType).toBe('image/jpeg');
		expect(stored?.data.byteLength).toBe(4);

		await removeProjectBackgroundImage(created.id!);
		expect(await readProjectBackgroundImage(created.id!)).toBeNull();
	});
});