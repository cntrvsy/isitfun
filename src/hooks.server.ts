import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getDb } from '$lib/server/db';
import { sequence } from '@sveltejs/kit/hooks';

const handleDb: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(event.platform?.env?.DB);
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
