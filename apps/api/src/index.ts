import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TelemetrySessionDO } from './durable-objects/TelemetrySessionDO';
import type { AppEnv } from './types';
import { authRouter } from './routes/auth';
import { telemetryRouter } from './routes/telemetry';
import { projectsRouter } from './routes/projects';
import { orgsRouter } from './routes/orgs';
import { webhooksRouter } from './routes/webhooks';
import { playRouter } from './routes/play';

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

// 3. Health check route
const healthRoute = new Hono<AppEnv>().get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: Date.now() });
});

// 4. Mount modular routes
const routes = app
	.basePath('/v1')
	.route('/', healthRoute)
	.route('/auth', authRouter)
	.route('/telemetry', telemetryRouter)
	.route('/projects', projectsRouter)
	.route('/orgs', orgsRouter)
	.route('/webhooks', webhooksRouter);

// Mount game streaming routes at /play and /v1/play
app.route('/play', playRouter);
app.route('/v1/play', playRouter);

export default app;
export type AppType = typeof routes;
