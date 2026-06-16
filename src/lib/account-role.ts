export const ACCOUNT_ROLES = ['supervisor', 'worker'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function isAccountRole(value: string | null | undefined): value is AccountRole {
	return value === 'supervisor' || value === 'worker';
}

export function getAccountRole(user: { accountRole?: string | null } | null | undefined): AccountRole {
	return user?.accountRole === 'supervisor' ? 'supervisor' : 'worker';
}