import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { telemetrySessions, projects, organizationMemberships } from '$lib/server/db/db-schema';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const session = locals.session;
	if (!session || !locals.user) {
		throw error(401, 'Unauthorized');
	}

	const sessionId = params.sessionId;
	const db = locals.db;

	// Fetch telemetry session to find projectId
	const telemetrySession = await db
		.select()
		.from(telemetrySessions)
		.where(eq(telemetrySessions.id, sessionId))
		.get();
	if (!telemetrySession) {
		throw error(404, 'Session not found');
	}

	const projectId = telemetrySession.projectId;

	// Verify project access
	const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) {
		throw error(404, 'Project not found');
	}

	let hasAccess = locals.user.role === 'admin' || project.userId === locals.user.id || projectId === 'demo';
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
		throw error(403, 'Forbidden: Access denied');
	}

	const bucket = platform?.env.GAMES_BUCKET;
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET binding is missing');
	}

	const r2Key = `games/${projectId}/sessions/${sessionId}.json`;
	const fileObj = await bucket.get(r2Key);
	if (!fileObj) {
		throw error(404, 'Telemetry logs file not found in storage');
	}

	const sessionData = await fileObj.json();
	return json(sessionData);
};
