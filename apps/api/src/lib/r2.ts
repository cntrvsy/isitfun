import type { R2Object, R2ObjectBody } from '@cloudflare/workers-types';

export function guessContentType(filePath: string): string {
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

export function createR2Response(
	object: R2ObjectBody,
	filePath: string,
	rangeHeader?: string | null,
	customHeaders?: Record<string, string>
): Response {
	const headers = new Headers();

	if (object.httpMetadata?.contentType) {
		headers.set('Content-Type', object.httpMetadata.contentType);
	} else {
		headers.set('Content-Type', guessContentType(filePath));
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
