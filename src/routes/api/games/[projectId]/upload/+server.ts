import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects, projectQuotas, organizationMemberships } from '$lib/server/db/db-schema';

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

	// Verify project ownership or organization membership
	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	let hasAccess = project.userId === locals.user.id;
	if (!hasAccess && project.organizationId) {
		const membership = await locals.db
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

	const contentLength = Number(request.headers.get('content-length') || 0);

	if (project.tier === 'free') {
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

	// Get or initialize project quota
	let quota = await locals.db
		.select()
		.from(projectQuotas)
		.where(eq(projectQuotas.projectId, projectId))
		.get();

	if (!quota) {
		const newQuota = {
			id: crypto.randomUUID(),
			projectId,
			monthlyWriteCount: 0,
			maxWriteLimit: 100000,
			storageBytesUsed: 0,
			lastResetAt: new Date()
		};
		await locals.db.insert(projectQuotas).values(newQuota);
		quota = { ...newQuota };
	}

	// Subtract overwrite files to maintain precise tracking
	let existingSize = 0;
	try {
		const existingObject = await bucket.head(r2Key);
		if (existingObject) {
			existingSize = existingObject.size;
		}
	} catch {
		// Ignore not found errors from head request
	}

	const sizeDifference = contentLength - existingSize;
	const newStorageBytesUsed = quota.storageBytesUsed + sizeDifference;

	const maxStorageLimit = project.tier === 'free' ? 250 * 1024 * 1024 : 5000 * 1024 * 1024; // 250MB free, 5GB pro
	if (newStorageBytesUsed > maxStorageLimit) {
		throw error(
			413,
			`Upload would exceed project storage limit of ${maxStorageLimit / (1024 * 1024)} MB`
		);
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

		// Update database quota storage used
		await locals.db
			.update(projectQuotas)
			.set({ storageBytesUsed: newStorageBytesUsed })
			.where(eq(projectQuotas.projectId, projectId));

		return json({ success: true, key: r2Key });
	} catch (err) {
		console.error('Failed to upload file to R2:', err);
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `R2 upload failed: ${message}`);
	}
};
