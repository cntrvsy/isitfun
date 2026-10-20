import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { createD1Client, schema } from '@isitfun/db';
import { validateAccessKey } from '@isitfun/shared';
import type { AppEnv } from '../../types';
import { createR2Response } from '../../lib/r2';
import { signSession, verifySession } from '../../lib/crypto';
import { getDemoPingPongHtml } from '../../lib/demo-game';

export const playRouter = new Hono<AppEnv>();

const sessionCookieName = (id: string) => `play_session_${id}`;
const keyCookieName = (id: string) => `play_key_${id}`;

function parseRange(header: string | undefined): { offset: number; length?: number } | undefined {
	if (!header || !header.startsWith('bytes=')) return undefined;
	const parts = header.replace('bytes=', '').split('-');
	const start = parseInt(parts[0], 10);
	if (isNaN(start)) return undefined;
	const end = parts[1] ? parseInt(parts[1], 10) : undefined;
	const length = end !== undefined ? end - start + 1 : undefined;
	return { offset: start, length };
}

export function injectPlayOverlay(
	htmlText: string,
	projectId: string,
	sessionToken?: string,
	tier: string = 'free'
): string {
	let injected = htmlText;

	if (/<head[\s>]/i.test(injected)) {
		injected = injected.replace(/(<head[^>]*>)/i, `$1<base href="/play/${projectId}/">`);
	} else {
		injected = `<base href="/play/${projectId}/">` + injected;
	}

	const tokenAttr = sessionToken ? ` data-session-token="${sessionToken}"` : '';
	const widgetScript = `<script src="/assets/overlay-widget.js" data-project="${projectId}"${tokenAttr} data-tier="${tier}"></script>`;

	if (/<\/body>/i.test(injected)) {
		injected = injected.replace(/(<\/body>)/i, `${widgetScript}$1`);
	} else {
		injected += widgetScript;
	}

	return injected;
}

// Built-in Demo Route
playRouter.get('/demo', async (c) => {
	const htmlText = getDemoPingPongHtml('demo');
	const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test';
	const secret = c.env.BETTER_AUTH_SECRET || (isDev ? 'dev-secret' : '');
	if (!secret) {
		return c.json({ error: 'Server misconfiguration: missing BETTER_AUTH_SECRET' }, 500);
	}
	const sessionToken = await signSession('demo', secret);

	const injectedText = injectPlayOverlay(htmlText, 'demo', sessionToken, 'free');

	const res = c.html(injectedText);
	res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	res.headers.set(
		'Set-Cookie',
		`${sessionCookieName('demo')}=${sessionToken}; Path=/play/demo; Max-Age=86400; SameSite=Lax; HttpOnly; Secure`
	);
	return res;
});

// Wildcard play game routes: /play/:projectId or /play/:projectId/*
playRouter.get('/:projectId/:file{.*}?', async (c) => {
	const projectId = c.req.param('projectId');
	const rawFile = c.req.param('file') || '';
	let filePath = rawFile;

	// Normalize empty or trailing slash pathways to index.html
	if (filePath === '' || filePath.endsWith('/')) {
		filePath = filePath ? `${filePath}index.html` : 'index.html';
	}

	// 1. Trailing slash redirect for base game route: /play/:projectId -> /play/:projectId/
	const rawUrl = new URL(c.req.url);
	if (!rawFile && !rawUrl.pathname.endsWith('/')) {
		return c.redirect(`/play/${projectId}/${rawUrl.search}`);
	}

	// Handle built-in interactive demo
	if (projectId === 'demo' || projectId.startsWith('demo_')) {
		if (filePath === 'index.html') {
			const htmlText = getDemoPingPongHtml(projectId);
			const secret = c.env.BETTER_AUTH_SECRET || 'dev-secret';
			const sessionToken = await signSession(projectId, secret);

			let injectedText = htmlText;
			if (injectedText.includes('<head>')) {
				injectedText = injectedText.replace('<head>', `<head><base href="/play/${projectId}/">`);
			}
			injectedText = injectedText.replace(
				'</body>',
				`<script src="/assets/overlay-widget.js" data-project="${projectId}" data-session-token="${sessionToken}" data-tier="free"></script></body>`
			);

			const res = c.html(injectedText);
			res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
			res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
			res.headers.set(
				'Set-Cookie',
				`${sessionCookieName(projectId)}=${sessionToken}; Path=/play/${projectId}; Max-Age=86400; SameSite=Lax; HttpOnly; Secure`
			);
			return res;
		}
	}

	const isIndexHtml = filePath === 'index.html' || filePath.endsWith('/index.html');
	const rangeHeader = c.req.header('range');
	const ifNoneMatch = c.req.header('if-none-match');
	const cookieHeader = c.req.header('cookie') || '';

	// Parse cookies
	const cookies: Record<string, string> = {};
	cookieHeader.split(';').forEach((pair) => {
		const [k, v] = pair.trim().split('=');
		if (k && v) cookies[k] = decodeURIComponent(v);
	});

	const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test';
	const secret = c.env.BETTER_AUTH_SECRET || (isDev ? 'dev-secret' : '');
	if (!secret) {
		return c.json({ error: 'Server misconfiguration: missing BETTER_AUTH_SECRET' }, 500);
	}
	const db = createD1Client(c.env.DB);

	// Find active build for versioned asset serving
	const activeBuild = await db
		.select()
		.from(schema.gameBuilds)
		.where(and(eq(schema.gameBuilds.projectId, projectId), eq(schema.gameBuilds.isActive, true)))
		.get();

	const buildPrefix = activeBuild
		? `games/${projectId}/builds/${activeBuild.id}`
		: `games/${projectId}/assets`;

	if (!isIndexHtml) {
		const sessionCookie = cookies[sessionCookieName(projectId)];
		if (sessionCookie && (await verifySession(sessionCookie, projectId, secret))) {
			const bucket = c.env.GAMES_BUCKET;
			if (!bucket) {
				return c.json({ error: 'GAMES_BUCKET binding missing' }, 500);
			}

			const r2Key = `${buildPrefix}/${filePath}`;
			const parsedRange = parseRange(rangeHeader);
			const object = parsedRange
				? await bucket.get(r2Key, { range: parsedRange })
				: await bucket.get(r2Key);

			if (!object) {
				// Fallback to legacy unversioned path if active build doesn't have it
				const fallbackKey = `games/${projectId}/assets/${filePath}`;
				const fallbackObject = parsedRange
					? await bucket.get(fallbackKey, { range: parsedRange })
					: await bucket.get(fallbackKey);

				if (!fallbackObject) return c.notFound();
				return createR2Response(fallbackObject, filePath, rangeHeader, ifNoneMatch);
			}

			return createR2Response(object, filePath, rangeHeader, ifNoneMatch);
		}
	}

	// For index.html or unverified sessions, perform database checks
	const project = await db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	if (!project) {
		return c.notFound();
	}

	const keyParam = c.req.query('key');
	const keyCookie = cookies[keyCookieName(projectId)];
	const targetCode = keyParam || keyCookie;

	const keys = await db
		.select()
		.from(schema.projectAccessKeys)
		.where(
			and(
				eq(schema.projectAccessKeys.projectId, projectId),
				eq(schema.projectAccessKeys.isActive, true)
			)
		)
		.all();

	let setKeyCookieHeader: string | null = null;

	// Reload resilience: If player already has a valid session token, allow reload without re-checking maxUses
	const activeSessionCookie = cookies[sessionCookieName(projectId)];
	const hasVerifiedSession =
		activeSessionCookie && (await verifySession(activeSessionCookie, projectId, secret));

	if (!hasVerifiedSession) {
		if (keys.length > 0) {
			const matchingKey = keys.find(
				(k) => k.code.toUpperCase() === (targetCode || '').toUpperCase()
			);
			const validation = validateAccessKey(matchingKey);

			if (!validation.valid) {
				return c.redirect(
					`/playgame?projectId=${projectId}&error=${validation.reason || 'invalid_key'}`
				);
			}

			if (keyParam && matchingKey && keyCookie !== matchingKey.code) {
				await db
					.update(schema.projectAccessKeys)
					.set({ usedCount: sql`${schema.projectAccessKeys.usedCount} + 1` })
					.where(eq(schema.projectAccessKeys.id, matchingKey.id));

				setKeyCookieHeader = `${keyCookieName(projectId)}=${matchingKey.code}; Path=/play/${projectId}; Max-Age=86400; SameSite=Lax; HttpOnly; Secure`;
			}
		} else {
			// Project has no active keys; it is private/unplayable
			return c.redirect(`/playgame?projectId=${projectId}&error=not_found`);
		}
	}

	// Fetch asset from Cloudflare R2
	const bucket = c.env.GAMES_BUCKET;
	if (!bucket) {
		return c.json({ error: 'GAMES_BUCKET binding missing' }, 500);
	}

	let r2Key = `${buildPrefix}/${filePath}`;
	const parsedRange = parseRange(rangeHeader);
	let object = parsedRange
		? await bucket.get(r2Key, { range: parsedRange })
		: await bucket.get(r2Key);

	if (!object) {
		// Fallback to legacy unversioned path
		r2Key = `games/${projectId}/assets/${filePath}`;
		object = parsedRange
			? await bucket.get(r2Key, { range: parsedRange })
			: await bucket.get(r2Key);

		if (!object) {
			return c.notFound();
		}
	}

	if (isIndexHtml) {
		const sessionToken = await signSession(projectId, secret);
		const htmlText = await object.text();
		const tier = project.tier || 'free';

		const injectedText = injectPlayOverlay(htmlText, projectId, sessionToken, tier);

		const res = c.html(injectedText);
		res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
		res.headers.append(
			'Set-Cookie',
			`${sessionCookieName(projectId)}=${sessionToken}; Path=/play/${projectId}; Max-Age=86400; SameSite=Lax; HttpOnly; Secure`
		);
		if (setKeyCookieHeader) {
			res.headers.append('Set-Cookie', setKeyCookieHeader);
		}
		return res;
	}

	return createR2Response(object, filePath, rangeHeader, ifNoneMatch);
});
