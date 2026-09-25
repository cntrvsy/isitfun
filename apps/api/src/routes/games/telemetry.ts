import { Hono } from 'hono';
import { vValidator } from '@hono/valibot-validator';
import { TelemetryPayloadSchema } from '@isitfun/shared';
import type { AppEnv } from '../../types';

export const telemetryRouter = new Hono<AppEnv>();

// POST /v1/telemetry - High-frequency telemetry ingestion directly to Durable Object
telemetryRouter.post('/', vValidator('json', TelemetryPayloadSchema), async (c) => {
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
});

// GET /v1/telemetry/session/:sessionId - Retrieve raw session logs from R2
telemetryRouter.get('/session/:sessionId', async (c) => {
	const sessionId = c.req.param('sessionId');
	const bucket = c.env.GAMES_BUCKET;

	if (!bucket) {
		return c.json({ error: 'GAMES_BUCKET binding missing' }, 500);
	}

	// Raw session logs are stored at telemetry/sessions/{sessionId}.json
	const r2Key = `telemetry/sessions/${sessionId}.json`;
	const object = await bucket.get(r2Key);

	if (!object) {
		return c.notFound();
	}

	const data = await object.json();
	return c.json({ session: data });
});
