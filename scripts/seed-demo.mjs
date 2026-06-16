import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import { hashPassword } from '@better-auth/utils/password';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
config({ path: path.join(rootDir, '.env'), quiet: true });

const DEMO_PASSWORD = 'demo1234';
const DEMO_DOMAIN = '@demo.fuchsbau';

const accounts = [
	{ name: 'Anna Supervisor', email: `anna.supervisor${DEMO_DOMAIN}`, role: 'supervisor' },
	{ name: 'Lukas Worker', email: `lukas.worker${DEMO_DOMAIN}`, role: 'worker' },
	{ name: 'Maria Worker', email: `maria.worker${DEMO_DOMAIN}`, role: 'worker' },
	{ name: 'Tim Worker', email: `tim.worker${DEMO_DOMAIN}`, role: 'worker' },
	{ name: 'Sara Worker', email: `sara.worker${DEMO_DOMAIN}`, role: 'worker' }
];

const sites = [
	{
		name: 'Riverside Office',
		address: 'Riverside Ave 12, Berlin',
		description: 'Office fit-out — demo site',
		roles: ['Foreman', 'Electrician', 'Plumber'],
		crew: ['lukas', 'maria']
	},
	{
		name: 'Harbor Renovation',
		address: 'Dock Street 3, Hamburg',
		description: 'Waterfront renovation — demo site',
		roles: ['Site lead', 'Carpenter'],
		crew: ['lukas', 'tim']
	},
	{
		name: 'Hilltop Housing',
		address: 'Hill Road 88, Munich',
		description: 'Residential build — demo site',
		roles: ['Mason', 'Painter'],
		crew: ['sara']
	}
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function clearDemoData() {
	const demoUsers = await sql`
		SELECT id FROM "user" WHERE email LIKE ${`%${DEMO_DOMAIN}`}
	`;
	const ids = demoUsers.map((u) => u.id);
	if (ids.length === 0) return;

	await sql`DELETE FROM time_entry WHERE user_id = ANY(${ids})`;
	await sql`DELETE FROM absence WHERE user_id = ANY(${ids})`;
	await sql`
		DELETE FROM project_member
		WHERE user_id = ANY(${ids})
		   OR project_id IN (SELECT id FROM project WHERE user_id = ANY(${ids}))
	`;
	await sql`DELETE FROM role WHERE project_id IN (SELECT id FROM project WHERE user_id = ANY(${ids}))`;
	await sql`DELETE FROM project WHERE user_id = ANY(${ids})`;
	await sql`DELETE FROM account WHERE user_id = ANY(${ids})`;
	await sql`DELETE FROM session WHERE user_id = ANY(${ids})`;
	await sql`DELETE FROM "user" WHERE id = ANY(${ids})`;
}

async function createDemoUser({ name, email, role }) {
	const id = randomUUID();
	const now = new Date();
	const passwordHash = await hashPassword(DEMO_PASSWORD);

	await sql`
		INSERT INTO "user" (id, name, email, email_verified, account_role, created_at, updated_at)
		VALUES (${id}, ${name}, ${email}, true, ${role}, ${now}, ${now})
	`;

	await sql`
		INSERT INTO account (
			id, user_id, account_id, provider_id, password, created_at, updated_at
		)
		VALUES (
			${randomUUID()},
			${id},
			${id},
			'credential',
			${passwordHash},
			${now},
			${now}
		)
	`;

	return { id, email };
}

try {
	console.log('Clearing previous demo data...');
	await clearDemoData();

	const userByKey = {};
	for (const account of accounts) {
		const created = await createDemoUser(account);
		const key = account.email.split('@')[0].split('.')[0];
		userByKey[key] = created;
		console.log(`Created ${account.role}: ${account.email}`);
	}

	const supervisorId = userByKey.anna.id;

	for (const site of sites) {
		const [project] = await sql`
			INSERT INTO project (name, description, address, color, user_id)
			VALUES (
				${site.name},
				${site.description},
				${site.address},
				'#059669',
				${supervisorId}
			)
			RETURNING id
		`;

		await sql`
			INSERT INTO project_member (project_id, user_id)
			VALUES (${project.id}, ${supervisorId})
		`;

		for (const crewKey of site.crew) {
			const member = userByKey[crewKey];
			if (!member) continue;
			await sql`
				INSERT INTO project_member (project_id, user_id)
				VALUES (${project.id}, ${member.id})
				ON CONFLICT DO NOTHING
			`;
		}

		for (const roleName of site.roles) {
			await sql`
				INSERT INTO role (project_id, name)
				VALUES (${project.id}, ${roleName})
			`;
		}

		console.log(`Created site: ${site.name}`);
	}

	// Demo forgotten clock-out: Maria still "on site" since yesterday at Riverside
	const maria = userByKey.maria;
	const riverside = await sql`
		SELECT id FROM project WHERE name = 'Riverside Office' LIMIT 1
	`;
	const electrician = await sql`
		SELECT id FROM role WHERE project_id = ${riverside[0].id} AND name = 'Electrician' LIMIT 1
	`;
	if (maria && riverside[0] && electrician[0]) {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		yesterday.setHours(16, 30, 0, 0);

		await sql`
			INSERT INTO time_entry (
				user_id, project_id, role_id, start_time, is_running
			)
			VALUES (
				${maria.id},
				${riverside[0].id},
				${electrician[0].id},
				${yesterday},
				true
			)
		`;
		console.log('Created stale shift for maria.worker (forgotten clock-out demo)');
	}

	console.log('\nDemo accounts ready (password for all: demo1234):\n');
	for (const account of accounts) {
		console.log(`  ${account.email}  [${account.role}]`);
	}
	console.log('\nLukas is on Riverside + Harbor — use him to test switching sites.');
	console.log('Maria has a stale shift at Riverside — Anna will see forgotten clock-out alerts.');
} catch (error) {
	console.error('Seed failed:', error);
	process.exit(1);
} finally {
	await sql.end();
}