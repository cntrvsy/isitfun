import { getAuth } from './auth';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

// This file is used exclusively for the `better-auth` CLI commands
// It uses Node-only dependencies which would break the Cloudflare Worker if imported there.

import type { DrizzleClient } from './db';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

export const auth = getAuth(db as unknown as DrizzleClient);
