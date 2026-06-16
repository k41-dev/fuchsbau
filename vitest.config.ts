import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['./src/test/setup.ts']
	},
	resolve: {
		alias: {
			$env: path.resolve('./src/test/env'),
			$lib: path.resolve('./src/lib')
		}
	}
});