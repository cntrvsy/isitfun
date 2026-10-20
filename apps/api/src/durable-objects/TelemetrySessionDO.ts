import { eq, sql } from 'drizzle-orm';
import { createD1Client, telemetrySessions, schema } from '@isitfun/db';

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
	private eventTimestamps: number[] = [];

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		// Sliding window rate limiter: max 120 ingestion events per minute
		const now = Date.now();
		const windowStart = now - 60_000;
		this.eventTimestamps = this.eventTimestamps.filter((t) => t > windowStart);
		if (this.eventTimestamps.length >= 120) {
			return new Response(
				JSON.stringify({ error: 'Too Many Requests: telemetry rate limit exceeded (max 120/min)' }),
				{ status: 429, headers: { 'Content-Type': 'application/json' } }
			);
		}
		this.eventTimestamps.push(now);

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

		// 1. Load session state
		const sessionLogs = (await this.state.storage.get<TelemetryLog[]>('logs')) || [];
		let finalHasCrashed = (await this.state.storage.get<boolean>('hasCrashed')) || false;
		let createdAt = await this.state.storage.get<number>('createdAt');
		let count = (await this.state.storage.get<number>('logCount')) || 0;

		const storageData: Record<string, unknown> = {
			sessionId,
			projectId,
			deviceHash,
			browserInfo
		};

		if (!createdAt) {
			createdAt = Date.now();
			storageData.createdAt = createdAt;
		}

		if (hasCrashed) {
			finalHasCrashed = true;
			storageData.hasCrashed = true;
		}

		if (gameBuildId) storageData.gameBuildId = gameBuildId;
		if (typeof avgFps === 'number') storageData.avgFps = avgFps;
		if (deviceSpecs?.gpuRenderer) storageData.gpuRenderer = deviceSpecs.gpuRenderer;
		if (feedback?.sentiment) {
			storageData.sentiment = feedback.sentiment;
			if (feedback.comment) storageData.userComment = feedback.comment;
		}

		// 2. Append new logs (cap at 500 to prevent OOM)
		const cleanLogs = logs.filter((l) => l.event !== 'heartbeat');
		if (cleanLogs.length > 0) {
			sessionLogs.push(...cleanLogs);
			if (sessionLogs.length > 500) {
				sessionLogs.splice(0, sessionLogs.length - 500);
			}
			storageData.logs = sessionLogs;
			count += cleanLogs.length;
			storageData.logCount = count;
		}

		await this.state.storage.put(storageData);

		const storedAvgFps =
			(storageData.avgFps as number) ?? (await this.state.storage.get<number>('avgFps'));
		const storedGpuRenderer =
			(storageData.gpuRenderer as string) ?? (await this.state.storage.get<string>('gpuRenderer'));
		const storedSentiment =
			(storageData.sentiment as 'fun' | 'neutral' | 'unfun') ??
			(await this.state.storage.get<'fun' | 'neutral' | 'unfun'>('sentiment'));
		const storedUserComment =
			(storageData.userComment as string) ?? (await this.state.storage.get<string>('userComment'));

		// 3. Set inactivity alarm (only if no alarm exists or expiring within 2 mins)
		const existingAlarm =
			typeof this.state.storage.getAlarm === 'function'
				? await this.state.storage.getAlarm()
				: null;
		if (!existingAlarm || existingAlarm - Date.now() < 2 * 60 * 1000) {
			await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
		}

		// 4. Ingest immediately if exiting
		if (isExiting) {
			try {
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
				await this.state.storage.deleteAlarm();
				return new Response(JSON.stringify({ success: true, status: 'flushed' }), {
					headers: { 'Content-Type': 'application/json' }
				});
			} catch (err) {
				console.error('[TelemetrySessionDO] Failed immediate exit flush:', err);
				const errStr = String(err).toLowerCase();
				const isFatalConstraint =
					errStr.includes('foreign key') ||
					errStr.includes('constraint failed') ||
					errStr.includes('no such table');

				if (isFatalConstraint) {
					console.warn(
						'[TelemetrySessionDO] Fatal database constraint error (project deleted or invalid). Abandoning buffer immediately.'
					);
					await this.state.storage.deleteAll();
					await this.state.storage.deleteAlarm();
					return new Response(JSON.stringify({ success: false, status: 'project_not_found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				const retryCount = ((await this.state.storage.get<number>('alarmRetryCount')) || 0) + 1;
				if (retryCount >= 3) {
					await this.state.storage.deleteAll();
					await this.state.storage.deleteAlarm();
				} else {
					await this.state.storage.put('alarmRetryCount', retryCount);
					await this.state.storage.setAlarm(Date.now() + 2 * 60 * 1000);
				}
				return new Response(JSON.stringify({ success: false, status: 'flush_error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		return new Response(JSON.stringify({ success: true, status: 'buffered', logCount: count }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	async alarm(): Promise<void> {
		const logs = (await this.state.storage.get<TelemetryLog[]>('logs')) || [];
		const finalHasCrashed = (await this.state.storage.get<boolean>('hasCrashed')) || false;
		const createdAt = await this.state.storage.get<number>('createdAt');
		const count = (await this.state.storage.get<number>('logCount')) || 0;
		const projectId = await this.state.storage.get<string>('projectId');
		const storedSessionId = await this.state.storage.get<string>('sessionId');
		const sessionId = storedSessionId || this.state.id.toString();
		const deviceHash = (await this.state.storage.get<string>('deviceHash')) || '';
		const browserInfo = (await this.state.storage.get<string>('browserInfo')) || '';
		const gameBuildId = await this.state.storage.get<string>('gameBuildId');
		const storedAvgFps = await this.state.storage.get<number>('avgFps');
		const storedGpuRenderer = await this.state.storage.get<string>('gpuRenderer');
		const storedSentiment = await this.state.storage.get<'fun' | 'neutral' | 'unfun'>('sentiment');
		const storedUserComment = await this.state.storage.get<string>('userComment');

		if (projectId && createdAt) {
			try {
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
				await this.state.storage.deleteAll();
				await this.state.storage.deleteAlarm();
			} catch (err) {
				console.error('[TelemetrySessionDO] Alarm flush failed:', err);
				const errStr = String(err).toLowerCase();
				const isFatalConstraint =
					errStr.includes('foreign key') ||
					errStr.includes('constraint failed') ||
					errStr.includes('no such table');

				if (isFatalConstraint) {
					console.warn(
						'[TelemetrySessionDO] Fatal database constraint error (project deleted or invalid). Abandoning buffer immediately.'
					);
					await this.state.storage.deleteAll();
					await this.state.storage.deleteAlarm();
					return;
				}

				const retryCount = ((await this.state.storage.get<number>('alarmRetryCount')) || 0) + 1;
				if (retryCount >= 3) {
					console.error(
						'[TelemetrySessionDO] Max retry attempts (3) exceeded, deleting storage and alarm'
					);
					await this.state.storage.deleteAll();
					await this.state.storage.deleteAlarm();
				} else {
					await this.state.storage.put('alarmRetryCount', retryCount);
					await this.state.storage.setAlarm(Date.now() + 2 * 60 * 1000);
				}
			}
		} else {
			await this.state.storage.deleteAll();
			await this.state.storage.deleteAlarm();
		}
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

		// 2. Save session summary metrics and increment quota in D1
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
					hasCrashed,
					avgFps: avgFps || null,
					gpuRenderer: gpuRenderer || null,
					sentiment: sentiment || null,
					userComment: userComment || null,
					r2LogPath: r2Key,
					createdAt: new Date(createdAt)
				})
				.onConflictDoUpdate({
					target: telemetrySessions.id,
					set: {
						duration: durationSec,
						hasCrashed,
						avgFps: avgFps || null,
						gpuRenderer: gpuRenderer || null,
						sentiment: sentiment || null,
						userComment: userComment || null,
						r2LogPath: r2Key
					}
				});

			// Increment monthly write quota
			if (logCount > 0) {
				try {
					await db
						.update(schema.projectQuotas)
						.set({
							monthlyWriteCount: sql`${schema.projectQuotas.monthlyWriteCount} + ${logCount}`
						})
						.where(eq(schema.projectQuotas.projectId, projectId));
				} catch (qErr) {
					console.warn('[TelemetrySessionDO] Failed to update quota monthlyWriteCount:', qErr);
				}
			}
		}
	}
}
