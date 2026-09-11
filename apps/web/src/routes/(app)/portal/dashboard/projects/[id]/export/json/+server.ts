import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = locals.session;
	if (!session || !locals.user) {
		throw error(401, 'Unauthorized');
	}

	const projectId = params.id;
	if (!projectId) {
		throw error(400, 'Missing project ID');
	}

	const res = await locals.api.v1.projects[':id'].export.json.$get({
		param: { id: projectId }
	});

	if (!res.ok) {
		const status = (res as any).status || 500;
		if (status === 404) throw error(404, 'Project not found');
		if (status === 403) throw error(403, 'Forbidden: You do not have access to this project');
		throw error(status, 'Failed to export project JSON');
	}

	const jsonContent = await res.text();

	return new Response(jsonContent, {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="project_${projectId}_export.json"`
		}
	});
};
