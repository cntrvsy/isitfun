import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects, organizationMemberships } from '$lib/server/db/db-schema';
import { zipSync, strToU8 } from 'fflate';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}

	const { projectId } = params;
	if (!projectId) {
		throw error(400, 'Missing projectId parameter');
	}

	// 1. Verify project ownership or organization membership
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
		throw error(403, 'Forbidden');
	}

	const bucket = platform?.env.GAMES_BUCKET;
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

	// Add README summary file to zip archive
	const readmeContent = `IsItFun Playtest Data Export
Project: ${project.name} (ID: ${projectId})
Exported At: ${new Date().toISOString()}

This archive contains all raw JSON playtest session logs collected from your HTML5 game builds.
`;
	zipFiles['README.txt'] = strToU8(readmeContent);

	const zipUint8Array = zipSync(zipFiles);

	return new Response(zipUint8Array, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="playtests-${projectId}-${Date.now()}.zip"`
		}
	});
};
