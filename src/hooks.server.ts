import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createD1Client, createLibSqlClient } from '$lib/server/db';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';

const db = env.DATABASE_URL ? createLibSqlClient(env.DATABASE_URL) : null;

const handleDb: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.DB) {
		event.locals.db = createD1Client(event.platform.env.DB);
	} else if (db) {
		event.locals.db = db;
	} else {
		throw new Error('No database found. Check your D1 binding or DATABASE_URL.');
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
