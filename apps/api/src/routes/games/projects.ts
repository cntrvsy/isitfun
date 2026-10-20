import { Hono } from 'hono';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import * as v from 'valibot';
import { createD1Client, schema } from '@isitfun/db';
import {
	CreateProjectSchema,
	UpdateProjectSchema,
	CreateAccessKeySchema,
	InitBuildSchema,
	PublishBuildSchema,
	TierLimits,
	validateAccessKey
} from '@isitfun/shared';
import type { AppEnv } from '../../types';
import type { ReadableStream as CFReadableStream } from '@cloudflare/workers-types';
import { sessionMiddleware, requireAuth } from '../../middleware/auth';
import { guessContentType, guessContentEncoding } from '../../lib/r2';
import { getEffectiveTier } from '../../lib/billing/entitlements';
import { zipSync, strToU8 } from 'fflate';
import { requireProjectAccess, requireOrgAccess } from '../../lib/auth-guard';
import { getUserPersonalOrg } from '../../lib/orgs';

export const projectsRouter = new Hono<AppEnv>()
	// Public endpoint for playtesters verifying access keys or passwords
	.post(
		'/:id/verify-key',
		vValidator('json', v.object({ password: v.optional(v.string()) })),
		async (c) => {
			const projectId = c.req.param('id');
			const body = c.req.valid('json');
			const passwordInput = String(body.password || '').trim();
			const db = createD1Client(c.env.DB);

			if (!passwordInput) {
				return c.json({ valid: false, reason: 'missing_password' }, 400);
			}

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, projectId))
				.get();

			if (!project) return c.json({ error: 'Project not found' }, 404);

			// Check access keys
			const keys = await db
				.select()
				.from(schema.projectAccessKeys)
				.where(
					and(
						eq(schema.projectAccessKeys.projectId, projectId),
						eq(schema.projectAccessKeys.isActive, true)
					)
				)
				.all();

			const matchingKey = keys.find((k) => k.code.toUpperCase() === passwordInput.toUpperCase());

			if (matchingKey) {
				const validation = validateAccessKey(matchingKey);
				if (!validation.valid) {
					return c.json({ valid: false, reason: validation.reason }, 400);
				}
				return c.json({ valid: true, isKey: true, key: matchingKey.code });
			}

			return c.json({ valid: false, reason: 'incorrect_key' }, 400);
		}
	)
	// GET /v1/projects/:id/public - Public metadata for playtesters & launch screen
	.get('/:id/public', async (c) => {
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		const project = await db
			.select({
				id: schema.projects.id,
				name: schema.projects.name,
				tier: schema.projects.tier
			})
			.from(schema.projects)
			.where(eq(schema.projects.id, projectId))
			.get();

		if (!project) return c.json({ error: 'Project not found' }, 404);

		const activeKeys = await db
			.select({
				id: schema.projectAccessKeys.id,
				code: schema.projectAccessKeys.code,
				isActive: schema.projectAccessKeys.isActive,
				expiresAt: schema.projectAccessKeys.expiresAt,
				maxUses: schema.projectAccessKeys.maxUses,
				usedCount: schema.projectAccessKeys.usedCount
			})
			.from(schema.projectAccessKeys)
			.where(
				and(
					eq(schema.projectAccessKeys.projectId, projectId),
					eq(schema.projectAccessKeys.isActive, true)
				)
			)
			.all();

		return c.json({
			id: project.id,
			name: project.name,
			tier: project.tier,
			hasActiveKeys: activeKeys.length > 0,
			keys: activeKeys
		});
	})
	// Apply session extraction and require authentication for all project management routes
	.use('*', sessionMiddleware, requireAuth)
	// GET /v1/projects - List user's projects (via organization memberships)
	.get('/', async (c) => {
		const user = c.get('user')!;
		const db = createD1Client(c.env.DB);

		const memberships = await db
			.select({ orgId: schema.organizationMemberships.organizationId })
			.from(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.userId, user.id))
			.all();

		const orgIds = memberships.map((m) => m.orgId);
		if (orgIds.length === 0) {
			return c.json({ projects: [] });
		}

		const orgProjects = await db
			.select()
			.from(schema.projects)
			.where(inArray(schema.projects.organizationId, orgIds))
			.orderBy(desc(schema.projects.createdAt))
			.all();

		return c.json({ projects: orgProjects });
	})
	// POST /v1/projects - Create a new project
	.post('/', vValidator('json', CreateProjectSchema), async (c) => {
		const user = c.get('user')!;
		const data = c.req.valid('json');
		const db = createD1Client(c.env.DB);

		let targetOrg: typeof schema.organizations.$inferSelect;

		if (data.organizationId) {
			const { organization } = await requireOrgAccess(db, data.organizationId, user, 'member');
			targetOrg = organization;
		} else {
			targetOrg = await getUserPersonalOrg(db, user);
		}

		const organizationId = targetOrg.id;

		// Check org tier limit
		if (targetOrg.tier !== 'team') {
			const activeProjects = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.organizationId, organizationId))
				.all();

			if (activeProjects.length >= TierLimits.free.maxActiveProjects) {
				const errorMsg =
					targetOrg.type === 'personal'
						? 'Free personal tier is limited to 1 active project. Delete your existing project or upgrade.'
						: 'Free organizations are limited to 1 active project. Upgrade to Team Plan.';
				return c.json({ error: errorMsg }, 400);
			}
		}

		const projectId = schema.generateNanoID(12);
		const now = new Date();

		await db.insert(schema.projects).values({
			id: projectId,
			userId: user.id,
			organizationId,
			name: data.name.trim(),
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

		// Auto-generate default playtest access key (20 uses)
		const defaultKey = schema.generateNanoID(6).toUpperCase();
		await db.insert(schema.projectAccessKeys).values({
			projectId,
			name: 'Default Playtest Key',
			code: defaultKey,
			maxUses: 20,
			usedCount: 0,
			isActive: true,
			createdAt: now
		});

		return c.json({ success: true, projectId, defaultKey }, 201);
	})
	// GET /v1/projects/:id - Get project details with access keys and quotas
	.get('/:id', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		const { project } = await requireProjectAccess(db, projectId, user, 'viewer');

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
	})
	// PATCH /v1/projects/:id - Update project settings
	.patch('/:id', vValidator('json', UpdateProjectSchema), async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const data = c.req.valid('json');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'editor');

		const updates: Partial<typeof schema.projects.$inferInsert> = {};
		if (data.name) updates.name = data.name.trim();

		if (Object.keys(updates).length > 0) {
			await db.update(schema.projects).set(updates).where(eq(schema.projects.id, projectId));
		}

		return c.json({ success: true });
	})
	// DELETE /v1/projects/:id - Delete project
	.delete('/:id', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'admin');

		// Purge all R2 game assets and session logs
		const bucket = c.env.GAMES_BUCKET;
		if (bucket) {
			try {
				let truncated = true;
				let cursor: string | undefined = undefined;
				while (truncated) {
					const listResult = await bucket.list({ prefix: `games/${projectId}/`, cursor });
					if (listResult.objects && listResult.objects.length > 0) {
						await bucket.delete(listResult.objects.map((o) => o.key));
					}
					truncated = listResult.truncated;
					cursor = listResult.truncated ? listResult.cursor : undefined;
				}
			} catch (r2Err) {
				console.error('[Projects] Failed to purge R2 bucket objects on delete:', r2Err);
			}
		}

		// Delete from D1 (cascades related tables)
		await db.delete(schema.projects).where(eq(schema.projects.id, projectId));

		return c.json({ success: true });
	})
	// POST /v1/projects/:id/keys - Generate a new access key
	.post('/:id/keys', vValidator('json', CreateAccessKeySchema), async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const data = c.req.valid('json');
		const db = createD1Client(c.env.DB);

		const { project, organization } = await requireProjectAccess(db, projectId, user, 'editor');
		const effectiveTier = getEffectiveTier(
			project.tier,
			organization?.tier,
			organization?.subscriptionStatus
		);

		const code = schema.generateNanoID(8).toUpperCase();
		const keyId = crypto.randomUUID();
		const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
		const maxUses =
			data.maxUses !== undefined ? data.maxUses : TierLimits[effectiveTier].maxUsesPerKey;

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
	})
	// DELETE /v1/projects/:id/keys/:keyId - Delete an access key
	.delete('/:id/keys/:keyId', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const keyId = c.req.param('keyId');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'editor');

		await db
			.delete(schema.projectAccessKeys)
			.where(
				and(
					eq(schema.projectAccessKeys.id, keyId),
					eq(schema.projectAccessKeys.projectId, projectId)
				)
			);

		return c.json({ success: true });
	})
	// PATCH /v1/projects/keys/:keyId - Toggle or update an access key
	.patch(
		'/keys/:keyId',
		vValidator('json', v.object({ isActive: v.optional(v.boolean()) })),
		async (c) => {
			const user = c.get('user')!;
			const keyId = c.req.param('keyId');
			const body = c.req.valid('json');
			const db = createD1Client(c.env.DB);

			const key = await db
				.select()
				.from(schema.projectAccessKeys)
				.where(eq(schema.projectAccessKeys.id, keyId))
				.get();

			if (!key) return c.json({ error: 'Access key not found' }, 404);

			await requireProjectAccess(db, key.projectId, user, 'editor');

			const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;
			await db
				.update(schema.projectAccessKeys)
				.set({ isActive })
				.where(eq(schema.projectAccessKeys.id, keyId));

			return c.json({ success: true });
		}
	)
	// DELETE /v1/projects/keys/:keyId - Delete access key by ID
	.delete('/keys/:keyId', async (c) => {
		const user = c.get('user')!;
		const keyId = c.req.param('keyId');
		const db = createD1Client(c.env.DB);

		const key = await db
			.select()
			.from(schema.projectAccessKeys)
			.where(eq(schema.projectAccessKeys.id, keyId))
			.get();

		if (!key) return c.json({ error: 'Access key not found' }, 404);

		await requireProjectAccess(db, key.projectId, user, 'editor');

		await db.delete(schema.projectAccessKeys).where(eq(schema.projectAccessKeys.id, keyId));

		return c.json({ success: true });
	})
	// GET /v1/projects/:id/builds - List all versioned builds for a project
	.get('/:id/builds', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'viewer');

		const builds = await db
			.select()
			.from(schema.gameBuilds)
			.where(eq(schema.gameBuilds.projectId, projectId))
			.orderBy(desc(schema.gameBuilds.uploadedAt))
			.all();

		return c.json({ builds });
	})
	// POST /v1/projects/:id/builds/init - Initialize a new versioned game build
	.post('/:id/builds/init', vValidator('json', InitBuildSchema), async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const body = c.req.valid('json');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'editor');

		const buildId = crypto.randomUUID();
		const r2FolderPath = `games/${projectId}/builds/${buildId}`;

		await db.insert(schema.gameBuilds).values({
			id: buildId,
			projectId,
			versionString: body.versionString || '1.0.0',
			r2FolderPath,
			totalSizeBytes: 0,
			isActive: false,
			uploadedAt: new Date()
		});

		return c.json({ success: true, buildId, r2FolderPath }, 201);
	})
	// POST /v1/projects/:id/builds/:buildId/upload - Stream file chunk to versioned build
	.post('/:id/builds/:buildId/upload', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const buildId = c.req.param('buildId');
		const rawPath = c.req.query('path');
		const db = createD1Client(c.env.DB);

		if (!rawPath) {
			return c.json({ error: 'Missing path query parameter' }, 400);
		}

		const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
		if (
			normalizedPath.includes('..') ||
			normalizedPath.includes('\0') ||
			normalizedPath.startsWith('/') ||
			!normalizedPath.trim()
		) {
			return c.json({ error: 'Invalid or unsafe file path' }, 400);
		}

		const { project, organization } = await requireProjectAccess(db, projectId, user, 'editor');
		const effectiveTier = getEffectiveTier(
			project.tier,
			organization?.tier,
			organization?.subscriptionStatus
		);
		const limits = TierLimits[effectiveTier];

		const contentLengthHeader = c.req.header('content-length');
		if (!contentLengthHeader || isNaN(Number(contentLengthHeader))) {
			return c.json({ error: 'Length Required: Content-Length header is missing or invalid' }, 411);
		}

		const contentLength = Number(contentLengthHeader);
		if (contentLength <= 0 || contentLength > limits.maxFileSizeMb * 1024 * 1024) {
			return c.json({ error: `File size exceeds ${limits.maxFileSizeMb} MB tier limit` }, 413);
		}

		const bucket = c.env.GAMES_BUCKET;
		if (!bucket) {
			return c.json({ error: 'GAMES_BUCKET binding missing' }, 500);
		}

		const r2Key = `games/${projectId}/builds/${buildId}/${normalizedPath}`;
		const body = c.req.raw.body;
		if (!body) {
			return c.json({ error: 'Empty file body' }, 400);
		}

		const contentType = guessContentType(normalizedPath);
		const contentEncoding = guessContentEncoding(normalizedPath);

		try {
			await bucket.put(r2Key, body as unknown as CFReadableStream, {
				httpMetadata: {
					contentType,
					...(contentEncoding ? { contentEncoding } : {})
				}
			});

			return c.json({ success: true, key: r2Key, size: contentLength });
		} catch (err) {
			console.error('[Build Upload] Failed to upload chunk to R2:', err);
			return c.json({ error: 'R2 chunk upload failed' }, 500);
		}
	})
	// POST /v1/projects/:id/builds/:buildId/publish - Atomically activate build and auto-prune prior builds
	.post('/:id/builds/:buildId/publish', vValidator('json', PublishBuildSchema), async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const buildId = c.req.param('buildId');
		const body = c.req.valid('json');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'editor');

		// Check if build exists
		const build = await db
			.select()
			.from(schema.gameBuilds)
			.where(and(eq(schema.gameBuilds.id, buildId), eq(schema.gameBuilds.projectId, projectId)))
			.get();

		if (!build) {
			return c.json({ error: 'Build not found' }, 404);
		}

		// Deactivate all builds for this project
		await db
			.update(schema.gameBuilds)
			.set({ isActive: false })
			.where(eq(schema.gameBuilds.projectId, projectId));

		// Activate this build
		await db
			.update(schema.gameBuilds)
			.set({
				isActive: true,
				totalSizeBytes: body.totalSizeBytes || 0,
				uploadedAt: new Date()
			})
			.where(eq(schema.gameBuilds.id, buildId));

		// Update project quota storage
		if (body.totalSizeBytes) {
			await db
				.update(schema.projectQuotas)
				.set({ storageBytesUsed: body.totalSizeBytes })
				.where(eq(schema.projectQuotas.projectId, projectId));
		}

		// Background: Auto-prune builds older than the 5 most recent builds
		const bucket = c.env.GAMES_BUCKET;
		const allBuilds = await db
			.select()
			.from(schema.gameBuilds)
			.where(eq(schema.gameBuilds.projectId, projectId))
			.orderBy(desc(schema.gameBuilds.uploadedAt))
			.all();

		const buildsToPrune = allBuilds.slice(5);

		if (bucket && buildsToPrune.length > 0) {
			c.executionCtx.waitUntil(
				(async () => {
					for (const pb of buildsToPrune) {
						try {
							const listResult = await bucket.list({
								prefix: `games/${projectId}/builds/${pb.id}/`
							});
							if (listResult.objects.length > 0) {
								await bucket.delete(listResult.objects.map((o) => o.key));
							}
							await db.delete(schema.gameBuilds).where(eq(schema.gameBuilds.id, pb.id));
						} catch (pruneErr) {
							console.warn('[Builds] Failed auto-pruning prior build:', pruneErr);
						}
					}
				})()
			);
		}

		return c.json({ success: true, activeBuildId: buildId });
	})
	// POST /v1/projects/:id/upload - Direct upload fallback with atomic quota update
	.post('/:id/upload', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const rawPath = c.req.query('path');
		const db = createD1Client(c.env.DB);

		if (!rawPath) {
			return c.json({ error: 'Missing path query parameter' }, 400);
		}

		// Normalize and sanitize path to prevent directory traversal
		const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
		if (
			normalizedPath.includes('..') ||
			normalizedPath.includes('\0') ||
			normalizedPath.startsWith('/') ||
			!normalizedPath.trim()
		) {
			return c.json({ error: 'Invalid or unsafe file path' }, 400);
		}
		const filePath = normalizedPath;

		const { project, organization } = await requireProjectAccess(db, projectId, user, 'editor');
		const effectiveTier = getEffectiveTier(
			project.tier,
			organization?.tier,
			organization?.subscriptionStatus
		);
		const limits = TierLimits[effectiveTier];

		const contentLengthHeader = c.req.header('content-length');
		if (!contentLengthHeader || isNaN(Number(contentLengthHeader))) {
			return c.json({ error: 'Length Required: Content-Length header is missing or invalid' }, 411);
		}

		const contentLength = Number(contentLengthHeader);
		if (contentLength <= 0 || contentLength > limits.maxFileSizeMb * 1024 * 1024) {
			return c.json({ error: `File size exceeds ${limits.maxFileSizeMb} MB tier limit` }, 413);
		}

		const bucket = c.env.GAMES_BUCKET;
		if (!bucket) {
			return c.json({ error: 'GAMES_BUCKET binding missing' }, 500);
		}

		const r2Key = `games/${projectId}/assets/${filePath}`;
		const body = c.req.raw.body;
		if (!body) {
			return c.json({ error: 'Empty file body' }, 400);
		}

		let quota = await db
			.select()
			.from(schema.projectQuotas)
			.where(eq(schema.projectQuotas.projectId, projectId))
			.get();

		if (!quota) {
			const newQuota = {
				id: crypto.randomUUID(),
				projectId,
				monthlyWriteCount: 0,
				maxWriteLimit: limits.maxMonthlyWrites,
				storageBytesUsed: 0,
				lastResetAt: new Date()
			};
			await db.insert(schema.projectQuotas).values(newQuota);
			quota = { ...newQuota };
		}

		let existingSize = 0;
		try {
			const existingObject = await bucket.head(r2Key);
			if (existingObject) existingSize = existingObject.size;
		} catch {
			// Object does not exist yet; default to 0
		}

		const sizeDifference = contentLength - existingSize;
		const maxStorageLimit = limits.maxStorageMb * 1024 * 1024;
		if (quota.storageBytesUsed + sizeDifference > maxStorageLimit) {
			return c.json(
				{
					error: `Upload would exceed project storage limit of ${limits.maxStorageMb} MB`
				},
				413
			);
		}

		const contentType = guessContentType(filePath);
		const contentEncoding = guessContentEncoding(filePath);

		try {
			await bucket.put(r2Key, body as unknown as CFReadableStream, {
				httpMetadata: {
					contentType,
					...(contentEncoding ? { contentEncoding } : {})
				}
			});

			await db
				.update(schema.projectQuotas)
				.set({
					storageBytesUsed: sql`${schema.projectQuotas.storageBytesUsed} + ${sizeDifference}`
				})
				.where(eq(schema.projectQuotas.projectId, projectId));

			return c.json({ success: true, key: r2Key });
		} catch (err) {
			console.error('[Upload] Failed to upload file to R2:', err);
			return c.json({ error: 'R2 upload failed' }, 500);
		}
	})
	// GET /v1/projects/:id/sessions/:sessionId - Get raw session JSON from R2
	.get('/:id/sessions/:sessionId', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const sessionId = c.req.param('sessionId');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'viewer');

		const bucket = c.env.GAMES_BUCKET;
		const r2Key = `games/${projectId}/sessions/${sessionId}.json`;

		if (!bucket) {
			return c.json({
				projectId,
				sessionId,
				createdAt: new Date().toISOString(),
				logs: [
					{
						event: 'console.log',
						data: { message: 'Dev mock session preview' },
						timestamp: Date.now()
					}
				],
				logCount: 1,
				hasCrashed: false,
				avgFps: 60,
				gpuRenderer: 'WebGL Mock Renderer',
				sentiment: 'fun',
				userComment: 'Dev mock session preview'
			});
		}

		const object = await bucket.get(r2Key);
		if (!object) return c.json({ error: 'Session details not found in storage' }, 404);

		const rawJson = await object.text();
		try {
			return c.json(JSON.parse(rawJson));
		} catch {
			return c.json({ error: 'Failed to parse session JSON' }, 500);
		}
	})
	// DELETE /v1/projects/:id/sessions/:sessionId - Delete session log from R2 and D1
	.delete('/:id/sessions/:sessionId', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const sessionId = c.req.param('sessionId');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'editor');

		const bucket = c.env.GAMES_BUCKET;
		if (bucket) {
			const r2Key = `games/${projectId}/sessions/${sessionId}.json`;
			try {
				await bucket.delete(r2Key);
			} catch (err) {
				console.error('[Session Delete] R2 delete failed:', err);
			}
		}

		await db
			.delete(schema.telemetrySessions)
			.where(
				and(
					eq(schema.telemetrySessions.id, sessionId),
					eq(schema.telemetrySessions.projectId, projectId)
				)
			);

		return c.json({ success: true });
	})
	// GET /v1/projects/:id/export/csv - Export session logs in CSV format
	.get('/:id/export/csv', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'viewer');

		const bucket = c.env.GAMES_BUCKET;
		type SessionPayload = {
			sessionId: string;
			createdAt: string | number;
			avgFps?: number | null;
			gpuRenderer?: string | null;
			sentiment?: string | null;
			userComment?: string | null;
			hasCrashed?: boolean;
			browserInfo?: string | null;
			logs: Array<{ event: string; data: Record<string, unknown>; timestamp?: number }>;
		};

		const compiledLogs: {
			sessionId: string;
			eventName: string;
			parsedPayload: Record<string, unknown>;
			createdAt: string | number;
			avgFps: string;
			gpuRenderer: string;
			sentiment: string;
			userComment: string;
			hasCrashed: string;
		}[] = [];

		if (bucket) {
			const listResult = await bucket.list({ prefix: `games/${projectId}/sessions/`, limit: 100 });
			for (const obj of listResult.objects) {
				const sessionObj = await bucket.get(obj.key);
				if (sessionObj) {
					try {
						const data = (await sessionObj.json()) as SessionPayload;
						if (data && Array.isArray(data.logs)) {
							for (const log of data.logs) {
								compiledLogs.push({
									sessionId:
										data.sessionId || obj.key.split('/').pop()?.replace('.json', '') || 'unknown',
									eventName: log.event,
									parsedPayload: (log.data as Record<string, unknown>) || {},
									createdAt: log.timestamp || data.createdAt,
									avgFps: data.avgFps ? String(data.avgFps) : '',
									gpuRenderer: data.gpuRenderer || '',
									sentiment: data.sentiment || '',
									userComment: data.userComment || '',
									hasCrashed: data.hasCrashed ? 'true' : 'false'
								});
							}
						}
					} catch {
						// Skip corrupt files
					}
				}
			}
		}

		const payloadKeysSet = new Set<string>();
		for (const log of compiledLogs) {
			const parsedPayload = log.parsedPayload;
			if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
				Object.keys(parsedPayload).forEach((key) => payloadKeysSet.add(key));
			}
		}
		const payloadKeys = Array.from(payloadKeysSet).sort();
		const baseHeaders = [
			'Session ID',
			'Event Name',
			'Timestamp',
			'Avg FPS',
			'GPU Renderer',
			'Sentiment',
			'User Comment',
			'Has Crashed'
		];
		const headers = [...baseHeaders, ...payloadKeys];
		const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

		for (const log of compiledLogs) {
			const formattedDate = new Date(log.createdAt).toISOString();
			const row = [
				log.sessionId,
				log.eventName,
				formattedDate,
				log.avgFps,
				log.gpuRenderer,
				log.sentiment,
				log.userComment,
				log.hasCrashed
			];

			for (const key of payloadKeys) {
				const val = log.parsedPayload[key];
				if (val === undefined || val === null) {
					row.push('');
				} else if (typeof val === 'object') {
					row.push(`"${JSON.stringify(val).replace(/"/g, '""')}"`);
				} else {
					row.push(`"${String(val).replace(/"/g, '""')}"`);
				}
			}
			csvRows.push(
				row
					.map((field, idx) => {
						if (idx >= baseHeaders.length) return field;
						return `"${field.replace(/"/g, '""')}"`;
					})
					.join(',')
			);
		}

		return c.text(csvRows.join('\n'), 200, {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="project_${projectId}_export.csv"`
		});
	})
	// GET /v1/projects/:id/export/json - Export session logs in JSON format
	.get('/:id/export/json', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		await requireProjectAccess(db, projectId, user, 'viewer');

		const bucket = c.env.GAMES_BUCKET;
		type SessionPayload = {
			sessionId: string;
			createdAt: string | number;
			avgFps?: number | null;
			gpuRenderer?: string | null;
			sentiment?: string | null;
			userComment?: string | null;
			hasCrashed?: boolean;
			browserInfo?: string | null;
			logs: Array<{ event: string; data: unknown; timestamp?: number }>;
		};

		const compiledLogs: {
			sessionId: string;
			eventName: string;
			payload: unknown;
			createdAt: string | number;
			sessionMetadata: {
				avgFps?: number | null;
				gpuRenderer?: string | null;
				sentiment?: string | null;
				userComment?: string | null;
				hasCrashed?: boolean;
				browserInfo?: string | null;
			};
		}[] = [];

		if (bucket) {
			const listResult = await bucket.list({ prefix: `games/${projectId}/sessions/`, limit: 100 });
			for (const obj of listResult.objects) {
				const sessionObj = await bucket.get(obj.key);
				if (sessionObj) {
					try {
						const data = (await sessionObj.json()) as SessionPayload;
						if (data && Array.isArray(data.logs)) {
							for (const log of data.logs) {
								compiledLogs.push({
									sessionId:
										data.sessionId || obj.key.split('/').pop()?.replace('.json', '') || 'unknown',
									eventName: log.event,
									payload: log.data,
									createdAt: log.timestamp || data.createdAt,
									sessionMetadata: {
										avgFps: data.avgFps || null,
										gpuRenderer: data.gpuRenderer || null,
										sentiment: data.sentiment || null,
										userComment: data.userComment || null,
										hasCrashed: !!data.hasCrashed,
										browserInfo: data.browserInfo || null
									}
								});
							}
						}
					} catch {
						// Skip corrupt files
					}
				}
			}
		}

		return c.json(compiledLogs, 200, {
			'Content-Disposition': `attachment; filename="project_${projectId}_export.json"`
		});
	})
	// GET /v1/projects/:id/export/zip - Export session logs in ZIP archive
	.get('/:id/export/zip', async (c) => {
		const user = c.get('user')!;
		const projectId = c.req.param('id');
		const db = createD1Client(c.env.DB);

		const { project } = await requireProjectAccess(db, projectId, user, 'viewer');

		const bucket = c.env.GAMES_BUCKET;
		const zipFiles: Record<string, Uint8Array> = {};

		if (bucket) {
			const prefix = `games/${projectId}/sessions/`;
			const objectList = await bucket.list({ prefix, limit: 100 });

			for (const obj of objectList.objects) {
				const fileObj = await bucket.get(obj.key);
				if (fileObj) {
					const content = await fileObj.text();
					const filename = obj.key.split('/').pop() || `${crypto.randomUUID()}.json`;
					zipFiles[filename] = strToU8(content);
				}
			}
		}

		const readmeContent = `IsItFun Playtest Data Export\nProject: ${project.name} (ID: ${projectId})\nExported At: ${new Date().toISOString()}\n\nThis archive contains raw JSON playtest session logs collected from your HTML5 game builds.\n`;
		zipFiles['README.txt'] = strToU8(readmeContent);

		const zipUint8Array = zipSync(zipFiles);

		return c.body(zipUint8Array, 200, {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="playtests-${projectId}-${Date.now()}.zip"`
		});
	})
	// POST /v1/projects/:id/transfer - Transfer project to another organization
	.post(
		'/:id/transfer',
		vValidator('json', v.object({ targetOrganizationId: v.string() })),
		async (c) => {
			const user = c.get('user')!;
			const projectId = c.req.param('id');
			const { targetOrganizationId } = c.req.valid('json');
			const db = createD1Client(c.env.DB);

			// Must be admin/owner of current project
			await requireProjectAccess(db, projectId, user, 'admin');

			// Must be admin/owner of target organization
			const { organization: targetOrg } = await requireOrgAccess(
				db,
				targetOrganizationId,
				user,
				'admin'
			);

			// Check target organization project quota
			if (targetOrg.tier !== 'team') {
				const activeProjects = await db
					.select()
					.from(schema.projects)
					.where(eq(schema.projects.organizationId, targetOrganizationId))
					.all();

				if (activeProjects.length >= TierLimits.free.maxActiveProjects) {
					return c.json(
						{ error: 'Target organization has reached its project limit under the free tier.' },
						400
					);
				}
			}

			await db
				.update(schema.projects)
				.set({ organizationId: targetOrganizationId })
				.where(eq(schema.projects.id, projectId));

			return c.json({ success: true, organizationId: targetOrganizationId });
		}
	);
