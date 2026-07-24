import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects, organizationMemberships, telemetrySessions } from '$lib/server/db/db-schema';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { projectId, sessionId } = params;
	if (!projectId || !sessionId) {
		throw error(400, 'Missing parameters');
	}

	// 1. Verify project ownership or team organization membership
	const project = await locals.db
		.select()
		.from(projects)
		.where(eq(projects.id, projectId))
		.get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	let hasAccess = project.userId === user.id;

	if (!hasAccess && project.organizationId) {
		const membership = await locals.db
			.select()
			.from(organizationMemberships)
			.where(
				eq(organizationMemberships.organizationId, project.organizationId)
			)
			.get();

		if (membership && membership.userId === user.id) {
			hasAccess = true;
		}
	}

	if (!hasAccess) {
		throw error(403, 'Forbidden: You do not have access to this project');
	}

	// 2. Fetch raw session JSON from R2 bucket
	const bucket = platform?.env.GAMES_BUCKET;
	const r2Key = `games/${projectId}/sessions/${sessionId}.json`;

	if (!bucket) {
		// Fallback for mock/dev environment when R2 binding isn't active
		return json({
			projectId,
			sessionId,
			createdAt: new Date().toISOString(),
			logs: [
				{ event: 'console.log', data: { message: '[IsItFun] Dev session mock active' }, timestamp: Date.now() - 5000 },
				{ event: 'console.warn', data: { message: 'R2 bucket binding mock response' }, timestamp: Date.now() - 2000 }
			],
			logCount: 2,
			hasCrashed: false,
			avgFps: 60,
			gpuRenderer: 'WebGL Mock Renderer',
			sentiment: 'fun',
			userComment: 'Dev mock session preview'
		});
	}

	const object = await bucket.get(r2Key);
	if (!object) {
		throw error(404, 'Session details log file not found in storage');
	}

	const rawJson = await object.text();
	try {
		const sessionDetails = JSON.parse(rawJson);
		return json(sessionDetails);
	} catch {
		throw error(500, 'Failed to parse stored session JSON');
	}
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { projectId, sessionId } = params;
	if (!projectId || !sessionId) {
		throw error(400, 'Missing parameters');
	}

	// Verify project ownership or team organization membership
	const project = await locals.db
		.select()
		.from(projects)
		.where(eq(projects.id, projectId))
		.get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	let hasAccess = project.userId === user.id;

	if (!hasAccess && project.organizationId) {
		const membership = await locals.db
			.select()
			.from(organizationMemberships)
			.where(eq(organizationMemberships.organizationId, project.organizationId))
			.get();

		if (membership && membership.userId === user.id) {
			hasAccess = true;
		}
	}

	if (!hasAccess) {
		throw error(403, 'Forbidden: You do not have access to this project');
	}

	// 1. Delete R2 log file if bucket binding is available
	const bucket = platform?.env.GAMES_BUCKET;
	if (bucket) {
		const r2Key = `games/${projectId}/sessions/${sessionId}.json`;
		try {
			await bucket.delete(r2Key);
		} catch (err) {
			console.error(`Failed to delete R2 session log ${r2Key}:`, err);
		}
	}

	// 2. Delete session record in D1 database
	await locals.db
		.delete(telemetrySessions)
		.where(and(eq(telemetrySessions.id, sessionId), eq(telemetrySessions.projectId, projectId)));

	return json({ success: true });
};

