import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project } from '../../infrastructure/db/schema';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const MAX_PROJECT_IMAGE_BYTES = 5 * 1024 * 1024;

export function getBackgroundFileFromForm(formData: FormData): File | null {
	const file = formData.get('background');
	if (!(file instanceof File) || file.size === 0) return null;
	return file;
}

export function validateProjectImageFile(file: File): void {
	if (!file || file.size === 0) {
		throw new Error('No image file provided');
	}

	if (file.size > MAX_PROJECT_IMAGE_BYTES) {
		throw new Error('Image must be 5 MB or smaller');
	}

	if (!ALLOWED_MIME_TYPES.has(file.type)) {
		throw new Error('Only JPG, PNG, or WebP images are supported');
	}
}

export async function readProjectBackgroundImage(projectId: number): Promise<{
	data: Buffer;
	contentType: string;
} | null> {
	const [row] = await db
		.select({
			backgroundImageData: project.backgroundImageData,
			backgroundImageContentType: project.backgroundImageContentType
		})
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row?.backgroundImageData || !row.backgroundImageContentType) {
		return null;
	}

	return {
		data: row.backgroundImageData,
		contentType: row.backgroundImageContentType
	};
}

async function setProjectBackgroundImage(projectId: number, file: File): Promise<void> {
	validateProjectImageFile(file);

	const data = Buffer.from(await file.arrayBuffer());

	await db
		.update(project)
		.set({
			backgroundImageData: data,
			backgroundImageContentType: file.type,
			updatedAt: new Date()
		})
		.where(eq(project.id, projectId));
}

export async function attachProjectBackgroundImage(projectId: number, file: File): Promise<void> {
	await setProjectBackgroundImage(projectId, file);
}

export async function removeProjectBackgroundImage(projectId: number): Promise<void> {
	await db
		.update(project)
		.set({
			backgroundImageData: null,
			backgroundImageContentType: null,
			updatedAt: new Date()
		})
		.where(eq(project.id, projectId));
}