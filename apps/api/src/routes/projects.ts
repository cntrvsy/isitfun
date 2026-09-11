import { Hono } from 'hono';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import { createD1Client, schema } from '@isitfun/db';
import {
	CreateProjectSchema,
	UpdateProjectSchema,
	CreateAccessKeySchema,
	TierLimits
} from '@isitfun/shared';
import type { AppEnv } from '../types';
import { sessionMiddleware, requireAuth } from '../middleware/auth';
import { hashPassword } from '../lib/crypto';

export const projectsRouter = new Hono<AppEnv>();

// Apply session extraction and require authentication for all project management routes
projectsRouter.use('*', sessionMiddleware, requireAuth);

// GET /v1/projects - List user's projects (direct or via organization membership)
projectsRouter.get('/', async (c) => {
	const user = c.get('user')!;
	const db = createD1Client(c.env.DB);

	// Get projects owned by the user
	const userProjects = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.userId, user.id))
		.orderBy(desc(schema.projects.createdAt))
		.all();

	// Also get projects from organizations the user is a member of
	const memberships = await db
		.select({ orgId: schema.organizationMemberships.organizationId })
		.from(schema.organizationMemberships)
		.where(eq(schema.organizationMemberships.userId, user.id))
		.all();

	const orgIds = memberships.map((m) => m.orgId);
	let orgProjects: typeof userProjects = [];

	if (orgIds.length > 0) {
		orgProjects = await db
			.select()
			.from(schema.projects)
			.where(inArray(schema.projects.organizationId, orgIds))
			.all();
	}

	// Merge and deduplicate by project ID
	const allProjectsMap = new Map<string, (typeof userProjects)[0]>();
	for (const p of userProjects) allProjectsMap.set(p.id, p);
	for (const p of orgProjects) allProjectsMap.set(p.id, p);

	return c.json({ projects: Array.from(allProjectsMap.values()) });
});

// POST /v1/projects - Create a new project
projectsRouter.post('/', vValidator('json', CreateProjectSchema), async (c) => {
	const user = c.get('user')!;
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	let organizationId: string | null = null;

	if (data.organizationId) {
		// Verify membership
		const membership = await db
			.select()
			.from(schema.organizationMemberships)
			.where(
				and(
					eq(schema.organizationMemberships.organizationId, data.organizationId),
					eq(schema.organizationMemberships.userId, user.id)
				)
			)
			.get();

		if (!membership) {
			return c.json({ error: 'Forbidden: Not a member of this organization' }, 403);
		}

		organizationId = data.organizationId;

		// Check org tier limit
		const org = await db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
			.get();

		if (!org) return c.json({ error: 'Organization not found' }, 404);

		if (org.tier !== 'team') {
			const activeProjects = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.organizationId, organizationId))
				.all();

			if (activeProjects.length >= TierLimits.free.maxActiveProjects) {
				return c.json(
					{
						error: 'Free organizations are limited to 1 active project. Upgrade to Team Plan.'
					},
					400
				);
			}
		}
	} else {
		// Solo free tier project limit
		const activeFreeProjects = await db
			.select()
			.from(schema.projects)
			.where(
				and(
					eq(schema.projects.userId, user.id),
					isNull(schema.projects.organizationId),
					eq(schema.projects.tier, 'free')
				)
			)
			.all();

		if (activeFreeProjects.length >= TierLimits.free.maxActiveProjects) {
			return c.json(
				{
					error: 'Free tier is limited to 1 active project. Delete your existing project or upgrade.'
				},
				400
			);
		}
	}

	const projectId = schema.generateNanoID(12);
	let passwordHash: string | null = null;
	if (data.passwordProtected && data.password) {
		passwordHash = await hashPassword(data.password, projectId);
	}

	const now = new Date();
	await db.insert(schema.projects).values({
		id: projectId,
		userId: user.id,
		organizationId,
		name: data.name.trim(),
		passwordProtected: Boolean(data.passwordProtected),
		passwordHash,
		tier: 'free',
		createdAt: now
	});

	// Initialize quotas record
	await db.insert(schema.projectQuotas).values({
		projectId,
		monthlyWriteCount: 0,
		maxWriteLimit: TierLimits.free.maxMonthlyWrites,
		storageBytesUsed: 0,
		lastResetAt: now
	});

	return c.json({ success: true, projectId }, 201);
});

// GET /v1/projects/:id - Get project details with access keys and quotas
projectsRouter.get('/:id', async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) return c.json({ error: 'Project not found' }, 404);

	// Check access permissions
	if (project.userId !== user.id && project.organizationId) {
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
		if (!membership && user.role !== 'admin') {
			return c.json({ error: 'Forbidden' }, 403);
		}
	} else if (project.userId !== user.id && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	const accessKeys = await db
		.select()
		.from(schema.projectAccessKeys)
		.where(eq(schema.projectAccessKeys.projectId, projectId))
		.all();

	const quotas = await db
		.select()
		.from(schema.projectQuotas)
		.where(eq(schema.projectQuotas.projectId, projectId))
		.get();

	return c.json({ project, accessKeys, quotas });
});

// PATCH /v1/projects/:id - Update project settings
projectsRouter.patch('/:id', vValidator('json', UpdateProjectSchema), async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) return c.json({ error: 'Project not found' }, 404);
	if (project.userId !== user.id && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	const updates: Partial<typeof schema.projects.$inferInsert> = {};
	if (data.name) updates.name = data.name.trim();
	if (data.passwordProtected !== undefined) {
		updates.passwordProtected = data.passwordProtected;
		if (data.passwordProtected && data.password) {
			updates.passwordHash = await hashPassword(data.password, projectId);
		} else if (!data.passwordProtected) {
			updates.passwordHash = null;
		}
	}

	await db.update(schema.projects).set(updates).where(eq(schema.projects.id, projectId));

	return c.json({ success: true });
});

// DELETE /v1/projects/:id - Delete project
projectsRouter.delete('/:id', async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) return c.json({ error: 'Project not found' }, 404);
	if (project.userId !== user.id && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	// Delete from D1 (cascades related tables)
	await db.delete(schema.projects).where(eq(schema.projects.id, projectId));

	return c.json({ success: true });
});

// POST /v1/projects/:id/keys - Generate a new access key
projectsRouter.post('/:id/keys', vValidator('json', CreateAccessKeySchema), async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) return c.json({ error: 'Project not found' }, 404);
	if (project.userId !== user.id && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	const code = schema.generateNanoID(8).toUpperCase();
	const keyId = crypto.randomUUID();
	const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
	const maxUses = data.maxUses ?? (TierLimits[project.tier as 'free' | 'pro_pass' | 'team']?.maxUsesPerKey || 20);

	await db.insert(schema.projectAccessKeys).values({
		id: keyId,
		projectId,
		name: data.name.trim(),
		code,
		maxUses,
		usedCount: 0,
		expiresAt,
		isActive: true,
		createdAt: new Date()
	});

	return c.json({ success: true, key: { id: keyId, code, name: data.name } }, 201);
});

// DELETE /v1/projects/:id/keys/:keyId - Delete an access key
projectsRouter.delete('/:id/keys/:keyId', async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const keyId = c.req.param('keyId');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) return c.json({ error: 'Project not found' }, 404);
	if (project.userId !== user.id && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	await db
		.delete(schema.projectAccessKeys)
		.where(
			and(
				eq(schema.projectAccessKeys.id, keyId),
				eq(schema.projectAccessKeys.projectId, projectId)
			)
		);

	return c.json({ success: true });
});
