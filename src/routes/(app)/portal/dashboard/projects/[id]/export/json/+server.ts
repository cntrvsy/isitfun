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

	const formattedLogs = logs.map((log) => ({
		id: log.id,
		sessionId: log.sessionId,
		eventName: log.eventName,
		payload: JSON.parse(log.payload),
		createdAt: log.createdAt
	}));

	return new Response(JSON.stringify(formattedLogs, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="project_${projectId}_export.json"`
		}
	});
};
