/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../src/routes/api/telemetry/+server';

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
			platform: {
				env: { ISITFUN_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } }
			} as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(429);
		const text = await res.text();
		expect(text).toContain('Concurrent playtest session limit of 3 exceeded for Free Jammer Tier.');
	});

	it('forwards telemetry events directly to Durable Object', async () => {
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

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', tier: 'free' }),
			all: vi.fn().mockResolvedValue([])
		};

		const mockDoStub = {
			fetch: vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '{"success":true}',
				json: async () => ({ success: true })
			})
		};

		const mockDoBinding = {
			idFromName: vi.fn().mockReturnValue('mock-do-id'),
			get: vi.fn().mockReturnValue(mockDoStub)
		};

		const mockKv = {
			get: vi.fn().mockResolvedValue('10'),
			put: vi.fn().mockResolvedValue(null)
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: {
				env: {
					ISITFUN_KV: mockKv,
					TELEMETRY_BUFFER: mockDoBinding
				},
				ctx: {
					waitUntil: (promise: Promise<any>) => promise
				}
			} as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: 'queued', success: true });

		// Verify Durable Object interaction
		expect(mockDoBinding.idFromName).toHaveBeenCalledWith('sess_1');
		expect(mockDoBinding.get).toHaveBeenCalledWith('mock-do-id');
		expect(mockDoStub.fetch).toHaveBeenCalled();
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
			}),
			put: vi.fn().mockResolvedValue(null)
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

	it('forwards Phase 2 avgFps, deviceSpecs, and qualitative feedback to Durable Object', async () => {
		const requestBody = {
			projectId: 'proj_free',
			sessionId: 'sess_phase2',
			logs: [
				{ event: 'feedback', data: { sentiment: 'fun', comment: 'Loved the game mechanics!' } }
			],
			avgFps: 58,
			minFps: 32,
			deviceSpecs: {
				hardwareConcurrency: 8,
				deviceMemory: 8,
				screenResolution: '1920x1080',
				gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 3070)'
			},
			feedback: {
				sentiment: 'fun',
				comment: 'Loved the game mechanics!'
			}
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

		const mockDoStub = {
			fetch: vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '{"success":true}',
				json: async () => ({ success: true })
			})
		};

		const mockDoBinding = {
			idFromName: vi.fn().mockReturnValue('mock-do-id'),
			get: vi.fn().mockReturnValue(mockDoStub)
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: {
				env: {
					TELEMETRY_BUFFER: mockDoBinding
				},
				ctx: {
					waitUntil: (promise: Promise<any>) => promise
				}
			} as any,
			getClientAddress: () => '127.0.0.1',
			url: new URL('http://localhost/api/telemetry')
		} as any);

		expect(res.status).toBe(200);
		expect(mockDoStub.fetch).toHaveBeenCalledWith(
			'http://do/telemetry',
			expect.objectContaining({
				body: expect.stringContaining('"avgFps":58')
			})
		);
		expect(mockDoStub.fetch).toHaveBeenCalledWith(
			'http://do/telemetry',
			expect.objectContaining({
				body: expect.stringContaining('"sentiment":"fun"')
			})
		);
	});
});
