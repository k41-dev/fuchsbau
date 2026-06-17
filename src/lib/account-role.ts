export const ACCOUNT_ROLES = ['supervisor', 'worker'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function getAccountRole(user: { accountRole?: string | null } | null | undefined): AccountRole {
	return user?.accountRole === 'supervisor' ? 'supervisor' : 'worker';
}