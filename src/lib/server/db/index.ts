import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibSql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export function createD1Client(db: D1Database) {
	return drizzleD1(db, { schema });
}

export function createLibSqlClient(url: string) {
	const client = createClient({ url });
	return drizzleLibSql(client, { schema });
}

export function getDb(db?: D1Database) {
	if (!db) {
		throw new Error('No database configuration found.');
	}
	return createD1Client(db);
}

export type DrizzleClient =
	| ReturnType<typeof createD1Client>
	| ReturnType<typeof createLibSqlClient>;
