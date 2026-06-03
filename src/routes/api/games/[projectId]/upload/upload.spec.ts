/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

describe('POST /api/games/[projectId]/upload', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should reject if not logged in', async () => {
		const request = new Request('http://localhost/api/games/proj_1/upload?path=index.html', {
			method: 'POST'
		});

		try {
			await POST({
				params: { projectId: 'proj_1' },
				request,
				locals: {} as any,
				platform: {} as any,
				url: new URL('http://localhost/api/games/proj_1/upload?path=index.html')
			} as any);
			expect.fail('Should have thrown 401');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('should throw 413 if upload exceeds 40MB limit on free tier', async () => {
		const request = new Request('http://localhost/api/games/proj_free/upload?path=index.html', {
			method: 'POST',
			headers: {
				'content-length': String(41 * 1024 * 1024)
			}
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', userId: 'user_1', tier: 'free' })
		};

		try {
			await POST({
				params: { projectId: 'proj_free' },
				request,
				locals: { session: { id: 'sess_1' }, user: { id: 'user_1' }, db: mockDb } as any,
				platform: {} as any,
				url: new URL('http://localhost/api/games/proj_free/upload?path=index.html')
			} as any);
			expect.fail('Should have thrown 413');
		} catch (err: any) {
			expect(err.status).toBe(413);
			expect(err.body.message).toBe('File size exceeds 40 MB free limit');
		}
	});

	it('should successfully upload file if within limits and inputs valid', async () => {
		const request = new Request('http://localhost/api/games/proj_free/upload?path=index.html', {
			method: 'POST',
			headers: {
				'content-length': String(1024)
			},
			body: 'test-file-content'
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({ id: 'proj_free', userId: 'user_1', tier: 'free' })
		};

		const mockBucket = {
			put: vi.fn().mockResolvedValue({})
		};

		const res = await POST({
			params: { projectId: 'proj_free' },
			request,
			locals: { session: { id: 'sess_1' }, user: { id: 'user_1' }, db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			url: new URL('http://localhost/api/games/proj_free/upload?path=index.html')
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true, key: 'games/proj_free/assets/index.html' });
		expect(mockBucket.put).toHaveBeenCalledWith(
			'games/proj_free/assets/index.html',
			expect.any(ReadableStream),
			{
				httpMetadata: {
					contentType: 'text/html'
				}
			}
		);
	});
});
