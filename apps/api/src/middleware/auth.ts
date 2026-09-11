import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { getAuth } from '../lib/auth';

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const auth = getAuth(c.env, c.req.url);
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers
		});
		c.set('user', (session?.user as AppEnv['Variables']['user']) ?? null);
		c.set('session', (session?.session as AppEnv['Variables']['session']) ?? null);
	} catch (err) {
		console.error('[auth middleware] Failed to fetch session:', err);
		c.set('user', null);
		c.set('session', null);
	}
	await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	const user = c.get('user');
	if (!user) {
		return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
	}
	await next();
});

export const requireRole = (role: 'admin' | 'game_developer') =>
	createMiddleware<AppEnv>(async (c, next) => {
		const user = c.get('user');
		if (!user) {
			return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
		}
		if (user.role !== role && user.role !== 'admin') {
			return c.json({ error: 'Forbidden', message: `Access requires ${role} role` }, 403);
		}
		await next();
	});
