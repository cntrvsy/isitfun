/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		SESSION_SECRET: 'test-signing-secret-key-1234567890'
	}
}));

import { GET } from './[projectId]/[...file]/+server';
import { signSession } from '$lib/server/crypto';
import { projects } from '$lib/server/db/db-schema';

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
			})
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

		const text = await res.text();
		expect(text).toContain('overlay-widget.js');
		expect(text).toContain('data-project="proj_123"');
		expect(text).toContain('data-tier="free"');
	});

	it('should bypass database query for subresources when a valid signed session cookie is present', async () => {
		const mockDb = {
			select: vi.fn(),
			from: vi.fn(),
			where: vi.fn(),
			get: vi.fn()
		};

		const mockBucket = {
			get: vi.fn().mockResolvedValue({
				body: 'console.log("subresource")',
				httpMetadata: { contentType: 'application/javascript' }
			})
		};

		// Generate valid play session token
		const token = await signSession('proj_123');

		const mockCookies = {
			get: vi.fn().mockImplementation((name) => {
				if (name === 'play_session_proj_123') {
					return token;
				}
				return undefined;
			}),
			set: vi.fn()
		};

		const res = await GET({
			params: { projectId: 'proj_123', file: 'js/main.js' },
			locals: { db: mockDb } as any,
			platform: { env: { GAMES_BUCKET: mockBucket } } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/proj_123/js/main.js'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		// Crucial verification: DB should NEVER be queried for subresource if session is valid!
		expect(mockDb.select).not.toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_123/assets/js/main.js');

		const text = await res.text();
		expect(text).toBe('console.log("subresource")');
	});

	it('should fall back to database query for subresources when session cookie is invalid or missing', async () => {
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockImplementation((table) => {
				expect(table).toBe(projects);
				return mockDb;
			}),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue({
				id: 'proj_123',
				tier: 'free',
				passwordProtected: false
			})
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
			})
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
			})
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
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		expect(mockDb.select).toHaveBeenCalled();
		expect(mockBucket.get).toHaveBeenCalledWith('games/proj_passworded/assets/index.html');
	});
});
