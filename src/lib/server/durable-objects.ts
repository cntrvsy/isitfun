import { createD1Client } from './db';
import { telemetrySessions } from './db/db-schema';

export interface Env {
	DB: D1Database;
	GAMES_BUCKET: R2Bucket;
	ISITFUN_KV: KVNamespace;
}

export interface TelemetryLog {
	event: string;
	data: unknown;
	timestamp: number;
}

export class TelemetrySessionDO implements DurableObject {
	state: DurableObjectState;
	env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		let body: {
			projectId: string;
			sessionId: string;
			logs: TelemetryLog[];
			hasCrashed: boolean;
			isExiting: boolean;
			deviceHash: string;
			browserInfo: string;
			gameBuildId?: string;
			avgFps?: number | null;
			minFps?: number | null;
			deviceSpecs?: {
				hardwareConcurrency?: number | null;
				deviceMemory?: number | null;
				screenResolution?: string;
				gpuRenderer?: string | null;
			} | null;
			feedback?: {
				sentiment?: 'fun' | 'neutral' | 'unfun';
				comment?: string;
			} | null;
		};

		try {
			body = await request.json();
		} catch {
			return new Response('Invalid JSON payload', { status: 400 });
		}

		const {
			projectId,
			sessionId,
			logs,
			hasCrashed,
			isExiting,
			deviceHash,
			browserInfo,
			gameBuildId,
			avgFps,
			deviceSpecs,
			feedback
		} = body;

		if (!projectId || !sessionId) {
			return new Response('Missing parameters', { status: 400 });
		}

		// 1. Load or initialize session state
		const sessionLogs = (await this.state.storage.get<TelemetryLog[]>('logs')) || [];
		let finalHasCrashed = (await this.state.storage.get<boolean>('hasCrashed')) || false;
		let createdAt = await this.state.storage.get<number>('createdAt');
		let count = (await this.state.storage.get<number>('logCount')) || 0;

		if (!createdAt) {
			createdAt = Date.now();
			await this.state.storage.put('createdAt', createdAt);
		}

		if (hasCrashed) {
			finalHasCrashed = true;
			await this.state.storage.put('hasCrashed', true);
		}

		// Save parameters for the alarm handler & updates
		await this.state.storage.put('projectId', projectId);
		await this.state.storage.put('deviceHash', deviceHash);
		await this.state.storage.put('browserInfo', browserInfo);
		if (gameBuildId) {
			await this.state.storage.put('gameBuildId', gameBuildId);
		}
		if (typeof avgFps === 'number') {
			await this.state.storage.put('avgFps', avgFps);
		}
		if (deviceSpecs?.gpuRenderer) {
			await this.state.storage.put('gpuRenderer', deviceSpecs.gpuRenderer);
		}
		if (feedback?.sentiment) {
			await this.state.storage.put('sentiment', feedback.sentiment);
			if (feedback.comment) {
				await this.state.storage.put('userComment', feedback.comment);
			}
		}

		const storedAvgFps = await this.state.storage.get<number>('avgFps');
		const storedGpuRenderer = await this.state.storage.get<string>('gpuRenderer');
		const storedSentiment = await this.state.storage.get<'fun' | 'neutral' | 'unfun'>('sentiment');
		const storedUserComment = await this.state.storage.get<string>('userComment');

		// 2. Append new logs (excluding heartbeat pings from final array to save R2 space)
		const cleanLogs = logs.filter((l) => l.event !== 'heartbeat');
		if (cleanLogs.length > 0) {
			sessionLogs.push(...cleanLogs);
			await this.state.storage.put('logs', sessionLogs);
			count += cleanLogs.length;
			await this.state.storage.put('logCount', count);
		}

		// 3. Set inactivity alarm (10 minutes from now)
		await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);

		// 4. Ingest immediately if exiting
		if (isExiting) {
			await this.flush({
				projectId,
				sessionId,
				logs: sessionLogs,
				hasCrashed: finalHasCrashed,
				createdAt,
				logCount: count,
				deviceHash,
				browserInfo,
				gameBuildId,
				avgFps: storedAvgFps,
				gpuRenderer: storedGpuRenderer,
				sentiment: storedSentiment,
				userComment: storedUserComment
			});
			await this.state.storage.deleteAll();
			return new Response(JSON.stringify({ success: true, status: 'flushed' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(
			JSON.stringify({ success: true, status: 'buffered', logCount: count }),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	async alarm(): Promise<void> {
		// Alarm fires if playtest session was abandoned or tab closed abruptly
		const logs = (await this.state.storage.get<TelemetryLog[]>('logs')) || [];
		const finalHasCrashed = (await this.state.storage.get<boolean>('hasCrashed')) || false;
		const createdAt = await this.state.storage.get<number>('createdAt');
		const count = (await this.state.storage.get<number>('logCount')) || 0;
		const projectId = await this.state.storage.get<string>('projectId');
		const deviceHash = (await this.state.storage.get<string>('deviceHash')) || '';
		const browserInfo = (await this.state.storage.get<string>('browserInfo')) || '';
		const gameBuildId = await this.state.storage.get<string>('gameBuildId');
		const storedAvgFps = await this.state.storage.get<number>('avgFps');
		const storedGpuRenderer = await this.state.storage.get<string>('gpuRenderer');
		const storedSentiment = await this.state.storage.get<'fun' | 'neutral' | 'unfun'>('sentiment');
		const storedUserComment = await this.state.storage.get<string>('userComment');
		const sessionId = this.state.id.toString();

		if (projectId && createdAt) {
			await this.flush({
				projectId,
				sessionId,
				logs,
				hasCrashed: finalHasCrashed,
				createdAt,
				logCount: count,
				deviceHash,
				browserInfo,
				gameBuildId,
				avgFps: storedAvgFps,
				gpuRenderer: storedGpuRenderer,
				sentiment: storedSentiment,
				userComment: storedUserComment
			});
		}

		await this.state.storage.deleteAll();
	}

	private async flush(params: {
		projectId: string;
		sessionId: string;
		logs: TelemetryLog[];
		hasCrashed: boolean;
		createdAt: number;
		logCount: number;
		deviceHash: string;
		browserInfo: string;
		gameBuildId?: string;
		avgFps?: number | null;
		gpuRenderer?: string | null;
		sentiment?: 'fun' | 'neutral' | 'unfun' | null;
		userComment?: string | null;
	}) {
		const {
			projectId,
			sessionId,
			logs,
			hasCrashed,
			createdAt,
			logCount,
			deviceHash,
			browserInfo,
			gameBuildId,
			avgFps,
			gpuRenderer,
			sentiment,
			userComment
		} = params;

		const r2Key = `games/${projectId}/sessions/${sessionId}.json`;
		const sessionData = {
			projectId,
			sessionId,
			createdAt: new Date(createdAt).toISOString(),
			logs,
			logCount,
			hasCrashed,
			deviceHash,
			browserInfo,
			gameBuildId,
			avgFps: avgFps || null,
			gpuRenderer: gpuRenderer || null,
			sentiment: sentiment || null,
			userComment: userComment || null
		};

		// 1. Save raw logs to R2
		if (this.env.GAMES_BUCKET) {
			await this.env.GAMES_BUCKET.put(r2Key, JSON.stringify(sessionData), {
				httpMetadata: { contentType: 'application/json' }
			});
		}

		// 2. Save session summary metrics to D1
		if (this.env.DB) {
			const db = createD1Client(this.env.DB);
			const durationSec = Math.floor((Date.now() - createdAt) / 1000);

			await db
				.insert(telemetrySessions)
				.values({
					id: sessionId,
					projectId,
					gameBuildId: gameBuildId || null,
					deviceHash,
					browserInfo,
					duration: durationSec,
					logCount,
					hasCrashed,
					avgFps: avgFps || null,
					gpuRenderer: gpuRenderer || null,
					sentiment: sentiment || null,
					userComment: userComment || null,
					createdAt: new Date(createdAt)
				})
				.onConflictDoUpdate({
					target: telemetrySessions.id,
					set: {
						duration: durationSec,
						logCount,
						hasCrashed,
						avgFps: avgFps || null,
						gpuRenderer: gpuRenderer || null,
						sentiment: sentiment || null,
						userComment: userComment || null
					}
				});
		}
	}
}
