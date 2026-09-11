import { describe, it, expect, vi } from 'vitest';
import app from '../src/index';

describe('IsItFun Hono API Service', () => {
	const mockEnv = {
		BETTER_AUTH_SECRET: 'test-better-auth-secret-1234567890',
		BETTER_AUTH_URL: 'https://isitfun.frstudios.co.ke',
		SESSION_SECRET: 'test-session-secret-key-1234567890',
		CREEM_WEBHOOK_SECRET: 'test-creem-secret',
		DB: {
			prepare: vi.fn(() => ({
				bind: vi.fn(() => ({
					run: vi.fn(async () => ({ success: true })),
					all: vi.fn(async () => ({ results: [] })),
					raw: vi.fn(async () => [])
				}))
			}))
		},
		GAMES_BUCKET: {
			get: vi.fn(async () => null),
			put: vi.fn(async () => {})
		},
		TELEMETRY_BUFFER: {
			idFromName: vi.fn(() => ({
				toString: () => 'mock-do-id'
			})),
			get: vi.fn(() => ({
				fetch: vi.fn(async () => new Response(JSON.stringify({ status: 'buffered' })))
			}))
		}
	};

	it('GET /v1/health returns ok status and timestamp', async () => {
		const req = new Request('http://localhost/v1/health');
		const res = await app.request(req, {}, mockEnv as any);

		expect(res.status).toBe(200);
		const data = (await res.json()) as { status: string; timestamp: number };
		expect(data.status).toBe('ok');
		expect(data.timestamp).toBeDefined();
	});

	it('GET /play/demo serves interactive ping pong demo game with COOP/COEP headers', async () => {
		const req = new Request('http://localhost/play/demo');
		const res = await app.request(req, {}, mockEnv as any);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
		expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');

		const html = await res.text();
		expect(html).toContain('Ping Pong');
		expect(html).toContain('<canvas id="gameCanvas"');
	});

	it('POST /v1/telemetry validates telemetry payloads with Valibot schema', async () => {
		// Test invalid payload (empty object)
		const invalidReq = new Request('http://localhost/v1/telemetry', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		const invalidRes = await app.request(invalidReq, {}, mockEnv as any);
		expect(invalidRes.status).toBe(400);

		// Test valid payload routed to DO
		const validPayload = {
			projectId: 'proj_demo',
			sessionId: 'sess_123',
			logs: [{ event: 'start', data: {}, timestamp: Date.now() }],
			deviceHash: 'hash_abc123'
		};
		const validReq = new Request('http://localhost/v1/telemetry', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validPayload)
		});
		const validRes = await app.request(validReq, {}, mockEnv as any);
		expect(validRes.status).toBe(200);
		expect(mockEnv.TELEMETRY_BUFFER.idFromName).toHaveBeenCalledWith('sess_123');
	});

	it('POST /v1/webhooks/creem rejects payloads without valid signature', async () => {
		const req = new Request('http://localhost/v1/webhooks/creem', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'creem-signature': 'invalid_signature_hex'
			},
			body: JSON.stringify({ event: 'test' })
		});

		const res = await app.request(req, {}, mockEnv as any);
		expect(res.status).toBe(400);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe('Invalid webhook signature');
	});

	it('POST /v1/projects/:id/verify-key rejects requests with missing password', async () => {
		const req = new Request('http://localhost/v1/projects/demo/verify-key', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const res = await app.request(req, {}, mockEnv as any);
		expect(res.status).toBe(400);
		const data = (await res.json()) as { valid: boolean; reason: string };
		expect(data.valid).toBe(false);
		expect(data.reason).toBe('missing_password');
	});

	it('Guarded endpoints return 401 Unauthorized for unauthenticated requests', async () => {
		const endpoints = [
			{ path: '/v1/dashboard', method: 'GET' },
			{ path: '/v1/profile', method: 'GET' },
			{ path: '/v1/admin/stats', method: 'GET' },
			{ path: '/v1/billing/checkout/project/proj_1', method: 'POST' }
		];

		for (const ep of endpoints) {
			const req = new Request(`http://localhost${ep.path}`, { method: ep.method });
			const res = await app.request(req, {}, mockEnv as any);
			expect(res.status).toBe(401);
		}
	});
});
