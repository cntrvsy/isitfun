// Native Web Crypto API utilities for hashing, signature verification, and session signing

export async function hashPassword(password: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);
	const saltBuffer = encoder.encode(salt);

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		passwordBuffer,
		{ name: 'PBKDF2' },
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: saltBuffer,
			iterations: 10000,
			hash: 'SHA-256'
		},
		keyMaterial,
		256
	);

	const hashArray = Array.from(new Uint8Array(derivedBits));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
	password: string,
	salt: string,
	expectedHash: string
): Promise<boolean> {
	const hash = await hashPassword(password, salt);
	if (hash.length !== expectedHash.length) return false;
	let result = 0;
	for (let i = 0; i < hash.length; i++) {
		result |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
	}
	return result === 0;
}

export async function verifyWebhookSignature(
	rawBody: string,
	signature: string,
	secret: string
): Promise<boolean> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(rawBody);

	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
	const signatureArray = Array.from(new Uint8Array(signatureBuffer));
	const computedSignature = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

	if (computedSignature.length !== signature.length) return false;
	let result = 0;
	for (let i = 0; i < computedSignature.length; i++) {
		result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return result === 0;
}

export async function signSession(
	projectId: string,
	secret: string,
	maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<string> {
	const expiry = Date.now() + maxAgeMs;
	const data = `${projectId}:${expiry}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	const signatureArray = Array.from(new Uint8Array(signatureBuffer));
	const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${data}:${signatureHex}`;
}

export async function verifySession(
	token: string,
	projectId: string,
	secret: string
): Promise<boolean> {
	try {
		const parts = token.split(':');
		if (parts.length !== 3) return false;
		const [pId, expiryStr, signatureHex] = parts;
		if (pId !== projectId) return false;

		const expiry = parseInt(expiryStr, 10);
		if (Date.now() > expiry) return false;

		const data = `${pId}:${expiryStr}`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
		const expectedArray = Array.from(new Uint8Array(expectedBuffer));
		const expectedHex = expectedArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		if (signatureHex.length !== expectedHex.length) return false;
		let result = 0;
		for (let i = 0; i < signatureHex.length; i++) {
			result |= signatureHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
		}
		return result === 0;
	} catch {
		return false;
	}
}
