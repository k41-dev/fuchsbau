import type { AccountRole } from '$lib/account-role';

export type AppUser = {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	accountRole?: AccountRole;
};