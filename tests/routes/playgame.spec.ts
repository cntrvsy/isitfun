/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from '../../src/routes/(app)/playgame/+page.server';
import { hashPassword } from '../../src/lib/server/crypto';

describe('Playgame Password Verification & Cookie Security', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sets play_auth cookie and redirects when static password is valid', async () => {
		const projectId = 'proj_secret_123';
		const rawPassword = 'SuperSecretPassword!';
		const passwordHash = await hashPassword(rawPassword, projectId);

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: projectId,
				name: 'Secret Game',
				passwordProtected: true,
				passwordHash
			}),
			all: vi.fn().mockResolvedValue([]) // No access keys, use legacy static password
		};

		const mockCookies = {
			get: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.append('projectId', projectId);
		formData.append('password', rawPassword);

		const request = new Request('http://localhost/playgame', {
			method: 'POST',
			body: formData
		});

		try {
			await actions.verify({
				request,
				locals: { db: mockDb } as any,
				cookies: mockCookies as any
			} as any);
			expect.fail('Expected redirect');
		} catch (err: any) {
			// SvelteKit redirect throws a redirect object with status 302 and location
			expect(err.status).toBe(302);
			expect(err.location).toBe(`/play/${projectId}`);
			expect(mockCookies.set).toHaveBeenCalledWith(
				`play_auth_${projectId}`,
				passwordHash,
				expect.objectContaining({
					path: `/play/${projectId}`,
					httpOnly: true,
					secure: true,
					sameSite: 'lax'
				})
			);
		}
	});

	it('fails when static password is wrong and does not set cookie', async () => {
		const projectId = 'proj_secret_123';
		const passwordHash = await hashPassword('CorrectPassword', projectId);

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: projectId,
				name: 'Secret Game',
				passwordProtected: true,
				passwordHash
			}),
			all: vi.fn().mockResolvedValue([])
		};

		const mockCookies = {
			get: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.append('projectId', projectId);
		formData.append('password', 'WrongPassword');

		const request = new Request('http://localhost/playgame', {
			method: 'POST',
			body: formData
		});

		const result: any = await actions.verify({
			request,
			locals: { db: mockDb } as any,
			cookies: mockCookies as any
		} as any);

		expect(result.status).toBe(400);
		expect(result.data).toEqual({ incorrect: true });
		expect(mockCookies.set).not.toHaveBeenCalled();
	});
});
