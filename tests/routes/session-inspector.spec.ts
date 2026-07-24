/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '../../src/routes/api/portal/projects/[projectId]/sessions/[sessionId]/+server';

describe('GET /api/portal/projects/[projectId]/sessions/[sessionId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects unauthenticated requests', async () => {
		try {
			await GET({
				params: { projectId: 'proj_1', sessionId: 'sess_1' },
				locals: {} as any,
				platform: {} as any
			} as any);
			expect.fail('Should throw 401');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('rejects forbidden requests for unauthorized users', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_1', userId: 'owner_user' })
		};

		try {
			await GET({
				params: { projectId: 'proj_1', sessionId: 'sess_1' },
				locals: { session: { id: 's1' }, user: { id: 'other_user' }, db: mockDb } as any,
				platform: {} as any
			} as any);
			expect.fail('Should throw 403');
		} catch (err: any) {
			expect(err.status).toBe(403);
		}
	});

	it('returns mock session details when R2 binding is absent in dev mode', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_1', userId: 'user_1' })
		};

		const res = await GET({
			params: { projectId: 'proj_1', sessionId: 'sess_1' },
			locals: { session: { id: 's1' }, user: { id: 'user_1' }, db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.projectId).toBe('proj_1');
		expect(json.sessionId).toBe('sess_1');
		expect(json.logs).toHaveLength(2);
	});

	it('fetches raw JSON session details from Cloudflare R2 bucket when available', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_1', userId: 'user_1' })
		};

		const r2Content = JSON.stringify({
			projectId: 'proj_1',
			sessionId: 'sess_1',
			createdAt: new Date().toISOString(),
			logs: [{ event: 'console.log', data: { message: 'hello test' }, timestamp: 123456 }],
			avgFps: 60,
			sentiment: 'fun'
		});

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				text: async () => r2Content
			})
		};

		const res = await GET({
			params: { projectId: 'proj_1', sessionId: 'sess_1' },
			locals: { session: { id: 's1' }, user: { id: 'user_1' }, db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any
		} as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.projectId).toBe('proj_1');
		expect(json.avgFps).toBe(60);
		expect(json.sentiment).toBe('fun');
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_1/sessions/sess_1.json');
	});
});

describe('DELETE /api/portal/projects/[projectId]/sessions/[sessionId]', () => {
	it('deletes session record from D1 and log object from R2', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_1', userId: 'user_1' }),
			delete: vi.fn().mockReturnThis()
		};

		const mockBucket = {
			delete: vi.fn().mockResolvedValue({})
		};

		const res = await DELETE({
			params: { projectId: 'proj_1', sessionId: 'sess_1' },
			locals: { session: { id: 's1' }, user: { id: 'user_1' }, db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any
		} as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.success).toBe(true);
		expect(mockBucket.delete).toHaveBeenCalledWith('games/proj_1/sessions/sess_1.json');
		expect(mockDb.delete).toHaveBeenCalled();
	});
});
