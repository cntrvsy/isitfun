import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals, platform, cookies }) => {
	const projectId = params.projectId;
	let filePath = params.file || 'index.html';

	// Normalize empty or trailing slash pathways to index.html
	if (filePath === '' || filePath.endsWith('/')) {
		filePath = filePath ? `${filePath}index.html` : 'index.html';
	}

	// 1. Fetch project to verify existence and check security protection
	const project = await locals.db
		.select()
		.from(projects)
		.where(eq(projects.id, projectId))
		.get();

	if (!project) {
		throw error(404, 'Playtest project not found');
	}

	// 2. Perform authentication check if the playtest is password protected
	if (project.passwordProtected) {
		const authCookie = cookies.get(`play_auth_${projectId}`);
		if (authCookie !== project.passwordHash) {
			// Redirect to our customized password entry portal
			throw redirect(302, `/playgame?projectId=${projectId}`);
		}
	}

	// 3. Fetch the asset from Cloudflare R2
	const bucket = platform?.env.GAMES_BUCKET;
	if (!bucket) {
		throw error(500, 'GAMES_BUCKET R2 binding is missing');
	}

	const r2Key = `games/${projectId}/assets/${filePath}`;
	const object = await bucket.get(r2Key);

	if (!object) {
		throw error(404, `Game asset not found: ${filePath}`);
	}

	// 4. Construct response and apply COOP/COEP headers
	const headers = new Headers();
	
	// Apply Content-Type from R2 metadata or evaluate based on extension
	if (object.httpMetadata?.contentType) {
		headers.set('Content-Type', object.httpMetadata.contentType);
	} else {
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
		}
		headers.set('Content-Type', contentType);
	}

	// Required headers for Godot 4 SharedArrayBuffer multithreading support
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

	// Set caching controls - Cache static assets, but do not cache index.html
	if (filePath !== 'index.html' && !filePath.endsWith('/index.html')) {
		headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	} else {
		headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	}

	const response = new Response(object.body, { headers });

	// 5. Ingest tracking widget into index.html using Cloudflare's HTMLRewriter
	if (filePath === 'index.html' || filePath.endsWith('/index.html')) {
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
			// Polyfill fallback for local non-edge testing environments
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
