import { describe, expect, it } from 'vitest';
import { getLoginRedirect, isPublicRoute, resolveRedirectTarget } from './route-guard';

describe('isPublicRoute', () => {
	it('allows home, login, register, and auth API', () => {
		expect(isPublicRoute('/')).toBe(true);
		expect(isPublicRoute('/login')).toBe(true);
		expect(isPublicRoute('/register')).toBe(true);
		expect(isPublicRoute('/api/auth/sign-in')).toBe(true);
	});

	it('requires auth for app routes', () => {
		expect(isPublicRoute('/projects')).toBe(false);
		expect(isPublicRoute('/reports')).toBe(false);
		expect(isPublicRoute('/api/worker')).toBe(false);
	});
});

describe('getLoginRedirect', () => {
	it('preserves protected destination in redirectTo', () => {
		expect(getLoginRedirect('/reports', '?from=2026-06-01')).toBe(
			'/login?redirectTo=%2Freports%3Ffrom%3D2026-06-01'
		);
	});

	it('falls back to plain login for public destinations', () => {
		expect(getLoginRedirect('/login', '')).toBe('/login');
	});
});

describe('resolveRedirectTarget', () => {
	it('rejects external and auth loop targets', () => {
		expect(resolveRedirectTarget('https://evil.test')).toBe('/');
		expect(resolveRedirectTarget('//evil.test')).toBe('/');
		expect(resolveRedirectTarget('/login')).toBe('/');
	});

	it('accepts internal paths', () => {
		expect(resolveRedirectTarget('/projects/1')).toBe('/projects/1');
	});
});