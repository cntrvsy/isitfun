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
			id: { toString: () => 'sess_test_123' },
			storage: {
				get: vi.fn(async (key: string) => mockStorageMap.get(key)),
				put: vi.fn(async (key: string, val: any) => mockStorageMap.set(key, val)),
				deleteAll: vi.fn(async () => mockStorageMap.clear()),
				getAlarm: vi.fn(async () => null),
				setAlarm: vi.fn(async () => {})
			}
		};

		mockEnv = {
			GAMES_BUCKET: {
				put: vi.fn(async () => {})
			},
			DB: {}
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
