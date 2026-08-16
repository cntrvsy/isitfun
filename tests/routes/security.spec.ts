/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'file:test.db' }
}));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: vi.fn(({ resolve, event }: any) => resolve(event))
}));

import { handleSecurity } from '../../src/hooks.server';

describe('Server Security & Referer Hook', () => {
	it('blocks game playtest iframe referers from targeting developer portal routes', async () => {
		const event: any = {
			request: new Request('http://localhost/portal/dashboard', {
				headers: { referer: 'http://localhost/play/proj_1/index.html' }
			}),
			url: new URL('http://localhost/portal/dashboard'),
			locals: {},
			cookies: { get: vi.fn(), set: vi.fn() }
		};

		const resolve = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

		const response = await handleSecurity({ event, resolve });
		expect(response.status).toBe(403);
		const text = await response.text();
		expect(text).toContain('Forbidden');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('allows game playtest iframe referers to target telemetry ingestion API', async () => {
		const event: any = {
			request: new Request('http://localhost/api/telemetry', {
				headers: { referer: 'http://localhost/play/proj_1/index.html' }
			}),
			url: new URL('http://localhost/api/telemetry'),
			locals: {},
			cookies: { get: vi.fn(), set: vi.fn() }
		};

		const resolve = vi.fn().mockResolvedValue(new Response('Telemetry OK', { status: 200 }));

		const response = await handleSecurity({ event, resolve });
		expect(response.status).toBe(200);
	});
});
