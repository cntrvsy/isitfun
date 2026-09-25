import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TelemetrySessionDO } from './durable-objects/TelemetrySessionDO';
import type { AppEnv } from './types';
import { authRouter, profileRouter } from './routes/identity';
import { projectsRouter, playRouter, telemetryRouter } from './routes/games';
import { orgsRouter, dashboardRouter } from './routes/workspace';
import { billingRouter, webhooksRouter } from './routes/billing';
import { adminRouter } from './routes/admin';

// 1. Native Durable Object export for Cloudflare Workers
export { TelemetrySessionDO };
export type { AppEnv };

const app = new Hono<AppEnv>();

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
	.get('/health', (c) => {
		return c.json({ status: 'ok', timestamp: Date.now() });
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
const routes = app
	.route('/v1', v1)
	.route('/play', playRouter)
	.route('/v1/play', playRouter);

export default routes;
export type AppType = typeof routes;

