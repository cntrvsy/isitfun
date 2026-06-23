import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects } from '$lib/server/db/db-schema';
import { verifySession, signSession } from '$lib/server/crypto';

export const GET: RequestHandler = async ({ params, locals, platform, cookies }) => {
	const projectId = params.projectId;
	let filePath = params.file || 'index.html';

	// Normalize empty or trailing slash pathways to index.html
	if (filePath === '' || filePath.endsWith('/')) {
		filePath = filePath ? `${filePath}index.html` : 'index.html';
	}

	const isIndexHtml = filePath === 'index.html' || filePath.endsWith('/index.html');

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
			const object = await bucket.get(r2Key);

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

			return new Response(object.body, { headers });
		}
	}

	// FALLBACK/INITIAL PATH: Verify project in database
	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Playtest project not found');
	}

	// Perform authentication check if the playtest is password protected
	if (project.passwordProtected) {
		const authCookie = cookies.get(`play_auth_${projectId}`);
		if (authCookie !== project.passwordHash) {
			throw redirect(302, `/playgame?projectId=${projectId}`);
		}
	}

	// Fetch the asset from Cloudflare R2
	const bucket = platform?.env.GAMES_BUCKET;
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET R2 binding is missing');
	}

	const r2Key = `games/${projectId}/assets/${filePath}`;
	const object = await bucket.get(r2Key);

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

	const response = new Response(object.body, { headers });

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
			return new Response(injectedText, { headers });
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
		case 'pck':
			contentType = 'application/octet-stream';
			break;
	}
	return contentType;
}
