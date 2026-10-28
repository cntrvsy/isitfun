import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createD1Client, sql } from '@isitfun/db';
import { TelemetrySessionDO } from './durable-objects/TelemetrySessionDO';
import type { AppEnv } from './types';
import { authRouter, profileRouter } from './routes/identity';
import { projectsRouter, playRouter, telemetryRouter } from './routes/games';
import { orgsRouter, dashboardRouter } from './routes/workspace';
import { billingRouter, webhooksRouter } from './routes/billing';
import { adminRouter } from './routes/admin';
import { runLogDecay } from './lib/log-decay';

// 1. Native Durable Object export for Cloudflare Workers
export { TelemetrySessionDO };
export type { AppEnv };

const app = new Hono<AppEnv>();

// 1.5. Zero-Bill Drifter Kill-Switch Guard (protects direct API worker hits, R2, D1, and DOs)
const drifterCache = new WeakMap<object, { disabled: boolean; expiresAt: number }>();

export function invalidateDrifterCache(drifterControl?: object) {
	if (drifterControl) {
		drifterCache.delete(drifterControl);
	}
}

app.use('*', async (c, next) => {
	const drifterControl = c.env.DRIFTER_CONTROL;
	if (drifterControl) {
		const now = Date.now();
		let cached = drifterCache.get(drifterControl);
		if (!cached || cached.expiresAt <= now) {
			const val = await drifterControl.get('DISABLED', { cacheTtl: 60 });
			cached = { disabled: val === 'true', expiresAt: now + 60_000 };
			drifterCache.set(drifterControl, cached);
		}
		if (cached.disabled) {
			const path = c.req.path;
			const isBypassAllowed =
				path === '/v1/health' ||
				path.startsWith('/v1/auth') ||
				path.startsWith('/v1/admin');
			if (!isBypassAllowed) {
				return c.json(
					{
						error:
							'The platform is temporarily disabled due to system maintenance or quota limits. Please try again later.'
					},
					503,
					{ 'Retry-After': '3600' }
				);
			}
		}
	}
	return next();
});

// 2. Global CORS with credentials support for frontend
app.use('*', async (c, next) => {
	const originHeader = c.req.header('origin') || '';
	const allowed = [
		'https://isitfun.frstudios.co.ke',
		'http://localhost:5173',
		'http://localhost:8787',
		...(c.env.TRUSTED_ORIGINS?.split(',') || [])
	]
		.map((o) => o.trim())
		.filter(Boolean);

	const corsMiddleware = cors({
		origin: allowed.includes(originHeader) ? originHeader : allowed[0] || '*',
		credentials: true,
		allowHeaders: ['Content-Type', 'Authorization', 'creem-signature', 'range'],
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		exposeHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges', 'Set-Cookie']
	});
	return corsMiddleware(c, next);
});

// 3. Mount modular routes under /v1
const v1 = new Hono<AppEnv>()
	.get('/health', async (c) => {
		const isDeep = c.req.query('deep') === 'true';
		if (!isDeep) {
			return c.json({ status: 'ok', timestamp: Date.now() });
		}
		const db = createD1Client(c.env.DB);
		let dbOk = false;
		let kvOk = false;
		let r2Ok = false;
		try {
			await db.run(sql`SELECT 1`);
			dbOk = true;
		} catch (_e) {
			// DB check failed
		}
		try {
			await c.env.ISITFUN_KV.get('__health_probe__');
			kvOk = true;
		} catch (_e) {
			// KV check failed
		}
		try {
			await c.env.GAMES_BUCKET.list({ limit: 1 });
			r2Ok = true;
		} catch (_e) {
			// R2 check failed
		}

		const allOk = dbOk && kvOk && r2Ok;
		return c.json(
			{
				status: allOk ? 'healthy' : 'degraded',
				checks: { db: dbOk, kv: kvOk, r2: r2Ok },
				timestamp: Date.now()
			},
			allOk ? 200 : 503
		);
	})
	.route('/auth', authRouter)
	.route('/telemetry', telemetryRouter)
	.route('/projects', projectsRouter)
	.route('/orgs', orgsRouter)
	.route('/webhooks', webhooksRouter)
	.route('/dashboard', dashboardRouter)
	.route('/profile', profileRouter)
	.route('/admin', adminRouter)
	.route('/billing', billingRouter);

// 4. Mount routes with types preserved
const routes = app.route('/v1', v1).route('/play', playRouter).route('/v1/play', playRouter);

const handler = Object.assign(routes, {
	scheduled: async (
		_event: ScheduledEvent,
		env: AppEnv['Bindings'],
		ctx: ExecutionContext
	): Promise<void> => {
		ctx.waitUntil(runLogDecay(env));
	}
});

export default handler;
export type AppType = typeof routes;
