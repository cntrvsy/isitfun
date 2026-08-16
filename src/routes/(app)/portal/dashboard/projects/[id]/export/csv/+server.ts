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

	// 1. Gather all unique keys from event payloads to build dynamic CSV columns
	const payloadKeysSet = new Set<string>();
	for (const log of compiledLogs) {
		const parsedPayload = log.parsedPayload;
		if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
			Object.keys(parsedPayload).forEach((key) => payloadKeysSet.add(key));
		}
	}

	const payloadKeys = Array.from(payloadKeysSet).sort();

	// 2. Build CSV headers (including full session metadata fields for zero vendor lock-in)
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

	// 3. Build data rows
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

	const csvContent = csvRows.join('\n');

	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="project_${projectId}_export.csv"`
		}
	});
};
