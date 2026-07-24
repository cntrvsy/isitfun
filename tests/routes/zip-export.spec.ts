/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../src/routes/(app)/portal/dashboard/projects/[projectId]/export/zip/+server';

describe('GET /portal/dashboard/projects/[projectId]/export/zip', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects unauthenticated requests', async () => {
		try {
			await GET({
				params: { projectId: 'proj_1' },
				locals: {} as any,
				platform: {} as any
			} as any);
			expect.fail('Should throw 401');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('generates valid ZIP binary attachment stream from R2 files', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_1', name: 'My Game', userId: 'user_1' })
		};

		const mockBucket = {
			list: vi.fn().mockResolvedValue({
				objects: [
					{ key: 'games/proj_1/sessions/sess_1.json' },
					{ key: 'games/proj_1/sessions/sess_2.json' }
				]
			}),
			get: vi.fn().mockImplementation(async (key: string) => {
				return {
					text: async () => JSON.stringify({ sessionId: key, logs: [] })
				};
			})
		};

		const res = await GET({
			params: { projectId: 'proj_1' },
			locals: { session: { id: 's1' }, user: { id: 'user_1' }, db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any
		} as any);

		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/zip');
		expect(res.headers.get('content-disposition')).toContain('attachment; filename="playtests-proj_1-');

		const arrayBuffer = await res.arrayBuffer();
		expect(arrayBuffer.byteLength).toBeGreaterThan(0);
	});
});
