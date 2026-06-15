import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, gt } from 'drizzle-orm';
import { telemetrySessions, telemetryLogs, gameplayEvents, projects } from '$lib/server/db/schema';

// Secure salt for GDPR device hashing
const GDPR_SALT = 'isitfun-gdpr-anonymity-salt-2026';

export const POST: RequestHandler = async ({ request, locals, platform, getClientAddress }) => {
	const bodyText = await request.text();
	let body: {
		projectId: string;
		sessionId: string;
		logType?: string;
		payload?: unknown;
		browserInfo?: string;
		gameBuildId?: string;
		logs?: Array<{
			logType: string;
			payload: unknown;
			timestamp?: string;
		}>;
	};
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { projectId, sessionId, logType, payload, browserInfo, gameBuildId, logs } = body;

	if (!projectId || !sessionId) {
		throw error(400, 'Missing required fields: projectId, sessionId');
	}

	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Project not found');
	}

	// 1. Edge Firewall: Global Daily Project Rate Limit Check
	const today = new Date().toISOString().split('T')[0];
	const dailyProjectKey = `rate:${projectId}:${today}`;
	let currentDailyCount = 0;
	const kv = platform?.env.ISITFUN_KV;

	if (kv) {
		const countStr = await kv.get(dailyProjectKey);
		if (countStr) {
			currentDailyCount = parseInt(countStr, 10);
		}
		if (currentDailyCount >= 5000) {
			return new Response('Daily project telemetry quota limit reached', { status: 429 });
		}
	}

	// Structure telemetry items
	type LogItem = {
		logType: string;
		payload: unknown;
		timestamp?: string;
	};
	let logsArray: LogItem[] = [];
	if (logs && Array.isArray(logs)) {
		logsArray = logs;
	} else if (logType) {
		logsArray = [{ logType, payload, timestamp: new Date().toISOString() }];
	}

	// Enforce Free Jammer Tier boundaries
	if (project.tier === 'free') {
		// 1. Rate-limiting concurrent sessions to max 3 (active in last 10 minutes)
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
		const activeSessions = await locals.db
			.select()
			.from(telemetrySessions)
			.where(
				and(
					eq(telemetrySessions.projectId, projectId),
					gt(telemetrySessions.createdAt, tenMinutesAgo)
				)
			)
			.all();

		const isExistingSession = activeSessions.some((s) => s.id === sessionId);
		if (!isExistingSession && activeSessions.length >= 3) {
			return new Response('Concurrent playtest session limit of 3 exceeded for Free Jammer Tier.', {
				status: 429
			});
		}

		// 2. Reject detailed logs or automated errors to save D1 row count
		logsArray = logsArray.filter((l) => l.logType !== 'log' && l.logType !== 'error');

		// 3. Ignore 10s heartbeat pulses
		logsArray = logsArray.filter((l) => {
			if (l.logType === 'heartbeat') {
				const parsedPayload = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
				if (parsedPayload && parsedPayload.pulse) {
					return false;
				}
			}
			return true;
		});
	}

	// If no logs left to process after filtering, exit early
	if (logsArray.length === 0) {
		return json({ status: 'ignored', success: true });
	}

	// 2. Edge Security Checks: Sub-millisecond KV Lookup for Quotas
	let currentQuota = 0;
	if (kv) {
		const quotaStr = await kv.get(`quota:project:${projectId}`);
		if (quotaStr) {
			currentQuota = parseInt(quotaStr, 10);
		}

		// Define quota limit per tier (Free is limited to 5000 logs/heartbeats per project)
		const quotaLimit = project.tier === 'free' ? 5000 : 500000;
		if (currentQuota >= quotaLimit) {
			return new Response('Telemetry quota exceeded for this playtest', {
				status: 429,
				headers: {
					'Retry-After': '3600'
				}
			});
		}
	}

	// 3. GDPR Anonymity: Salted IP SHA-256 device hashing
	let clientIp = '127.0.0.1';
	try {
		clientIp = getClientAddress();
	} catch {
		clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
	}

	const encoder = new TextEncoder();
	const hashData = encoder.encode(clientIp + GDPR_SALT + projectId);
	const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const deviceHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

	// 4. Zero Performance Penalty: Wrap DB processing inside Edge waitUntil
	const waitUntil = platform?.ctx?.waitUntil;

	const saveTelemetryPromise = async () => {
		try {
			// Check if telemetry session already exists
			let session = await locals.db
				.select()
				.from(telemetrySessions)
				.where(eq(telemetrySessions.id, sessionId))
				.get();

			if (!session) {
				// Insert new telemetry session
				await locals.db.insert(telemetrySessions).values({
					id: sessionId,
					projectId,
					gameBuildId: gameBuildId || null,
					deviceHash,
					browserInfo: browserInfo || request.headers.get('user-agent') || 'Unknown',
					duration: 0,
					createdAt: new Date()
				});
				// Refresh the session value
				session = {
					id: sessionId,
					projectId,
					gameBuildId: gameBuildId || null,
					deviceHash,
					browserInfo: browserInfo || 'Unknown',
					duration: 0,
					createdAt: new Date()
				};
			}

			if (!session) {
				throw new Error('Telemetry session could not be resolved');
			}

			// Aggregate heartbeats from batch to update duration once
			const heartbeatCount = logsArray.filter((l) => l.logType === 'heartbeat').length;
			if (heartbeatCount > 0) {
				const activeDuration = session.duration || 0;
				await locals.db
					.update(telemetrySessions)
					.set({ duration: activeDuration + heartbeatCount * 10 })
					.where(eq(telemetrySessions.id, sessionId));
			}

			// Separate system logs and gameplay events
			const gameplayLogs = logsArray.filter((l) => l.logType === 'gameplay_event');
			const systemLogs = logsArray.filter((l) => l.logType !== 'gameplay_event');

			if (gameplayLogs.length > 0) {
				await locals.db.insert(gameplayEvents).values(
					gameplayLogs.map((l) => {
						const data = (typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload) || {};
						return {
							sessionId,
							projectId,
							eventName: data.eventName || 'unknown',
							properties:
								typeof data.properties === 'string'
									? data.properties
									: JSON.stringify(data.properties || {}),
							timestamp: l.timestamp ? new Date(l.timestamp) : new Date()
						};
					})
				);
			}

			if (systemLogs.length > 0) {
				await locals.db.insert(telemetryLogs).values(
					systemLogs.map((l) => ({
						sessionId,
						projectId,
						logType: l.logType,
						payload: typeof l.payload === 'string' ? l.payload : JSON.stringify(l.payload),
						timestamp: l.timestamp ? new Date(l.timestamp) : new Date()
					}))
				);
			}

			// Increment active Cloudflare KV quota count and daily count
			if (kv) {
				const totalLogsCount = logsArray.length;
				await kv.put(`quota:project:${projectId}`, (currentQuota + totalLogsCount).toString(), {
					expirationTtl: 60 * 60 * 24 * 30 // Expiry in 30 days
				});
				await kv.put(dailyProjectKey, (currentDailyCount + totalLogsCount).toString(), {
					expirationTtl: 60 * 60 * 48 // Expiry in 48 hours
				});
			}
		} catch (err) {
			console.error('Failed to process telemetry in background:', err);
		}
	};

	if (waitUntil) {
		waitUntil(saveTelemetryPromise());
	} else {
		await saveTelemetryPromise();
	}

	return json({ status: 'queued', success: true });
};
