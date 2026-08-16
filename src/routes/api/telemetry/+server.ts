import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, gt } from 'drizzle-orm';
import { telemetrySessions, projects } from '#lib/server/db/db-schema.js';
import { user } from '#lib/server/db/auth-schema.js';

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
		hasCrashed?: boolean;
		isExiting?: boolean;
		avgFps?: number | null;
		minFps?: number | null;
		deviceSpecs?: Record<string, unknown> | null;
		feedback?: string | null;
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

	const {
		projectId,
		sessionId,
		event,
		data,
		timestamp,
		browserInfo,
		gameBuildId,
		logs,
		isExiting
	} = body;

	if (!projectId || !sessionId) {
		throw error(400, 'Missing required fields: projectId, sessionId');
	}

	const kv = platform?.env.ISITFUN_KV;

	// 1. Fetch project tier & configuration (checking KV cache first to save D1 selects)
	let project: {
		id: string;
		tier: string;
		passwordProtected: boolean;
		passwordHash: string | null;
	} | null = null;
	const projectCacheKey = `project:config:${projectId}`;

	if (kv) {
		const cached = await kv.get(projectCacheKey);
		if (cached) {
			try {
				project = JSON.parse(cached);
			} catch {
				project = null;
			}
		}
	}

	if (!project) {
		let dbProject = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

		if (!dbProject && (projectId === 'demo' || projectId.startsWith('demo_'))) {
			const ownerUser = locals.user || (await locals.db.select().from(user).limit(1).get());
			if (ownerUser) {
				try {
					await locals.db
						.insert(projects)
						.values({
							id: projectId,
							userId: ownerUser.id,
							name: '🏓 Interactive Demo (Ping Pong)',
							tier: 'free',
							passwordProtected: false,
							createdAt: new Date()
						})
						.onConflictDoNothing()
						.run();

					dbProject = await locals.db
						.select()
						.from(projects)
						.where(eq(projects.id, projectId))
						.get();
				} catch (err) {
					console.error('Failed to auto-create demo project:', err);
				}
			}
		}

		if (!dbProject) {
			throw error(404, 'Project not found');
		}
		project = {
			id: dbProject.id,
			tier: dbProject.tier || 'free',
			passwordProtected: !!dbProject.passwordProtected,
			passwordHash: dbProject.passwordHash || null
		};
		if (kv) {
			await kv.put(projectCacheKey, JSON.stringify(project), {
				expirationTtl: 300 // 5 minutes cache
			});
		}
	}

	// 2. Rate-Limiter Checks (Daily Project Telemetry Quota)
	const today = new Date().toISOString().split('T')[0];
	const dailyProjectKey = `rate:${projectId}:${today}`;
	let currentDailyCount = 0;

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

	// Enforce Free Jammer Tier concurrent session boundaries
	if (project.tier === 'free') {
		let isExistingSession = false;
		if (kv) {
			const activeFlag = await kv.get(`session:active:${sessionId}`);
			if (activeFlag) {
				isExistingSession = true;
			}
		}

		if (!isExistingSession) {
			// Query D1 active sessions in the last 10 minutes
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

			if (activeSessions.length >= 3) {
				return new Response(
					'Concurrent playtest session limit of 3 exceeded for Free Jammer Tier.',
					{
						status: 429
					}
				);
			}
		}
	}

	// 3. Billing Quota Check
	let currentQuota = 0;
	if (kv) {
		const quotaStr = await kv.get(`quota:project:${projectId}`);
		if (quotaStr) {
			currentQuota = parseInt(quotaStr, 10);
		}
		const quotaLimit = project.tier === 'free' ? 5000 : 500000;
		if (currentQuota >= quotaLimit) {
			return new Response('Telemetry quota exceeded for this playtest', {
				status: 429,
				headers: { 'Retry-After': '3600' }
			});
		}
	}

	// 4. GDPR Device Hashing (Salted IP SHA-256)
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

	// 5. Forward Telemetry payload to Durable Object
	const doBinding = platform?.env.TELEMETRY_BUFFER;
	if (!doBinding) {
		throw error(500, 'TELEMETRY_BUFFER Durable Object binding is missing');
	}

	const doId = doBinding.idFromName(sessionId);
	const doStub = doBinding.get(doId);

	const doPayload = {
		projectId,
		sessionId,
		logs: logsArray,
		hasCrashed: !!body.hasCrashed,
		isExiting: !!isExiting,
		deviceHash,
		browserInfo: browserInfo || request.headers.get('user-agent') || 'Unknown',
		gameBuildId: gameBuildId || null,
		avgFps: typeof body.avgFps === 'number' ? body.avgFps : null,
		minFps: typeof body.minFps === 'number' ? body.minFps : null,
		deviceSpecs: body.deviceSpecs || null,
		feedback: body.feedback || null
	};

	const saveTelemetryPromise = async () => {
		try {
			const doResponse = await doStub.fetch('http://do/telemetry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(doPayload)
			});

			if (!doResponse.ok) {
				console.error('Failed to forward telemetry to DO:', await doResponse.text());
				return;
			}

			// If successful and session is new, save active status to KV cache
			if (kv) {
				const activeFlag = await kv.get(`session:active:${sessionId}`);
				if (!activeFlag) {
					await kv.put(`session:active:${sessionId}`, 'true', { expirationTtl: 600 });
				}
				// Increment KV daily/billing counters
				const totalLogsCount = logsArray.length;
				await kv.put(`quota:project:${projectId}`, (currentQuota + totalLogsCount).toString(), {
					expirationTtl: 60 * 60 * 24 * 30
				});
				await kv.put(dailyProjectKey, (currentDailyCount + totalLogsCount).toString(), {
					expirationTtl: 60 * 60 * 48
				});
			}
		} catch (err) {
			console.error('Failed to process telemetry in DO wrapper:', err);
		}
	};

	if (platform?.ctx?.waitUntil) {
		platform.ctx.waitUntil(saveTelemetryPromise());
	} else {
		await saveTelemetryPromise();
	}

	return json({ status: 'queued', success: true });
};
