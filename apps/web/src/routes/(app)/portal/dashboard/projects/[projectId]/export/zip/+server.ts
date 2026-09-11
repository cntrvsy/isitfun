import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = locals.session;
	if (!session || !locals.user) {
		throw error(401, 'Unauthorized');
	}

	const { projectId } = params;
	if (!projectId) {
		throw error(400, 'Missing projectId parameter');
	}

	const res = await locals.api.v1.projects[':id'].export.zip.$get({
		param: { id: projectId }
	});

	if (!res.ok) {
		const status = (res as any).status || 500;
		if (status === 404) throw error(404, 'Project not found');
		if (status === 403) throw error(403, 'Forbidden: You do not have access to this project');
		throw error(status, 'Failed to export project ZIP');
	}

	const zipArrayBuffer = await res.arrayBuffer();

	return new Response(zipArrayBuffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="playtests-${projectId}-${Date.now()}.zip"`
		}
	});
};
