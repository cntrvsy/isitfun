/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'file:test.db' }
}));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: vi.fn(({ resolve, event }: any) => resolve(event))
}));

import { handleSecurity, handleDrifter } from '../../src/hooks.server';

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

describe('Drifter Platform Maintenance Kill-Switch', () => {
	it('blocks non-admin requests when DISABLED is true even if override param is passed', async () => {
		const event: any = {
			request: new Request('http://localhost/portal/dashboard?override=true'),
			url: new URL('http://localhost/portal/dashboard?override=true'),
			locals: { user: { role: 'game_developer' } },
			platform: {
				env: {
					DRIFTER_CONTROL: {
						get: vi.fn().mockResolvedValue('true')
					}
				}
			}
		};

		const resolve = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
		const response = await handleDrifter({ event, resolve });

		expect(response.status).toBe(503);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('allows admin users with override param when platform is disabled', async () => {
		const event: any = {
			request: new Request('http://localhost/portal/dashboard?override=true'),
			url: new URL('http://localhost/portal/dashboard?override=true'),
			locals: { user: { role: 'admin' } },
			platform: {
				env: {
					DRIFTER_CONTROL: {
						get: vi.fn().mockResolvedValue('true')
					}
				}
			}
		};

		const resolve = vi.fn().mockResolvedValue(new Response('Admin OK', { status: 200 }));
		const response = await handleDrifter({ event, resolve });

		expect(response.status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});
});
