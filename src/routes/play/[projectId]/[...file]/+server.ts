import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, sql } from 'drizzle-orm';
import { projects, projectAccessKeys } from '$lib/server/db/db-schema';
import { validateAccessKey } from '$lib/server/db/access-keys';
import { verifySession, signSession } from '$lib/server/crypto';
import { getDemoPingPongHtml } from '$lib/server/demo-game';

export const GET: RequestHandler = async ({ params, request, locals, platform, cookies, url }) => {
	const projectId = params.projectId;
	let filePath = params.file || 'index.html';

	// Handle built-in interactive demo game route (zero R2/DB setup needed)
	if (projectId === 'demo' || projectId.startsWith('demo_')) {
		const htmlText = getDemoPingPongHtml(projectId);
		const headers = new Headers();
		headers.set('Content-Type', 'text/html');
		headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

		const sessionToken = await signSession(projectId);
		cookies.set(`play_session_${projectId}`, sessionToken, {
			path: `/play/${projectId}`,
			maxAge: 60 * 60 * 24,
			sameSite: 'lax',
			httpOnly: true,
			secure: true
		});

		const injectedText = htmlText.replace(
			'</body>',
			`<script src="/assets/overlay-widget.js" data-project="${projectId}" data-tier="free"></script></body>`
		);
		return new Response(injectedText, { headers });
	}


	// Normalize empty or trailing slash pathways to index.html
	if (filePath === '' || filePath.endsWith('/')) {
		filePath = filePath ? `${filePath}index.html` : 'index.html';
	}

	const isIndexHtml = filePath === 'index.html' || filePath.endsWith('/index.html');
	const rangeHeader = request.headers.get('range');

	if (!isIndexHtml) {
		// Try to verify session cryptographically first
		const sessionCookie = cookies.get(`play_session_${projectId}`);
		if (sessionCookie && (await verifySession(sessionCookie, projectId))) {
			// Cryptographic check passed! Serve from R2 directly without database queries.
			const bucket = platform?.env.GAMES_BUCKET;
			if (!bucket) {
				throw error(500, 'GAMES_BUCKET R2 binding is missing');
			}

			const r2Key = `games/${projectId}/assets/${filePath}`;
			const object = rangeHeader
				? await bucket.get(r2Key, { range: request.headers })
				: await bucket.get(r2Key);

			if (!object) {
				throw error(404, `Game asset not found: ${filePath}`);
			}


			const headers = new Headers();
			if (object.httpMetadata?.contentType) {
				headers.set('Content-Type', object.httpMetadata.contentType);
			} else {
				headers.set('Content-Type', guessContentType(filePath));
			}

			// Required headers for Godot 4 SharedArrayBuffer multithreading support
			headers.set('Cross-Origin-Opener-Policy', 'same-origin');
			headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
			headers.set('Cache-Control', 'private, max-age=3600, must-revalidate');
			headers.set('Accept-Ranges', 'bytes');

			let status = 200;
			if (rangeHeader && object.range) {
				status = 206;
				const rangeObj = object.range as { offset?: number; length?: number };
				const offset = rangeObj.offset ?? 0;
				const length = rangeObj.length ?? object.size;
				const end = offset + length - 1;
				headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
				headers.set('Content-Length', String(length));
			}


			return new Response(object.body, { status, headers });
		}
	}

	// FALLBACK/INITIAL PATH: Verify project in database
	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Playtest project not found');
	}

	// Perform authentication check if the playtest requires access keys or password
	const keyParam = url.searchParams.get('key');
	const keyCookie = cookies.get(`play_key_${projectId}`);
	const legacyCookie = cookies.get(`play_auth_${projectId}`);

	// Check if any keys exist for this project
	const keys = await locals.db
		.select()
		.from(projectAccessKeys)
		.where(and(eq(projectAccessKeys.projectId, projectId), eq(projectAccessKeys.isActive, true)))
		.all();

	if (keys.length > 0) {
		const targetCode = keyParam || keyCookie;
		const matchingKey = keys.find((k) => k.code.toUpperCase() === (targetCode || '').toUpperCase());

		const validation = validateAccessKey(matchingKey);
		if (!validation.valid) {
			throw redirect(
				302,
				`/playgame?projectId=${projectId}&error=${validation.reason || 'invalid_key'}`
			);
		}

		// Increment usedCount only if starting a fresh session with keyParam (when cookie is not yet set)
		if (keyParam && matchingKey && keyCookie !== matchingKey.code) {
			await locals.db
				.update(projectAccessKeys)
				.set({ usedCount: sql`${projectAccessKeys.usedCount} + 1` })
				.where(eq(projectAccessKeys.id, matchingKey.id));

			cookies.set(`play_key_${projectId}`, matchingKey.code, {
				path: `/play/${projectId}`,
				maxAge: 60 * 60 * 24,
				sameSite: 'lax',
				httpOnly: true,
				secure: true
			});
		}
	} else if (project.passwordProtected) {
		if (legacyCookie !== project.passwordHash) {
			throw redirect(302, `/playgame?projectId=${projectId}`);
		}
	}

	// Fetch the asset from Cloudflare R2
	const bucket = platform?.env.GAMES_BUCKET;
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET R2 binding is missing');
	}

	const r2Key = `games/${projectId}/assets/${filePath}`;
	const object = rangeHeader
		? await bucket.get(r2Key, { range: request.headers })
		: await bucket.get(r2Key);

	if (!object) {
		throw error(404, `Game asset not found: ${filePath}`);
	}


	// Construct response and apply COOP/COEP headers
	const headers = new Headers();

	if (object.httpMetadata?.contentType) {
		headers.set('Content-Type', object.httpMetadata.contentType);
	} else {
		headers.set('Content-Type', guessContentType(filePath));
	}

	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	headers.set('Accept-Ranges', 'bytes');

	if (!isIndexHtml) {
		headers.set('Cache-Control', 'private, max-age=3600, must-revalidate');
	} else {
		headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

		// Sign the session and set it as an HTTP-only cookie scoped to this play path
		const sessionToken = await signSession(projectId);
		cookies.set(`play_session_${projectId}`, sessionToken, {
			path: `/play/${projectId}`,
			maxAge: 60 * 60 * 24, // 24 hours
			sameSite: 'lax',
			httpOnly: true,
			secure: true
		});
	}

	let status = 200;
	if (rangeHeader && object.range) {
		status = 206;
		const rangeObj = object.range as { offset?: number; length?: number };
		const offset = rangeObj.offset ?? 0;
		const length = rangeObj.length ?? object.size;
		const end = offset + length - 1;
		headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
		headers.set('Content-Length', String(length));
	}


	const response = new Response(object.body, { status, headers });

	// Ingest tracking widget into index.html using HTMLRewriter or fallback polyfill
	if (isIndexHtml) {
		if (typeof HTMLRewriter !== 'undefined') {
			return new HTMLRewriter()
				.on('body', {
					element(el) {
						el.append(
							`<script src="/assets/overlay-widget.js" data-project="${projectId}" data-tier="${project.tier}"></script>`,
							{ html: true }
						);
					}
				})
				.transform(response);
		} else {
			const htmlText = await response.text();
			const injectedText = htmlText.replace(
				'</body>',
				`<script src="/assets/overlay-widget.js" data-project="${projectId}" data-tier="${project.tier}"></script></body>`
			);
			return new Response(injectedText, { status, headers });
		}
	}

	return response;
};

function guessContentType(filePath: string): string {
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
		case 'mp3':
			contentType = 'audio/mpeg';
			break;
		case 'ogg':
			contentType = 'audio/ogg';
			break;
		case 'wav':
			contentType = 'audio/wav';
			break;
		case 'webm':
			contentType = 'video/webm';
			break;
		case 'mp4':
			contentType = 'video/mp4';
			break;
		case 'gltf':
			contentType = 'model/gltf+json';
			break;
		case 'glb':
			contentType = 'model/gltf-binary';
			break;
		case 'data':
		case 'bin':
		case 'pck':
			contentType = 'application/octet-stream';
			break;
	}
	return contentType;
}

