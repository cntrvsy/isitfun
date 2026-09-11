import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { vValidator } from '@hono/valibot-validator';
import { TelemetryPayloadSchema } from '@isitfun/shared';
import { TelemetrySessionDO } from './durable-objects/TelemetrySessionDO';

// 1. Native Durable Object export for Cloudflare Workers
export { TelemetrySessionDO };

export type Env = {
	Bindings: {
		DB: D1Database;
		ISITFUN_KV: KVNamespace;
		DRIFTER_CONTROL: KVNamespace;
		GAMES_BUCKET: R2Bucket;
		TELEMETRY_BUFFER: DurableObjectNamespace;
		BETTER_AUTH_SECRET?: string;
		BETTER_AUTH_URL?: string;
		TRUSTED_ORIGINS?: string;
	};
};

const app = new Hono<Env>();

app.use('*', cors());

// Health route
const healthRoute = new Hono<Env>().get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: Date.now() });
});

// Telemetry route direct to Durable Object
const telemetryRoute = new Hono<Env>().post(
	'/',
	vValidator('json', TelemetryPayloadSchema),
	async (c) => {
		const payload = c.req.valid('json');
		const { sessionId } = payload;

		if (!c.env.TELEMETRY_BUFFER) {
			return c.json({ error: 'TELEMETRY_BUFFER binding not configured' }, 500);
		}

		const id = c.env.TELEMETRY_BUFFER.idFromName(sessionId);
		const stub = c.env.TELEMETRY_BUFFER.get(id);

		const response = await stub.fetch('https://do.internal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const result = (await response.json()) as Record<string, unknown>;
		return c.json(result, response.status as 200 | 400 | 500);
	}
);

const routes = app
	.basePath('/v1')
	.route('/', healthRoute)
	.route('/telemetry', telemetryRoute);

export default app;
export type AppType = typeof routes;
