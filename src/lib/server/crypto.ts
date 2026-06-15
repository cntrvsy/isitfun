// Helper to hash passwords using PBKDF2 with a project salt on native Edge Web Crypto
export async function hashPassword(password: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);
	const saltBuffer = encoder.encode(salt);

	// Import raw password as key material
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		passwordBuffer,
		{ name: 'PBKDF2' },
		false,
		['deriveBits']
	);

	// Derive key bits (using PBKDF2 with SHA-256, 10,000 iterations, 256-bit key length)
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

// Timing-safe helper to verify HMAC-SHA256 signatures for webhook verification
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
