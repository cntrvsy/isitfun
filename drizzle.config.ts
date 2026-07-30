import { defineConfig } from 'drizzle-kit';
import fs from 'fs';
import path from 'path';

// Dynamically locate Wrangler D1's active local SQLite database
function getLocalD1Path(): string | null {
	const d1Dir = path.resolve('.wrangler/state/v3/d1');
	if (!fs.existsSync(d1Dir)) return null;

	const files = fs.readdirSync(d1Dir, { recursive: true }) as string[];
	const sqliteFile = files.find((f) => f.endsWith('.sqlite') && !f.includes('metadata.sqlite'));
	return sqliteFile ? path.join(d1Dir, sqliteFile) : null;
}

const localD1Path = getLocalD1Path();

const isDefaultLocalDb =
	!process.env.DATABASE_URL ||
	process.env.DATABASE_URL === 'file:local.db' ||
	process.env.DATABASE_URL === 'local.db';

const databaseUrl =
	!isDefaultLocalDb && process.env.DATABASE_URL
		? process.env.DATABASE_URL
		: localD1Path || 'local.db';

if (isDefaultLocalDb && !localD1Path) {
	console.warn(
		'⚠️  No active Wrangler local D1 database found. Defaulting to local.db file.\n' +
			'   Please run `npm run dev` first to initialize your local D1 emulator.'
	);
}

export default defineConfig({
	schema: './src/lib/server/db/db-schema.ts',
	out: './src/lib/server/db/migrations',
	dialect: 'sqlite',
	dbCredentials: { url: databaseUrl },
	verbose: true,
	strict: true
});
