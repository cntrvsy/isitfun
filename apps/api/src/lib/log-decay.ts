import { createD1Client, schema, and, lt, inArray, eq } from '@isitfun/db';
import type { AppEnv } from '../types';

export async function runLogDecay(env: AppEnv['Bindings']): Promise<{ deletedSessions: number }> {
	const db = createD1Client(env.DB);
	const bucket = env.GAMES_BUCKET;
	const now = Date.now();
	let totalDeleted = 0;

	try {
		// 1. Fetch projects with org tiers to determine effective retention
		const allProjects = await db
			.select({
				id: schema.projects.id,
				tier: schema.projects.tier,
				orgTier: schema.organizations.tier
			})
			.from(schema.projects)
			.leftJoin(schema.organizations, eq(schema.projects.organizationId, schema.organizations.id))
			.all();

		const freeIds: string[] = [];
		const proIds: string[] = [];
		const teamIds: string[] = [];

		for (const p of allProjects) {
			if (p.orgTier === 'team') {
				teamIds.push(p.id);
			} else if (p.tier === 'pro') {
				proIds.push(p.id);
			} else {
				freeIds.push(p.id);
			}
		}

		const decayThresholds: Array<{ ids: string[]; cutoff: Date; label: string }> = [
			{ ids: freeIds, cutoff: new Date(now - 7 * 24 * 60 * 60 * 1000), label: 'Free (7d)' },
			{ ids: proIds, cutoff: new Date(now - 30 * 24 * 60 * 60 * 1000), label: 'Pro (30d)' },
			{ ids: teamIds, cutoff: new Date(now - 90 * 24 * 60 * 60 * 1000), label: 'Team (90d)' }
		];

		for (const group of decayThresholds) {
			if (group.ids.length === 0) continue;

			// Fetch expired session IDs in batches of 500
			const expiredSessions: Array<{ id: string; projectId: string }> = await db
				.select({
					id: schema.telemetrySessions.id,
					projectId: schema.telemetrySessions.projectId
				})
				.from(schema.telemetrySessions)
				.where(
					and(
						lt(schema.telemetrySessions.createdAt, group.cutoff),
						inArray(schema.telemetrySessions.projectId, group.ids)
					)
				)
				.limit(500)
				.all();

			if (expiredSessions.length > 0) {
				const keysToDelete = expiredSessions.map(
					(s: { id: string; projectId: string }) => `games/${s.projectId}/sessions/${s.id}.json`
				);

				if (bucket) {
					try {
						await bucket.delete(keysToDelete);
					} catch (r2Err) {
						console.error(`[Cron Log Decay] R2 session delete failed for ${group.label}:`, r2Err);
					}
				}

				const expiredIds = expiredSessions.map((s: { id: string }) => s.id);
				await db
					.delete(schema.telemetrySessions)
					.where(inArray(schema.telemetrySessions.id, expiredIds));

				totalDeleted += expiredSessions.length;
				console.log(
					`[Cron Log Decay] Pruned ${expiredSessions.length} expired sessions for ${group.label}`
				);
			}
		}
	} catch (err) {
		console.error('[Cron Log Decay] Error executing retention routine:', err);
	}

	return { deletedSessions: totalDeleted };
}
