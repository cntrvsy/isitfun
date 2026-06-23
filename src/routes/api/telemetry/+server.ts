import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, gt } from 'drizzle-orm';
import { telemetrySessions, customDeveloperLogs, projects } from '$lib/server/db/db-schema';

// Secure salt for GDPR device hashing
const GDPR_SALT = 'isitfun-gdpr-anonymity-salt-2026';

export const POST: RequestHandler = async ({ request, locals, platform, getClientAddress }) => {
	const bodyText = await request.text();
	let body: {
		projectId: string;
		sessionId: string;
		event?: string;
		data?: unknown;
		timestamp?: number;
		browserInfo?: string;
		gameBuildId?: string;
		logs?: Array<{
			event: string;
			data: unknown;
			timestamp?: number;
		}>;
	};
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { projectId, sessionId, event, data, timestamp, browserInfo, gameBuildId, logs } = body;

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
		event: string;
		data: unknown;
		timestamp?: number;
	};
	let logsArray: LogItem[] = [];
	if (logs && Array.isArray(logs)) {
		logsArray = logs;
	} else if (event) {
		logsArray = [{ event, data: data || {}, timestamp }];
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

		// Define quota limit per tier (Free is limited to 5000 logs per project)
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
				// Refresh local session representation
				session = {
					id: sessionId,
					projectId,
					gameBuildId: gameBuildId || null,
					deviceHash,
					browserInfo: browserInfo || request.headers.get('user-agent') || 'Unknown',
					duration: 0,
					createdAt: new Date()
				};
			}

			if (!session) {
				throw new Error('Telemetry session could not be resolved');
			}

			// Update session duration dynamically based on elapsed time since session creation
			const durationSec = Math.floor((Date.now() - session.createdAt.getTime()) / 1000);
			await locals.db
				.update(telemetrySessions)
				.set({ duration: durationSec })
				.where(eq(telemetrySessions.id, sessionId));

			// Ingest custom developer logs
			if (logsArray.length > 0) {
				await locals.db.insert(customDeveloperLogs).values(
					logsArray.map((l) => ({
						projectId,
						sessionId,
						eventName: l.event,
						payload: typeof l.data === 'string' ? l.data : JSON.stringify(l.data || {}),
						createdAt: l.timestamp ? new Date(l.timestamp) : new Date()
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
