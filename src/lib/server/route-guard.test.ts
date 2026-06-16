import { describe, expect, it } from 'vitest';
import {
	getLoginRedirect,
	isPublicRoute,
	isSupervisorRoute,
	resolvePostLoginRedirect,
	resolveRedirectTarget
} from './route-guard';

describe('isPublicRoute', () => {
	it('allows home, login, register, auth API, and PWA assets', () => {
		expect(isPublicRoute('/')).toBe(true);
		expect(isPublicRoute('/login')).toBe(true);
		expect(isPublicRoute('/register')).toBe(true);
		expect(isPublicRoute('/api/auth/sign-in')).toBe(true);
		expect(isPublicRoute('/manifest.webmanifest')).toBe(true);
		expect(isPublicRoute('/sw.js')).toBe(true);
		expect(isPublicRoute('/api/health')).toBe(true);
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

describe('isSupervisorRoute', () => {
	it('matches supervisor areas only', () => {
		expect(isSupervisorRoute('/projects')).toBe(true);
		expect(isSupervisorRoute('/projects/3')).toBe(true);
		expect(isSupervisorRoute('/reports')).toBe(true);
		expect(isSupervisorRoute('/reports/export')).toBe(true);
		expect(isSupervisorRoute('/')).toBe(false);
		expect(isSupervisorRoute('/api/worker')).toBe(false);
	});
});

describe('resolvePostLoginRedirect', () => {
	it('sends supervisors to projects by default', () => {
		expect(resolvePostLoginRedirect('/', 'supervisor')).toBe('/projects');
		expect(resolvePostLoginRedirect(null, 'supervisor')).toBe('/projects');
	});

	it('keeps workers off supervisor routes', () => {
		expect(resolvePostLoginRedirect('/reports', 'worker')).toBe('/');
		expect(resolvePostLoginRedirect('/', 'worker')).toBe('/');
	});

	it('honors safe supervisor deep links', () => {
		expect(resolvePostLoginRedirect('/projects/4', 'supervisor')).toBe('/projects/4');
	});
});