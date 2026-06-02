import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, gt } from 'drizzle-orm';
import { telemetrySessions, telemetryLogs, projects } from '$lib/server/db/schema';

// Secure salt for GDPR device hashing
const GDPR_SALT = 'isitfun-gdpr-anonymity-salt-2026';

export const POST: RequestHandler = async ({ request, locals, platform, getClientAddress }) => {
	const bodyText = await request.text();
	let body: {
		projectId: string;
		sessionId: string;
		logType: string;
		payload: unknown;
		browserInfo?: string;
	};
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { projectId, sessionId, logType, payload, browserInfo } = body;

	if (!projectId || !sessionId || !logType) {
		throw error(400, 'Missing required fields: projectId, sessionId, logType');
	}

	const project = await locals.db
		.select()
		.from(projects)
		.where(eq(projects.id, projectId))
		.get();

	if (!project) {
		throw error(404, 'Project not found');
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
		if (logType === 'log' || logType === 'error') {
			return json({ status: 'ignored', success: true });
		}

		// 3. Ignore 10s heartbeat pulses
		if (logType === 'heartbeat') {
			const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
			if (parsedPayload && parsedPayload.pulse) {
				return json({ status: 'ignored', success: true });
			}
		}
	}

	// 1. Edge Security Checks: Sub-millisecond KV Lookup for Quotas
	let currentQuota = 0;
	const kv = platform?.env.KV;
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

	// 2. GDPR Anonymity: Salted IP SHA-256 device hashing
	let clientIp = '127.0.0.1';
	try {
		clientIp = getClientAddress();
	} catch {
		// Fallback for standard environments
		clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
	}

	const encoder = new TextEncoder();
	const data = encoder.encode(clientIp + GDPR_SALT + projectId);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const deviceHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		// 3. Zero Performance Penalty: Wrap DB processing inside Edge waitUntil
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
					deviceHash,
					browserInfo: browserInfo || request.headers.get('user-agent') || 'Unknown',
					duration: 0,
					createdAt: new Date()
				});
				// Refresh the session value
				session = {
					id: sessionId,
					projectId,
					deviceHash,
					browserInfo: browserInfo || 'Unknown',
					duration: 0,
					createdAt: new Date()
				};
			}

			// Heartbeat increment duration
			if (logType === 'heartbeat') {
				const activeDuration = session.duration || 0;
				// Increment duration by 10s (standard heartbeat pulse rate)
				await locals.db
					.update(telemetrySessions)
					.set({ duration: activeDuration + 10 })
					.where(eq(telemetrySessions.id, sessionId));
			}

			// Insert telemetry record
			await locals.db.insert(telemetryLogs).values({
				sessionId,
				projectId,
				logType,
				payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
				timestamp: new Date()
			});

			// Increment active Cloudflare KV quota count
			if (kv) {
				await kv.put(`quota:project:${projectId}`, (currentQuota + 1).toString(), {
					expirationTtl: 60 * 60 * 24 * 30 // Expiry in 30 days
				});
			}
		} catch (err) {
			console.error('Failed to process telemetry in background:', err);
		}
	};

	if (waitUntil) {
		// Run asynchronously in the Cloudflare Worker execution context thread
		waitUntil(saveTelemetryPromise());
	} else {
		// Synchronous fallback for local non-edge development/test runner
		await saveTelemetryPromise();
	}

	// Instantly return 200 OK to the client browser to avoid blocking gameplay thread
	return json({ status: 'queued', success: true });
};
