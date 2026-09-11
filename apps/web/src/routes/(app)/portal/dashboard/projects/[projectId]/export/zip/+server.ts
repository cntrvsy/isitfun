import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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

	// 1. Verify project ownership and access via API
	const projectRes = await locals.api.v1.projects[':id'].$get({
		param: { id: projectId }
	});

	if (!projectRes.ok) {
		if (projectRes.status === 404) throw error(404, 'Project not found');
		if (projectRes.status === 403) throw error(403, 'Forbidden');
		throw error(projectRes.status, 'Failed to fetch project');
	}

	const { project } = await projectRes.json();

	const bucket = platform?.env.GAMES_BUCKET;
	const zipFiles: Record<string, Uint8Array> = {};

	if (bucket) {
		const prefix = `games/${projectId}/sessions/`;
		const objectList = await bucket.list({ prefix, limit: 50 });

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
