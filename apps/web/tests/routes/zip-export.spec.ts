/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../src/routes/(app)/portal/dashboard/projects/[projectId]/export/zip/+server';

describe('GET /portal/dashboard/projects/[projectId]/export/zip', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects unauthenticated requests', async () => {
		try {
			await GET({
				params: { projectId: 'proj_1' },
				locals: {} as any
			} as any);
			expect.fail('Should throw 401');
		} catch (err: any) {
			expect(err.status).toBe(401);
		}
	});

	it('delegates to locals.api and returns valid ZIP binary attachment stream', async () => {
		const mockZipBytes = new Uint8Array([80, 75, 3, 4]); // PK zip header
		const mockApi = {
			v1: {
				projects: {
					':id': {
						export: {
							zip: {
								$get: vi.fn().mockResolvedValue({
									ok: true,
									status: 200,
									headers: new Headers({
										'content-type': 'application/zip',
										'content-disposition': 'attachment; filename="playtests-proj_1-123.zip"'
									}),
									arrayBuffer: async () => mockZipBytes.buffer
								})
							}
						}
					}
				}
			}
		};

		const res = await GET({
			params: { projectId: 'proj_1' },
			locals: { session: { id: 's1' }, user: { id: 'user_1' }, api: mockApi } as any
		} as any);

		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/zip');
		expect(res.headers.get('content-disposition')).toContain('attachment; filename="playtests-proj_1-');

		const arrayBuffer = await res.arrayBuffer();
		expect(arrayBuffer.byteLength).toBe(4);
	});
});
