import type { R2ObjectBody } from '@cloudflare/workers-types';

export function guessContentEncoding(filePath: string): string | null {
	const lower = filePath.toLowerCase();
	if (lower.endsWith('.gz')) return 'gzip';
	if (lower.endsWith('.br')) return 'br';
	return null;
}

export function guessContentType(filePath: string): string {
	const lower = filePath.toLowerCase();
	if (lower.endsWith('.wasm.gz') || lower.endsWith('.wasm.br')) return 'application/wasm';
	if (lower.endsWith('.js.gz') || lower.endsWith('.js.br')) return 'application/javascript';
	if (lower.endsWith('.data.gz') || lower.endsWith('.data.br')) return 'application/octet-stream';

	const cleanPath =
		lower.endsWith('.gz') || lower.endsWith('.br') ? lower.slice(0, lower.lastIndexOf('.')) : lower;

	const ext = cleanPath.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'html':
		case 'htm':
			return 'text/html';
		case 'css':
			return 'text/css';
		case 'js':
		case 'mjs':
			return 'application/javascript';
		case 'wasm':
			return 'application/wasm';
		case 'json':
			return 'application/json';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'svg':
			return 'image/svg+xml';
		case 'mp3':
			return 'audio/mpeg';
		case 'ogg':
			return 'audio/ogg';
		case 'wav':
			return 'audio/wav';
		case 'webm':
			return 'video/webm';
		case 'mp4':
			return 'video/mp4';
		case 'gltf':
			return 'model/gltf+json';
		case 'glb':
			return 'model/gltf-binary';
		case 'data':
		case 'bin':
		case 'pck':
		default:
			return 'application/octet-stream';
	}
}

export function createR2Response(
	object: R2ObjectBody,
	filePath: string,
	rangeHeader?: string | null,
	ifNoneMatchHeader?: string | null,
	customHeaders?: Record<string, string>
): Response {
	const headers = new Headers();

	if (object.httpMetadata?.contentType) {
		headers.set('Content-Type', object.httpMetadata.contentType);
	} else {
		headers.set('Content-Type', guessContentType(filePath));
	}

	const encoding = object.httpMetadata?.contentEncoding || guessContentEncoding(filePath);
	if (encoding) {
		headers.set('Content-Encoding', encoding);
	}

	if (object.httpEtag) {
		headers.set('ETag', object.httpEtag);
		if (ifNoneMatchHeader && ifNoneMatchHeader.trim() === object.httpEtag.trim()) {
			return new Response(null, { status: 304, headers });
		}
	}

	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Cache-Control', 'private, max-age=3600, must-revalidate');

	if (customHeaders) {
		for (const [key, value] of Object.entries(customHeaders)) {
			headers.set(key, value);
		}
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

	return new Response(object.body as unknown as BodyInit, { status, headers });
}
