/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		SESSION_SECRET: 'test-signing-secret-key-1234567890'
	}
}));

import { GET } from '../../src/routes/play/[projectId]/[...file]/+server';

describe('GET /play/demo (Interactive Onboarding Ping Pong Game)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns HTML5 Canvas Ping Pong game bundle with overlay-widget.js injection', async () => {
		const mockCookies = {
			get: vi.fn().mockReturnValue(undefined),
			set: vi.fn()
		};

		const res = await GET({
			params: { projectId: 'demo', file: 'index.html' },
			locals: {} as any,
			platform: { env: {} } as any,
			cookies: mockCookies as any,
			request: new Request('http://localhost/play/demo'),
			url: new URL('http://localhost/play/demo'),
			getClientAddress: () => '127.0.0.1'
		} as any);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/html');

		const html = await res.text();
		expect(html).toContain('Ping Pong');
		expect(html).toContain('<canvas id="gameCanvas"');
		expect(html).toContain('<script src="/assets/overlay-widget.js" data-project="demo"');
		expect(mockCookies.set).toHaveBeenCalledWith(
			'play_session_demo',
			expect.stringContaining('demo:'),
			expect.any(Object)
		);
	});
});
