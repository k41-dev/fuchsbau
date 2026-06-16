import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error('DATABASE_URL is required to run migrations');
	process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
	await migrate(db, { migrationsFolder: path.join(rootDir, 'drizzle') });
	console.log('Migrations applied successfully');
} catch (error) {
	console.error('Migration failed:', error);
	process.exit(1);
} finally {
	await client.end();
}