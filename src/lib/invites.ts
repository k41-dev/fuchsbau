export const INVITE_COOKIE_NAME = 'fuchsbau_invite';

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const INVITE_TTL_DAYS = 7;

export function normalizeInviteEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function buildRegisterInvitePath(token: string): string {
	return `/register?invite=${encodeURIComponent(token)}`;
}