import { eq, and } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { type DrizzleClient, schema } from '@isitfun/db';

export const RoleRanks = {
	owner: 3,
	admin: 2,
	member: 1
} as const;

export type OrgRole = keyof typeof RoleRanks;

export function hasMinRole(actual: OrgRole, required: OrgRole): boolean {
	const actualRank = RoleRanks[actual] ?? 0;
	const requiredRank = RoleRanks[required] ?? 0;
	return actualRank >= requiredRank;
}

export class AuthGuardError extends HTTPException {
	constructor(status: 400 | 401 | 403 | 404, message: string) {
		super(status, {
			res: new Response(JSON.stringify({ error: message }), {
				status,
				headers: { 'Content-Type': 'application/json' }
			})
		});
	}
}

export interface OrgAccessResult {
	organization: typeof schema.organizations.$inferSelect;
	membershipRole: OrgRole;
}

export async function requireOrgAccess(
	db: DrizzleClient,
	orgId: string,
	user: { id: string; role?: string },
	minRole: OrgRole = 'member'
): Promise<OrgAccessResult> {
	const org = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, orgId))
		.get();

	if (!org) {
		throw new AuthGuardError(404, 'Organization not found');
	}

	// Global admin bypass
	if (user.role === 'admin') {
		return { organization: org, membershipRole: 'owner' };
	}

	const membership = await db
		.select()
		.from(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.organizationId, orgId),
				eq(schema.organizationMemberships.userId, user.id)
			)
		)
		.get();

	if (!membership) {
		throw new AuthGuardError(403, 'Forbidden: Not a member of this organization');
	}

	const userRole = membership.role as OrgRole;
	if (!hasMinRole(userRole, minRole)) {
		throw new AuthGuardError(403, `Forbidden: Requires ${minRole} permissions`);
	}

	return { organization: org, membershipRole: userRole };
}

export type RequiredProjectRole = 'viewer' | 'editor' | 'admin';

export interface ProjectAccessResult {
	project: typeof schema.projects.$inferSelect;
	organization: typeof schema.organizations.$inferSelect | null;
	membershipRole: OrgRole;
}

export async function requireProjectAccess(
	db: DrizzleClient,
	projectId: string,
	user: { id: string; role?: string },
	minRole: RequiredProjectRole = 'viewer'
): Promise<ProjectAccessResult> {
	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) {
		throw new AuthGuardError(404, 'Project not found');
	}

	// Global admin bypass
	if (user.role === 'admin') {
		const org = project.organizationId
			? await db
					.select()
					.from(schema.organizations)
					.where(eq(schema.organizations.id, project.organizationId))
					.get()
			: null;
		return { project, organization: org ?? null, membershipRole: 'owner' };
	}

	// Interactive user demo project
	if (projectId === `demo_${user.id}` || projectId === 'demo') {
		const org = project.organizationId
			? await db
					.select()
					.from(schema.organizations)
					.where(eq(schema.organizations.id, project.organizationId))
					.get()
			: null;
		return { project, organization: org ?? null, membershipRole: 'owner' };
	}

	// 1. Direct organization membership check
	if (project.organizationId) {
		const org = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, project.organizationId))
			.get();

		if (!org) {
			throw new AuthGuardError(404, 'Workspace organization not found');
		}

		const membership = await db
			.select()
			.from(schema.organizationMemberships)
			.where(
				and(
					eq(schema.organizationMemberships.organizationId, project.organizationId),
					eq(schema.organizationMemberships.userId, user.id)
				)
			)
			.get();

		if (!membership) {
			throw new AuthGuardError(403, 'Forbidden: You do not have access to this project');
		}

		const role = membership.role as OrgRole;

		if (minRole === 'admin') {
			if (!hasMinRole(role, 'admin')) {
				throw new AuthGuardError(403, 'Forbidden: Workspace admin role required for this action');
			}
		}

		return { project, organization: org, membershipRole: role };
	}

	// 2. Fallback for legacy solo project (userId check)
	if (project.userId === user.id) {
		return { project, organization: null, membershipRole: 'owner' };
	}

	throw new AuthGuardError(403, 'Forbidden: You do not have access to this project');
}
