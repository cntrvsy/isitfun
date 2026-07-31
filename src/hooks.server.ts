import { redirect, error, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createD1Client, createLibSqlClient } from '$lib/server/db';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';

import type { DrizzleClient } from '$lib/server/db';
import { resolvePendingInvite } from '$lib/server/invites';

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
	const auth = getAuth(event.locals.db, event.url.origin);
	event.locals.auth = auth;

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user as App.Locals['user']; // Cast for role safety

		// Resolve any pending organization invite token for authenticated users
		await resolvePendingInvite(
			event.locals.db,
			event.cookies,
			event.locals.user.id,
			event.locals.user.email
		);


		// Redirect authenticated users trying to access login/auth pages to their dashboards
		const path = event.url.pathname.replace(/\/$/, '');
		if (path === '/auth' || path === '/auth/login') {
			if (event.locals.user.role === 'admin') {
				return redirect(302, '/portal/admin');
			} else if (event.locals.user.role === 'game_developer') {
				return redirect(302, '/portal/dashboard');
			}
		}
	} else {
		const path = event.url.pathname.replace(/\/$/, '');
		if (path === '/auth/login') {
			return redirect(302, '/auth');
		}
	}


	// 🔐 Centralized Sub-tree Route & RBAC Guards
	if (event.url.pathname.startsWith('/portal')) {
		if (!session || !event.locals.user) {
			return redirect(302, '/auth');
		}

		const userRole = event.locals.user.role;

		// 1. Admin route guard
		if (event.url.pathname.startsWith('/portal/admin')) {
			if (userRole !== 'admin') {
				return error(403, 'Forbidden: Administrator access required');
			}
		}

		// 2. Developer dashboard guard
		if (event.url.pathname.startsWith('/portal/dashboard')) {
			if (userRole !== 'admin' && userRole !== 'game_developer') {
				return error(403, 'Forbidden: Developer access required');
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handleSecurity: Handle = async ({ event, resolve }) => {
	const referer = event.request.headers.get('referer');
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			if (refererUrl.origin === event.url.origin && refererUrl.pathname.startsWith('/play/')) {
				const destPath = event.url.pathname;
				if (
					destPath.startsWith('/portal') ||
					(destPath.startsWith('/api') && !destPath.startsWith('/api/telemetry'))
				) {
					return new Response(
						'Forbidden: Direct access to developer portal or management APIs from game playtest environments is blocked.',
						{ status: 403 }
					);
				}
			}
		} catch {
			// Ignore invalid URLs in referer header
		}
	}
	return resolve(event);
};

const handleDrifter: Handle = async ({ event, resolve }) => {
	const drifterControl = event.platform?.env?.DRIFTER_CONTROL;
	if (drifterControl) {
		const isDisabled = await drifterControl.get('DISABLED');
		if (isDisabled === 'true') {
			// Allow emergency admin override or portal admin route to bypass kill switch so admin can inspect/reset
			const isOverride =
				event.url.searchParams.get('override') === 'true' ||
				event.url.pathname.startsWith('/portal/admin');
			if (!isOverride) {
				return new Response(
					'The platform is temporarily disabled due to system maintenance or quota limits. Please try again later.',
					{
						status: 503,
						headers: {
							'Retry-After': '3600'
						}
					}
				);
			}
		}
	}
	return resolve(event);
};

export const handle: Handle = sequence(handleDrifter, handleSecurity, handleDb, handleBetterAuth);
