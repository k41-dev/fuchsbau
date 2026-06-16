export function getProjectImageUrl(
	projectId: number,
	hasBackgroundImage: boolean | null | undefined
): string | null {
	if (!hasBackgroundImage) return null;
	return `/project-images/${projectId}`;
}