import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { customDeveloperLogs, projects, organizationMemberships } from '$lib/server/db/db-schema';

export const GET: RequestHandler = async ({ params, locals }) => {
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

	// Verify project ownership or organization membership
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

	// Fetch all logs
	const logs = await db
		.select()
		.from(customDeveloperLogs)
		.where(eq(customDeveloperLogs.projectId, projectId))
		.all();

	// 1. Gather all unique keys from payloads to build dynamic CSV columns
	const payloadKeysSet = new Set<string>();
	const parsedLogs = logs.map((log) => {
		let parsedPayload: Record<string, any> = {};
		try {
			parsedPayload = JSON.parse(log.payload);
		} catch (e) {
			// fallback
		}
		if (parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)) {
			Object.keys(parsedPayload).forEach((key) => payloadKeysSet.add(key));
		}
		return {
			...log,
			parsedPayload
		};
	});

	const payloadKeys = Array.from(payloadKeysSet).sort();

	// 2. Build CSV headers
	const headers = ['Log ID', 'Session ID', 'Event Name', 'Timestamp', ...payloadKeys];
	const csvRows = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

	// 3. Build data rows
	for (const log of parsedLogs) {
		const formattedDate = new Date(log.createdAt).toISOString();
		const row = [log.id.toString(), log.sessionId, log.eventName, formattedDate];

		for (const key of payloadKeys) {
			const val = (log.parsedPayload as Record<string, any>)[key];
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
					// only wrap values in double quotes if they aren't already wrapped (the loops above wrap complex values)
					if (idx >= 4) return field;
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
