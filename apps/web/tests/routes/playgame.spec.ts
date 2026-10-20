import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../src/routes/(app)/playgame/+page.server';

describe('Playgame Access Key Verification & Cookie Security', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sets play_key cookie and redirects when access key is valid', async () => {
		const projectId = 'proj_secret_123';
		const accessKey = 'ALPHA-TEST-2026';

		const mockApi = {
			v1: {
				projects: {
					':id': {
						'verify-key': {
							$post: vi.fn().mockResolvedValue({
								ok: true,
								json: async () => ({ valid: true, isKey: true, key: accessKey })
							})
						}
					}
				}
			}
		};

		const mockCookies = {
			get: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.append('projectId', projectId);
		formData.append('key', accessKey);

		const request = new Request('http://localhost/playgame', {
			method: 'POST',
			body: formData
		});

		try {
			await actions.verify({
				request,
				locals: { api: mockApi } as any,
				cookies: mockCookies as any
			} as any);
			expect.fail('Expected redirect');
		} catch (err: any) {
			expect(err.status).toBe(302);
			expect(err.location).toBe(`/play/${projectId}?key=${encodeURIComponent(accessKey)}`);
			expect(mockCookies.set).toHaveBeenCalledWith(
				`play_key_${projectId}`,
				accessKey,
				expect.objectContaining({
					path: `/play/${projectId}`,
					httpOnly: true,
					secure: true,
					sameSite: 'lax'
				})
			);
		}
	});

	it('fails when access key is wrong and does not set cookie', async () => {
		const projectId = 'proj_secret_123';

		const mockApi = {
			v1: {
				projects: {
					':id': {
						'verify-key': {
							$post: vi.fn().mockResolvedValue({
								ok: false,
								status: 400,
								json: async () => ({ valid: false, reason: 'not_found' })
							})
						}
					}
				}
			}
		};

		const mockCookies = {
			get: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.append('projectId', projectId);
		formData.append('key', 'INVALID-KEY');

		const request = new Request('http://localhost/playgame', {
			method: 'POST',
			body: formData
		});

		const result: any = await actions.verify({
			request,
			locals: { api: mockApi } as any,
			cookies: mockCookies as any
		} as any);

		expect(result.status).toBe(400);
		expect(result.data).toEqual({ incorrect: true });
		expect(mockCookies.set).not.toHaveBeenCalled();
	});
});
