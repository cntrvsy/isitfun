/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject } from './dashboard.remote';
import { hashPassword } from '$lib/server/crypto';
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
		it('should hash password to SHA-256 hex string', async () => {
			const hash = await hashPassword('my-test-password');
			expect(hash).toBe('7de9fde7c9530395854d7e3e41bb2c64a74e606782611f2d1baa1c2365b276de');
		});
	});

	describe('createProject', () => {
		it('enforces limit of 1 active free project', async () => {
			const mockDb = {
				select: vi.fn().mockReturnThis(),
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue([{ id: 'existing-free' }])
			};

			const mockEvent = {
				locals: {
					session: { id: 'sess_1' },
					user: { id: 'user_1' },
					db: mockDb
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

		it('allows creating project if no free project exists', async () => {
			const mockDb = {
				select: vi.fn().mockReturnThis(),
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue([]),
				insert: vi.fn().mockReturnThis(),
				values: vi.fn().mockResolvedValue({})
			};

			const mockEvent = {
				locals: {
					session: { id: 'sess_1' },
					user: { id: 'user_1' },
					db: mockDb
				}
			};

			vi.mocked(getRequestEvent).mockReturnValue(mockEvent as any);

			const result = await (createProject as any)({
				name: 'First Free Project',
				passwordProtected: false
			});

			expect(result).toEqual({ success: true });
			expect(mockDb.insert).toHaveBeenCalled();
		});
	});
});
