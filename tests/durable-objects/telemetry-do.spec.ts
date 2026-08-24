/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetrySessionDO } from '../../src/lib/server/durable-objects/TelemetrySessionDO';

describe('TelemetrySessionDO Resilience', () => {
	let mockStorageMap: Map<string, any>;
	let mockState: any;
	let mockEnv: any;

	beforeEach(() => {
		mockStorageMap = new Map();
		mockState = {
			id: { toString: () => 'internal_do_hex_id_64chars' },
			storage: {
				get: vi.fn(async (key: string) => mockStorageMap.get(key)),
				put: vi.fn(async (keyOrObj: any, val?: any) => {
					if (typeof keyOrObj === 'object' && keyOrObj !== null) {
						for (const [k, v] of Object.entries(keyOrObj)) {
							mockStorageMap.set(k, v);
						}
					} else {
						mockStorageMap.set(keyOrObj, val);
					}
				}),
				deleteAll: vi.fn(async () => mockStorageMap.clear()),
				getAlarm: vi.fn(async () => null),
				setAlarm: vi.fn(async () => {})
			}
		};

		mockEnv = {
			GAMES_BUCKET: {
				put: vi.fn(async () => {})
			},
			DB: {
				prepare: vi.fn(() => ({
					bind: vi.fn(() => ({
						run: vi.fn(async () => ({ success: true })),
						all: vi.fn(async () => ({ results: [] })),
						raw: vi.fn(async () => [])
					}))
				}))
			}
		};
	});

	it('buffers incoming logs and stores session properties', async () => {
		const doInstance = new TelemetrySessionDO(mockState, mockEnv);

		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: 'proj_1',
				sessionId: 'sess_test_123',
				logs: [{ event: 'player_jump', data: { height: 10 }, timestamp: Date.now() }],
				hasCrashed: false,
				isExiting: false,
				deviceHash: 'dev_123',
				browserInfo: 'Chrome'
			})
		});

		const response = await doInstance.fetch(request);
		expect(response.status).toBe(200);
		const json = (await response.json()) as { status: string };
		expect(json.status).toBe('buffered');
		expect(mockStorageMap.get('logCount')).toBe(1);
		expect(mockStorageMap.get('sessionId')).toBe('sess_test_123');
	});

	it('preserves client sessionId on alarm flush instead of internal DO hex ID', async () => {
		const doInstance = new TelemetrySessionDO(mockState, mockEnv);

		mockStorageMap.set('sessionId', 'sess_client_original_uuid');
		mockStorageMap.set('projectId', 'proj_1');
		mockStorageMap.set('createdAt', Date.now());
		mockStorageMap.set('logs', [{ event: 'level_start', data: {}, timestamp: Date.now() }]);
		mockStorageMap.set('logCount', 1);

		await doInstance.alarm();

		expect(mockEnv.GAMES_BUCKET.put).toHaveBeenCalledWith(
			'games/proj_1/sessions/sess_client_original_uuid.json',
			expect.stringContaining('"sessionId":"sess_client_original_uuid"'),
			expect.any(Object)
		);
		expect(mockState.storage.deleteAll).toHaveBeenCalled();
	});

	it('reschedules retry alarm and preserves storage on flush error', async () => {
		mockEnv.GAMES_BUCKET.put.mockRejectedValue(new Error('R2 write error'));
		const doInstance = new TelemetrySessionDO(mockState, mockEnv);

		// Pre-populate storage
		mockStorageMap.set('logs', [{ event: 'crash', timestamp: Date.now() }]);
		mockStorageMap.set('createdAt', Date.now());
		mockStorageMap.set('projectId', 'proj_1');
		mockStorageMap.set('logCount', 1);

		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: 'proj_1',
				sessionId: 'sess_test_123',
				logs: [],
				hasCrashed: true,
				isExiting: true,
				deviceHash: 'dev_123',
				browserInfo: 'Chrome'
			})
		});

		const response = await doInstance.fetch(request);
		expect(response.status).toBe(500);
		const json = (await response.json()) as { status: string };
		expect(json.status).toBe('flush_error');

		// Verify storage is preserved and alarm rescheduled
		expect(mockState.storage.deleteAll).not.toHaveBeenCalled();
		expect(mockState.storage.setAlarm).toHaveBeenCalled();
	});
});
