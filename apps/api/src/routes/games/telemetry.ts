import { Hono } from 'hono';
import { vValidator } from '@hono/valibot-validator';
import { TelemetryPayloadSchema } from '@isitfun/shared';
import type { AppEnv } from '../../types';
import { verifySession } from '../../lib/crypto';

export const telemetryRouter = new Hono<AppEnv>();

// POST /v1/telemetry - High-frequency telemetry ingestion directly to Durable Object
telemetryRouter.post('/', vValidator('json', TelemetryPayloadSchema), async (c) => {
	const payload = c.req.valid('json');
	const { sessionId, projectId, sessionToken } = payload;

	const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test';
	const secret = c.env.BETTER_AUTH_SECRET || (isDev ? 'dev-secret' : '');
	if (!secret) {
		return c.json({ error: 'Server misconfiguration: missing BETTER_AUTH_SECRET' }, 500);
	}

	if (sessionToken) {
		const isValid = await verifySession(sessionToken, projectId, secret);
		if (!isValid) {
			return c.json({ error: 'Unauthorized telemetry session token' }, 401);
		}
	} else {
		if (!isDev) {
			return c.json({ error: 'Session token required for telemetry ingestion' }, 401);
		}
	}

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
