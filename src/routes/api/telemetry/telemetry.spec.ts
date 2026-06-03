/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

describe('POST /api/telemetry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should reject invalid JSON', async () => {
		const request = new Request('http://localhost/api/telemetry', {
			method: 'POST',
			body: 'invalid-json'
		});

		try {
			await POST({
				request,
				locals: {} as any,
				platform: {} as any,
				getClientAddress: () => '127.0.0.1',
				url: new URL('http://localhost/api/telemetry')
			} as any);
			expect.fail('Should have thrown an error');
		} catch (err: any) {
			expect(err.status).toBe(400);
			expect(err.body.message).toBe('Invalid JSON body');
		}
	});

	it('should enforce free tier session concurrency limits (max 3)', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_new',
			logType: 'heartbeat',
			payload: { pulse: false }
		};

		const request = new Request('http://localhost/api/telemetry', {
			method: 'POST',
			body: JSON.stringify(requestBody)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', tier: 'free' }),
			all: vi.fn().mockResolvedValue([{ id: 'sess_1' }, { id: 'sess_2' }, { id: 'sess_3' }])
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: { KV: { get: vi.fn().mockResolvedValue('0') } } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(429);
		const text = await res.text();
		expect(text).toContain('Concurrent playtest session limit of 3 exceeded for Free Jammer Tier.');
	});

	it('ignores detailed logs for free tier', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_1',
			logType: 'log',
			payload: { message: 'detailed log message' }
		};

		const request = new Request('http://localhost/api/telemetry', {
			method: 'POST',
			body: JSON.stringify(requestBody)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', tier: 'free' }),
			all: vi.fn().mockResolvedValue([])
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: { KV: { get: vi.fn().mockResolvedValue('0') } } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: 'ignored', success: true });
	});

	it('enforces total quota limit in KV', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_1',
			logType: 'heartbeat',
			payload: { pulse: false }
		};

		const request = new Request('http://localhost/api/telemetry', {
			method: 'POST',
			body: JSON.stringify(requestBody)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', tier: 'free' }),
			all: vi.fn().mockResolvedValue([])
		};

		const mockKv = {
			get: vi.fn().mockResolvedValue('5000')
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: { KV: mockKv } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(429);
		const text = await res.text();
		expect(text).toContain('Telemetry quota exceeded');
	});
});
