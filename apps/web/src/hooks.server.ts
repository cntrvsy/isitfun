import { redirect, error } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { createApiClient } from '#lib/api/client.js';

// 1. Service Binding Gateway: transparently reverse-proxy /v1/*, /play/*, and legacy endpoints to Hono worker
export const handleGateway: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Support /v1/*, /play/*, and legacy /api endpoints routing to the API worker
	if (
		pathname.startsWith('/v1') ||
		pathname.startsWith('/play') ||
		pathname.startsWith('/api/auth') ||
		pathname.startsWith('/api/telemetry') ||
		pathname.startsWith('/api/webhooks') ||
		pathname.startsWith('/api/games') ||
		pathname.startsWith('/api/portal/projects')
	) {
		const apiBinding = event.platform?.env?.API;

		// Map legacy /api paths to /v1
		let targetPath = pathname;
		if (targetPath.startsWith('/api/auth')) {
			targetPath = targetPath.replace('/api/auth', '/v1/auth');
		} else if (targetPath.startsWith('/api/telemetry')) {
			targetPath = targetPath.replace('/api/telemetry', '/v1/telemetry');
		} else if (targetPath.startsWith('/api/webhooks')) {
			targetPath = targetPath.replace('/api/webhooks', '/v1/webhooks');
		} else if (/^\/api\/games\/([^/]+)\/upload/.test(targetPath)) {
			targetPath = targetPath.replace(/^\/api\/games\/([^/]+)\/upload/, '/v1/projects/$1/upload');
		} else if (/^\/api\/(?:games|portal\/projects)\/([^/]+)\/sessions\/([^/]+)/.test(targetPath)) {
			targetPath = targetPath.replace(
				/^\/api\/(?:games|portal\/projects)\/([^/]+)\/sessions\/([^/]+)/,
				'/v1/projects/$1/sessions/$2'
			);
		}

		if (apiBinding) {
			const targetUrl = new URL(event.request.url);
			targetUrl.pathname = targetPath;
			const proxyRequest = new Request(targetUrl.toString(), event.request);
			return apiBinding.fetch(proxyRequest);
		}

		if (import.meta.env.DEV) {
			const targetUrl = `http://localhost:8787${targetPath}${event.url.search}`;
			return fetch(targetUrl, {
				method: event.request.method,
				headers: event.request.headers,
				body:
					event.request.method !== 'GET' && event.request.method !== 'HEAD'
						? event.request.body
						: undefined,
				// @ts-expect-error - duplex option required for streaming bodies in Node fetch
				duplex: 'half'
			});
		}
	}

	return resolve(event);
};

// 2. Session Hydration, API Client Injection & Route Protection
export const handleSession: Handle = async ({ event, resolve }) => {
	const cookieHeader = event.request.headers.get('cookie') || '';

	// Create typed Hono RPC client via Service Binding or dev server with cookie propagation
	const rawFetch = event.platform?.env?.API?.fetch?.bind(event.platform.env.API) ?? fetch;
	const serviceFetch: typeof fetch = (input, init) => {
		const req = new Request(input, init);
		if (cookieHeader && !req.headers.has('cookie')) {
			req.headers.set('cookie', cookieHeader);
		}
		return rawFetch(req);
	};
	const baseUrl = event.platform?.env?.API ? 'https://api.internal' : 'http://localhost:8787';
	event.locals.api = createApiClient(serviceFetch, baseUrl);

	// Fetch active session from Hono Better-Auth via Service Binding
	try {
		const sessionUrl = event.platform?.env?.API
			? 'https://api.internal/v1/auth/get-session'
			: 'http://localhost:8787/v1/auth/get-session';

		const sessionRes = await serviceFetch(sessionUrl, {
			headers: { cookie: cookieHeader }
		});

		if (sessionRes.ok) {
			const sessionData = (await sessionRes.json()) as {
				user: App.Locals['user'];
				session: App.Locals['session'];
			} | null;

			if (sessionData && sessionData.user) {
				event.locals.user = sessionData.user;
				event.locals.session = sessionData.session;

				// Resolve any pending organization invite token for authenticated users
				const pendingInviteToken = event.cookies.get('pending_invite_token');
				if (pendingInviteToken) {
					try {
						await event.locals.api.v1.orgs.invites.accept.$post({
							json: { token: pendingInviteToken }
						});
					} catch (err) {
						console.warn('[Invite] Failed to auto-accept pending invite token:', err);
					} finally {
						event.cookies.delete('pending_invite_token', { path: '/' });
					}
				}

				// Redirect authenticated users away from /auth and /auth/login
				const path = event.url.pathname.replace(/\/$/, '');
				if (path === '/auth' || path === '/auth/login') {
					if (event.locals.user.role === 'admin') {
						return redirect(302, '/portal/admin');
					} else {
						return redirect(302, '/portal/dashboard');
					}
				}
			} else {
				event.locals.user = null;
				event.locals.session = null;
			}
		} else {
			event.locals.user = null;
			event.locals.session = null;
		}
	} catch {
		event.locals.user = null;
		event.locals.session = null;
	}

	// 🔐 Centralized Sub-tree Route & RBAC Guards
	if (event.url.pathname.startsWith('/portal')) {
		if (!event.locals.user) {
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

	return resolve(event);
};

// 3. Security referer protection
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

// 4. Drifter Maintenance Kill Switch
export const handleDrifter: Handle = async ({ event, resolve }) => {
	const drifterControl = event.platform?.env?.DRIFTER_CONTROL;
	if (drifterControl) {
		const isDisabled = await drifterControl.get('DISABLED');
		if (isDisabled === 'true') {
			const isAdmin = event.locals.user?.role === 'admin';
			const isOverride =
				(isAdmin && event.url.searchParams.get('override') === 'true') ||
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

export const handle: Handle = sequence(
	handleGateway,
	handleSession,
	handleDrifter,
	handleSecurity
);
