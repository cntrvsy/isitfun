import { describe, it, expect } from 'vitest';
import {
	RoleRanks,
	hasMinRole,
	AuthGuardError,
	requireProjectAccess,
	requireOrgAccess
} from '../src/lib/auth-guard';

import { schema } from '@isitfun/db';

describe('Multi-Tenant Auth Guard & RBAC Hierarchy', () => {
	describe('RoleRanks and hasMinRole', () => {
		it('correctly ranks owner > admin > member', () => {
			expect(RoleRanks.owner).toBeGreaterThan(RoleRanks.admin);
			expect(RoleRanks.admin).toBeGreaterThan(RoleRanks.member);
		});

		it('allows owner to perform all operations', () => {
			expect(hasMinRole('owner', 'owner')).toBe(true);
			expect(hasMinRole('owner', 'admin')).toBe(true);
			expect(hasMinRole('owner', 'member')).toBe(true);
		});

		it('allows admin to perform admin and member operations, but not owner operations', () => {
			expect(hasMinRole('admin', 'owner')).toBe(false);
			expect(hasMinRole('admin', 'admin')).toBe(true);
			expect(hasMinRole('admin', 'member')).toBe(true);
		});

		it('restricts member to member-only operations', () => {
			expect(hasMinRole('member', 'owner')).toBe(false);
			expect(hasMinRole('member', 'admin')).toBe(false);
			expect(hasMinRole('member', 'member')).toBe(true);
		});
	});

	describe('requireProjectAccess authorization logic', () => {
		const mockProject = {
			id: 'proj_123',
			userId: 'user_creator',
			organizationId: 'org_team',
			name: 'Epic Platformer',
			tier: 'free',
			passwordProtected: false,
			passwordHash: null,
			createdAt: new Date()
		};

		const mockOrg = {
			id: 'org_team',
			name: 'Game Studio',
			ownerId: 'user_owner',
			type: 'team' as const,
			tier: 'team' as const,
			creemSubscriptionId: null,
			creemCustomerId: null,
			subscriptionStatus: 'active',
			createdAt: new Date()
		};

		const createMockDb = (membershipRole: 'owner' | 'admin' | 'member' | null) => {
			return {
				select: () => ({
					from: (table: any) => ({
						where: () => ({
							get: async () => {
								if (table === schema.projects) {
									return mockProject;
								}
								if (table === schema.organizations) {
									return mockOrg;
								}
								if (table === schema.organizationMemberships) {
									return membershipRole
										? {
												id: 'mem_1',
												organizationId: 'org_team',
												userId: 'test_user',
												role: membershipRole,
												createdAt: new Date()
											}
										: null;
								}
								return null;
							}
						})
					})
				})
			} as any;
		};

		it('grants global admin access unconditionally', async () => {
			const db = createMockDb(null);
			const result = await requireProjectAccess(
				db,
				'proj_123',
				{ id: 'admin_user', role: 'admin' },
				'admin'
			);
			expect(result.membershipRole).toBe('owner');
			expect(result.project.id).toBe('proj_123');
		});

		it('grants owner access to view and delete project', async () => {
			const db = createMockDb('owner');
			const result = await requireProjectAccess(
				db,
				'proj_123',
				{ id: 'user_owner' },
				'admin'
			);
			expect(result.membershipRole).toBe('owner');
		});

		it('grants admin access to edit and delete project', async () => {
			const db = createMockDb('admin');
			const result = await requireProjectAccess(
				db,
				'proj_123',
				{ id: 'user_admin' },
				'admin'
			);
			expect(result.membershipRole).toBe('admin');
		});

		it('allows member to view and edit, but rejects admin action (delete)', async () => {
			const db = createMockDb('member');

			// Viewer role allowed
			const viewerResult = await requireProjectAccess(
				db,
				'proj_123',
				{ id: 'user_member' },
				'viewer'
			);
			expect(viewerResult.membershipRole).toBe('member');

			// Editor role allowed
			const editorResult = await requireProjectAccess(
				db,
				'proj_123',
				{ id: 'user_member' },
				'editor'
			);
			expect(editorResult.membershipRole).toBe('member');

			// Admin role rejected
			await expect(
				requireProjectAccess(db, 'proj_123', { id: 'user_member' }, 'admin')
			).rejects.toThrow(AuthGuardError);
		});

		it('rejects user with no membership in the organization', async () => {
			const db = createMockDb(null);
			await expect(
				requireProjectAccess(db, 'proj_123', { id: 'stranger_user' }, 'viewer')
			).rejects.toThrow(AuthGuardError);
		});

		it('grants owner access to personal demo project', async () => {
			const db = createMockDb(null);
			const result = await requireProjectAccess(
				db,
				'demo_user_1',
				{ id: 'user_1' },
				'viewer'
			);
			expect(result.membershipRole).toBe('owner');
		});
	});
});
