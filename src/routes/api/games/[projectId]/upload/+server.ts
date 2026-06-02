import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, request, locals, platform, url }) => {
	const session = locals.session;
	if (!session || !locals.user) {
		throw error(401, 'Unauthorized');
	}

	const projectId = params.projectId;
	const filePath = url.searchParams.get('path');
	if (!filePath) {
		throw error(400, 'Missing path parameter');
	}

	// Verify project ownership
	const project = await locals.db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, locals.user.id)))
		.get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	if (project.tier === 'free') {
		const contentLength = Number(request.headers.get('content-length') || 0);
		if (contentLength > 40 * 1024 * 1024) {
			throw error(413, 'File size exceeds 40 MB free limit');
		}
	}

	// Upload to R2 GAMES_BUCKET
	const bucket = platform?.env.GAMES_BUCKET;
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET binding is missing');
	}

	const r2Key = `games/${projectId}/assets/${filePath}`;
	const body = request.body;
	if (!body) {
		throw error(400, 'Empty file body');
	}

	// Determine content-type based on file extension
	let contentType = 'application/octet-stream';
	const ext = filePath.split('.').pop()?.toLowerCase();
	
	switch (ext) {
		case 'html':
		case 'htm':
			contentType = 'text/html';
			break;
		case 'css':
			contentType = 'text/css';
			break;
		case 'js':
		case 'mjs':
			contentType = 'application/javascript';
			break;
		case 'wasm':
			contentType = 'application/wasm';
			break;
		case 'json':
			contentType = 'application/json';
			break;
		case 'png':
			contentType = 'image/png';
			break;
		case 'jpg':
		case 'jpeg':
			contentType = 'image/jpeg';
			break;
		case 'svg':
			contentType = 'image/svg+xml';
			break;
		case 'pck':
			contentType = 'application/octet-stream';
			break;
	}

	try {
		await bucket.put(r2Key, body, {
			httpMetadata: {
				contentType
			}
		});
		return json({ success: true, key: r2Key });
	} catch (err) {
		console.error('Failed to upload file to R2:', err);
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `R2 upload failed: ${message}`);
	}
};
