/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject } from '../../src/routes/(app)/portal/dashboard/dashboard.remote';
import { hashPassword } from '@isitfun/shared';
import { getRequestEvent } from '$app/server';

vi.mock('$app/server', () => {
	const mockGetRequestEvent = vi.fn();
	return {
		getRequestEvent: mockGetRequestEvent,
		form: (schema: any, action: any) => {
			const formAction = async (input: any) => {
				return action(input);
			};
			formAction.__ = {
				type: 'form'
			};
			formAction.enhance = () => ({});
			formAction.fields = {
				name: { as: () => ({}) },
				passwordProtected: { as: () => ({}), value: () => false },
				password: { as: () => ({}) },
				id: { as: () => ({}) }
			};
			return formAction;
		}
	};
});

describe('dashboard.remote', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('hashPassword', () => {
		it('should hash password to PBKDF2 hex string', async () => {
			const hash = await hashPassword('my-test-password', 'test-salt');
			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});
	});

	describe('createProject', () => {
		it('enforces limit of 1 active free project via API response', async () => {
			const mockApi = {
				v1: {
					projects: {
						$post: vi.fn().mockResolvedValue({
							ok: false,
							status: 400,
							json: async () => ({
								error: 'Free tier is limited to 1 active project. Delete your existing project or upgrade.'
							})
						})
					}
				}
			};

			const mockEvent = {
				locals: {
					session: { id: 'sess_1' },
					user: { id: 'user_1' },
					api: mockApi
				}
			};

			vi.mocked(getRequestEvent).mockReturnValue(mockEvent as any);

			await expect(
				(createProject as any)({
					name: 'New Free Project',
					passwordProtected: false
				})
			).rejects.toThrow();
		});

		it('allows creating project when API returns success', async () => {
			const mockApi = {
				v1: {
					projects: {
						$post: vi.fn().mockResolvedValue({
							ok: true,
							status: 201,
							json: async () => ({
								success: true,
								projectId: 'new_proj_123'
							})
						})
					}
				}
			};

			const mockEvent = {
				locals: {
					session: { id: 'sess_1' },
					user: { id: 'user_1' },
					api: mockApi
				}
			};

			vi.mocked(getRequestEvent).mockReturnValue(mockEvent as any);

			const result = await (createProject as any)({
				name: 'First Free Project',
				passwordProtected: false
			});

			expect(result).toEqual({ success: true, projectId: 'new_proj_123' });
			expect(mockApi.v1.projects.$post).toHaveBeenCalled();
		});
	});
});
