import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createD1Client, createLibSqlClient } from '$lib/server/db';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';

import type { DrizzleClient } from '$lib/server/db';

let db: DrizzleClient | null = null;

const handleDb: Handle = async ({ event, resolve }) => {
	const platformDb = event.platform?.env?.DB;

	if (platformDb) {
		event.locals.db = createD1Client(platformDb);
	} else {
		// Fallback to LibSQL (local for npm run dev, remote for production)
		const url = env.DATABASE_URL;
		if (url) {
			// Prevent 'file:' scheme in production worker bundles as it's not supported by @libsql/client/web
			if (url.startsWith('file:') && !building && !import.meta.env.DEV) {
				throw new Error(
					'Local SQLite (file:) is not supported in the Cloudflare Worker environment. ' +
					'Please ensure your D1 binding is correctly configured in wrangler.jsonc or use a remote libsql:// URL.'
				);
			}

			if (!db) {
				db = createLibSqlClient(url);
			}
			event.locals.db = db;
		} else {
			throw new Error('No database found. Check your D1 binding or DATABASE_URL in .env');
		}
	}
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = getAuth(event.locals.db);
	event.locals.auth = auth;
	
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	if (event.url.pathname === '/Portal') {
		if (!session) {
			return redirect(302, '/auth/login');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleDb, handleBetterAuth);
