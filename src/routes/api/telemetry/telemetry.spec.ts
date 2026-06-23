/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

import { telemetrySessions, customDeveloperLogs, projects } from '$lib/server/db/db-schema';

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
			logs: [{ event: 'heartbeat', data: { pulse: false } }]
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
			platform: { env: { ISITFUN_KV: { get: vi.fn().mockResolvedValue('0') } } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(429);
		const text = await res.text();
		expect(text).toContain('Concurrent playtest session limit of 3 exceeded for Free Jammer Tier.');
	});

	it('inserts custom developer logs and updates session', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_1',
			logs: [
				{ event: 'coin_collected', data: { amount: 5 } },
				{ event: 'level_complete', data: { level: 2 } }
			]
		};

		const request = new Request('http://localhost/api/telemetry', {
			method: 'POST',
			body: JSON.stringify(requestBody)
		});

		let lastTable: any = null;
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockImplementation((table) => {
				lastTable = table;
				return mockDb;
			}),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockImplementation(() => {
				if (lastTable === projects) {
					return { id: 'proj_free', tier: 'free' };
				}
				if (lastTable === telemetrySessions) {
					// Return an existing session to test update
					return {
						id: 'sess_1',
						projectId: 'proj_free',
						createdAt: new Date(Date.now() - 30 * 1000)
					};
				}
				return null;
			}),
			all: vi.fn().mockResolvedValue([]),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis()
		};

		const mockKv = {
			get: vi.fn().mockResolvedValue('10'),
			put: vi.fn().mockResolvedValue(null)
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: { ISITFUN_KV: mockKv } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: 'queued', success: true });

		// Verify database calls
		expect(mockDb.insert).toHaveBeenCalledWith(customDeveloperLogs);
		expect(mockDb.update).toHaveBeenCalledWith(telemetrySessions);
		expect(mockKv.put).toHaveBeenCalledWith('quota:project:proj_free', '12', expect.any(Object));
	});

	it('enforces total quota limit in KV', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_1',
			logs: [{ event: 'heartbeat', data: { pulse: false } }]
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
			get: vi.fn().mockImplementation(async (key: string) => {
				if (key.startsWith('quota:project:')) {
					return '5000';
				}
				return null;
			})
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: { ISITFUN_KV: mockKv } } as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(429);
		const text = await res.text();
		expect(text).toContain('Telemetry quota exceeded');
	});
});
