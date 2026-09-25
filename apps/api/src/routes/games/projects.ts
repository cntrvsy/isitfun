import { Hono } from 'hono';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import * as v from 'valibot';
import { createD1Client, schema } from '@isitfun/db';
import {
	CreateProjectSchema,
	UpdateProjectSchema,
	CreateAccessKeySchema,
	TierLimits,
	validateAccessKey
} from '@isitfun/shared';
import type { AppEnv } from '../../types';
import type { ReadableStream as CFReadableStream } from '@cloudflare/workers-types';
import { sessionMiddleware, requireAuth } from '../../middleware/auth';
import { hashPassword } from '../../lib/crypto';
import { guessContentType } from '../../lib/r2';
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

	const matchingKey = keys.find(
		(k) => k.code.toUpperCase() === passwordInput.toUpperCase()
	);

	if (matchingKey) {
		const validation = validateAccessKey(matchingKey);
		if (!validation.valid) {
			return c.json({ valid: false, reason: validation.reason }, 400);
		}
		return c.json({ valid: true, isKey: true, key: matchingKey.code });
	}

	// Fallback to static password
	if (project.passwordProtected && project.passwordHash) {
		const hashed = await hashPassword(passwordInput, projectId);
		if (hashed === project.passwordHash) {
			return c.json({ valid: true, isStatic: true, hash: project.passwordHash });
		}
	}

	return c.json({ valid: false, reason: 'incorrect_password' }, 400);
	})
	// GET /v1/projects/:id/public - Public metadata for playtesters & launch screen
	.get('/:id/public', async (c) => {
	const projectId = c.req.param('id');
	const db = createD1Client(c.env.DB);

	const project = await db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			passwordProtected: schema.projects.passwordProtected,
			passwordHash: schema.projects.passwordHash
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
		passwordProtected: project.passwordProtected,
		passwordHash: project.passwordHash,
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

	const { project } = await requireProjectAccess(db, projectId, user, 'editor');

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
	})
	// DELETE /v1/projects/:id - Delete project
	.delete('/:id', async (c) => {
	const user = c.get('user')!;
	const projectId = c.req.param('id');
	const db = createD1Client(c.env.DB);

	const { project } = await requireProjectAccess(db, projectId, user, 'admin');

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

	const { project } = await requireProjectAccess(db, projectId, user, 'editor');

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
	})
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
	// POST /v1/projects/:id/upload - Stream game asset file directly to R2
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

	const { project } = await requireProjectAccess(db, projectId, user, 'editor');

	const contentLengthHeader = c.req.header('content-length');
	if (!contentLengthHeader || isNaN(Number(contentLengthHeader))) {
		return c.json({ error: 'Length Required: Content-Length header is missing or invalid' }, 411);
	}

	const contentLength = Number(contentLengthHeader);
	if (contentLength <= 0) {
		return c.json({ error: 'Invalid file content length' }, 400);
	}

	if (contentLength > 100 * 1024 * 1024) {
		return c.json({ error: 'File size exceeds maximum 100 MB limit' }, 413);
	}

	if (project.tier === 'free' && contentLength > 40 * 1024 * 1024) {
		return c.json({ error: 'File size exceeds 40 MB free limit' }, 413);
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
			maxWriteLimit: 100000,
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
		// Object does not exist yet or head failed; default existingSize to 0
	}

	const sizeDifference = contentLength - existingSize;
	const newStorageBytesUsed = quota.storageBytesUsed + sizeDifference;

	const maxStorageLimit = project.tier === 'free' ? 250 * 1024 * 1024 : 5000 * 1024 * 1024;
	if (newStorageBytesUsed > maxStorageLimit) {
		return c.json(
			{ error: `Upload would exceed project storage limit of ${maxStorageLimit / (1024 * 1024)} MB` },
			413
		);
	}

	const contentType = guessContentType(filePath);

	try {
		await bucket.put(r2Key, body as unknown as CFReadableStream, {
			httpMetadata: { contentType }
		});

		await db
			.update(schema.projectQuotas)
			.set({ storageBytesUsed: newStorageBytesUsed })
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

	const { project } = await requireProjectAccess(db, projectId, user, 'viewer');

	const bucket = c.env.GAMES_BUCKET;
	const r2Key = `games/${projectId}/sessions/${sessionId}.json`;

	if (!bucket) {
		return c.json({
			projectId,
			sessionId,
			createdAt: new Date().toISOString(),
			logs: [{ event: 'console.log', data: { message: 'Dev mock session preview' }, timestamp: Date.now() }],
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

	const { project } = await requireProjectAccess(db, projectId, user, 'editor');

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

		const { project } = await requireProjectAccess(db, projectId, user, 'viewer');

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

		const { project } = await requireProjectAccess(db, projectId, user, 'viewer');

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
