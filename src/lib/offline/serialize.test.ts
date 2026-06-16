import { describe, expect, it } from 'vitest';
import { toPlainData } from './serialize';

describe('toPlainData', () => {
	it('strips reactive proxies so IndexedDB can store the value', () => {
		const projects = new Proxy(
			[
				{
					id: 1,
					name: 'Site A',
					address: null,
					roles: [{ id: 10, name: 'Electrician' }]
				}
			],
			{}
		);

		expect(() => structuredClone(projects)).toThrow();
		expect(toPlainData(projects)).toEqual([
			{
				id: 1,
				name: 'Site A',
				address: null,
				roles: [{ id: 10, name: 'Electrician' }]
			}
		]);
	});
});