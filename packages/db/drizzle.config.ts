import { defineConfig } from 'drizzle-kit';
import fs from 'fs';
import path from 'path';

function getLocalD1Path(): string | null {
	// Look up local D1 path from apps/api or root .wrangler
	const potentialPaths = [
		path.resolve('../../apps/api/.wrangler/state/v3/d1'),
		path.resolve('.wrangler/state/v3/d1'),
		path.resolve('../../.wrangler/state/v3/d1')
	];

	for (const d1Dir of potentialPaths) {
		if (fs.existsSync(d1Dir)) {
			const files = fs.readdirSync(d1Dir, { recursive: true }) as string[];
			const sqliteFile = files.find((f) => f.endsWith('.sqlite') && !f.includes('metadata.sqlite'));
			if (sqliteFile) return path.join(d1Dir, sqliteFile);
		}
	}
	return null;
}

const localD1Path = getLocalD1Path();
const databaseUrl = process.env.DATABASE_URL || localD1Path || 'local.db';

export default defineConfig({
	schema: './src/schema/index.ts',
	out: './migrations',
	dialect: 'sqlite',
	dbCredentials: { url: databaseUrl },
	verbose: true,
	strict: true
});
