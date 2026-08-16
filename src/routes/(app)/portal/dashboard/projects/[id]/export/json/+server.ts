import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects, organizationMemberships } from '#lib/server/db/db-schema.js';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const session = locals.session;
	if (!session || !locals.user) {
		throw error(401, 'Unauthorized');
	}

	const projectId = params.id;
	const db = locals.db;

	// Verify project existence
	const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	// Verify project access
	let hasAccess = project.userId === locals.user.id || projectId === 'demo';
	if (!hasAccess && project.organizationId) {
		const membership = await db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, project.organizationId),
					eq(organizationMemberships.userId, locals.user.id)
				)
			)
			.get();
		if (membership) {
			hasAccess = true;
		}
	}

	if (!hasAccess) {
		throw error(403, 'Forbidden: You do not have access to this project');
	}

	const bucket = platform?.env.GAMES_BUCKET;

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
		const listResult = await bucket.list({ prefix: `games/${projectId}/sessions/` });
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

	return new Response(JSON.stringify(compiledLogs, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="project_${projectId}_export.json"`
		}
	});
};
