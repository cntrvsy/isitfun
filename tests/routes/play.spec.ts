/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		SESSION_SECRET: 'test-signing-secret-key-1234567890'
	}
}));

import { GET } from '../../src/routes/play/[projectId]/[...file]/+server';
import { signSession } from '$lib/server/crypto';

describe('GET /play/[projectId]/[...file]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should serve index.html, check database, set cookie, and inject overlay-widget script', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: 'proj_123',
				tier: 'free',
				passwordProtected: false
			}),
			all: vi.fn().mockResolvedValue([])
		};

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				body: '<html><body>test-body</body></html>',
				httpMetadata: { contentType: 'text/html' }
			})
		};

		const mockCookies = {
			get: vi.fn().mockReturnValue(undefined),
			set: vi.fn()
		};

		const res = await GET({
			params: { projectId: 'proj_123', file: 'index.html' },
			locals: { db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/proj_123/index.html'),
			url: new URL('http://localhost/play/proj_123/index.html'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		expect(mockDb.select).toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_123/assets/index.html');

		// Check session cookie generation
		expect(mockCookies.set).toHaveBeenCalledWith(
			'play_session_proj_123',
			expect.stringContaining('proj_123:'),
			expect.any(Object)
		);

		const html = await res.text();
		expect(html).toContain(
			'<script src="/assets/overlay-widget.js" data-project="proj_123" data-tier="free"></script>'
		);
		expect(html).toContain('test-body');
	});

	it('should bypass database query for subresources when a valid signed session cookie is present', async () => {
		const validSessionToken = await signSession('proj_123');

		const mockDb = {
			select: vi.fn()
		};

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				body: 'console.log("main.js")',
				httpMetadata: { contentType: 'application/javascript' }
			})
		};

		const mockCookies = {
			get: vi.fn().mockImplementation((name) => {
				if (name === 'play_session_proj_123') {
					return validSessionToken;
				}
				return undefined;
			})
		};

		const res = await GET({
			params: { projectId: 'proj_123', file: 'js/main.js' },
			locals: { db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/proj_123/js/main.js'),
			url: new URL('http://localhost/play/proj_123/js/main.js'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		// Crucial performance optimization: DB is NOT queried for static subresources!
		expect(mockDb.select).not.toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_123/assets/js/main.js');
	});

	it('should fall back to database query for subresources when session cookie is invalid or missing', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: 'proj_123',
				tier: 'free',
				passwordProtected: false
			}),
			all: vi.fn().mockResolvedValue([])
		};

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				body: 'console.log("fallback")',
				httpMetadata: { contentType: 'application/javascript' }
			})
		};

		const mockCookies = {
			get: vi.fn().mockReturnValue(undefined), // No valid cookie
			set: vi.fn()
		};

		const res = await GET({
			params: { projectId: 'proj_123', file: 'js/main.js' },
			locals: { db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/proj_123/js/main.js'),
			url: new URL('http://localhost/play/proj_123/js/main.js'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		// Falls back to DB lookup
		expect(mockDb.select).toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_123/assets/js/main.js');
	});

	it('should enforce password protection and redirect if unauthorized', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: 'proj_passworded',
				tier: 'pro',
				passwordProtected: true,
				passwordHash: 'hashed-password-xyz'
			}),
			all: vi.fn().mockResolvedValue([])
		};

		const mockCookies = {
			get: vi.fn().mockReturnValue(undefined), // not authenticated yet
			set: vi.fn()
		};

		try {
			await GET({
				params: { projectId: 'proj_passworded', file: 'index.html' },
				locals: { db: mockDb } as any,
				platform: { env: { GAMES_BUCKET: {} } } as any,
				cookies: mockCookies as any,
				request: new Request('http://localhost/play/proj_passworded/index.html'),
				url: new URL('http://localhost/play/proj_passworded/index.html'),
				getClientAddress: () => '127.0.0.1'
			} as any);
			expect.fail('Should have redirected');
		} catch (err: any) {
			// SvelteKit redirect helper throws a Redirect object or error
			expect(err.status).toBe(302);
			expect(err.location).toBe('/playgame?projectId=proj_passworded');
		}
	});

	it('should allow access to password protected game if play_auth cookie matches', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: 'proj_passworded',
				tier: 'pro',
				passwordProtected: true,
				passwordHash: 'hashed-password-xyz'
			}),
			all: vi.fn().mockResolvedValue([])
		};

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				body: '<html>secret</html>',
				httpMetadata: { contentType: 'text/html' }
			})
		};

		const mockCookies = {
			get: vi.fn().mockImplementation((name) => {
				if (name === 'play_auth_proj_passworded') {
					return 'hashed-password-xyz';
				}
				return undefined;
			}),
			set: vi.fn()
		};

		const res = await GET({
			params: { projectId: 'proj_passworded', file: 'index.html' },
			locals: { db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/proj_passworded/index.html'),
			url: new URL('http://localhost/play/proj_passworded/index.html'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		expect(mockDb.select).toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_passworded/assets/index.html');
	});
});
