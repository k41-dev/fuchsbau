export const env = {
	DATABASE_URL: process.env.DATABASE_URL,
	BETTER_AUTH_SECRET:
		process.env.BETTER_AUTH_SECRET ?? 'test-secret-key-minimum-32-characters',
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
};