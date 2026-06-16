import { describe, expect, it } from 'vitest';
import { getAccountRole } from '$lib/account-role';
import { isSupervisor } from './account-role';

describe('account role helpers', () => {
	it('treats missing role as worker', () => {
		expect(getAccountRole(null)).toBe('worker');
		expect(getAccountRole({ id: '1', email: 'a@b.test' } as App.Locals['user'])).toBe('worker');
	});

	it('recognizes supervisors', () => {
		const supervisor = {
			id: '1',
			email: 'sup@b.test',
			accountRole: 'supervisor'
		} as App.Locals['user'];

		expect(getAccountRole(supervisor)).toBe('supervisor');
		expect(isSupervisor(supervisor)).toBe(true);
	});
});