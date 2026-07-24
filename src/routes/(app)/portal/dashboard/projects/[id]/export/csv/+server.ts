import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects, organizationMemberships } from '$lib/server/db/db-schema';

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
	let hasAccess = project.userId === locals.user.id;
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
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET R2 binding is missing');
	}

	// List session files in R2
	const listResult = await bucket.list({ prefix: `games/${projectId}/sessions/` });
	const compiledLogs: {
		sessionId: string;
		eventName: string;
		parsedPayload: Record<string, unknown>;
		createdAt: string | number;
	}[] = [];

	for (const obj of listResult.objects) {
		const sessionObj = await bucket.get(obj.key);
		if (sessionObj) {
			try {
				const data = (await sessionObj.json()) as {
					sessionId: string;
					createdAt: string | number;
					logs: Array<{ event: string; data: Record<string, unknown>; timestamp?: number }>;
				};
				if (data && Array.isArray(data.logs)) {
					for (const log of data.logs) {
						compiledLogs.push({
							sessionId: data.sessionId,
							eventName: log.event,
							parsedPayload: log.data || {},
							createdAt: log.timestamp || data.createdAt
						});
					}
				}
			} catch {
				// Skip corrupt files
			}
		}
	}

	// 1. Gather all unique keys from payloads to build dynamic CSV columns
	const payloadKeysSet = new Set<string>();
	for (const log of compiledLogs) {
		const parsedPayload = log.parsedPayload;
		if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
			Object.keys(parsedPayload).forEach((key) => payloadKeysSet.add(key));
		}
	}

	const payloadKeys = Array.from(payloadKeysSet).sort();

	// 2. Build CSV headers
	const headers = ['Session ID', 'Event Name', 'Timestamp', ...payloadKeys];
	const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

	// 3. Build data rows
	for (const log of compiledLogs) {
		const formattedDate = new Date(log.createdAt).toISOString();
		const row = [log.sessionId, log.eventName, formattedDate];

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
					if (idx >= 3) return field;
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
