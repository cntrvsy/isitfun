import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';
import { generateNanoID } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';

// Helper to hash passwords using native Edge Web Crypto
async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const createProject = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Project name is required')),
		passwordProtected: v.optional(v.boolean(), false),
		password: v.optional(v.string())
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;
		
		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Enforce Free Jammer Tier project count limit (max 1 active free project)
		const activeFreeProjects = await db
			.select()
			.from(projects)
			.where(and(eq(projects.userId, user.id), eq(projects.tier, 'free')))
			.all();

		if (activeFreeProjects.length >= 1) {
			error(400, 'Free tier is limited to 1 active project. Please delete your existing project or upgrade to a Project Pass to create more.');
		}

		let passwordHash: string | null = null;
		if (data.passwordProtected && data.password) {
			passwordHash = await hashPassword(data.password);
		}

		try {
			const projectId = generateNanoID(12);
			await db.insert(projects).values({
				id: projectId,
				userId: user.id,
				name: data.name.trim(),
				passwordProtected: data.passwordProtected,
				passwordHash,
				tier: 'free',
				createdAt: new Date()
			});

			return { success: true };
		} catch (err) {
			console.error('Failed to create project:', err);
			error(500, 'Database insertion failed');
		}
	}
);

export const deleteProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals, platform } = event;
		const { session, user, db } = locals;
		
		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		try {
			// Verify ownership before deleting
			const project = await db
				.select()
				.from(projects)
				.where(and(eq(projects.id, data.id), eq(projects.userId, user.id)))
				.get();

			if (!project) {
				error(404, 'Project not found');
			}

			// 1. Delete associated files in R2 GAMES_BUCKET
			const bucket = platform?.env.GAMES_BUCKET;
			if (bucket) {
				const prefix = `games/${data.id}/`;
				let truncated = true;
				let cursor: string | undefined = undefined;

				while (truncated) {
					const list = await bucket.list({ prefix, cursor });
					for (const obj of list.objects) {
						await bucket.delete(obj.key);
					}
					if (list.truncated) {
						cursor = list.cursor;
					}
					truncated = list.truncated;
				}
			}

			// 2. Delete project in D1 (cascade handles telemetry sessions and logs)
			await db.delete(projects).where(eq(projects.id, data.id));

			return { success: true };
		} catch (err) {
			console.error('Failed to delete project:', err);
			const message = err instanceof Error ? err.message : String(err);
			error(500, `Deletion failed: ${message}`);
		}
	}
);

export const upgradeProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;
		
		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify project ownership
		const project = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, data.id), eq(projects.userId, user.id)))
			.get();

		if (!project) {
			error(404, 'Project not found');
		}

		const creemApiKey = env.CREEM_API_KEY;
		const creemProductId = env.CREEM_PRODUCT_ID;
		const isTestMode = env.CREEM_TEST_MODE !== 'false';

		if (creemApiKey && creemProductId) {
			const baseUrl = isTestMode ? 'https://test-api.creem.io/v1/checkouts' : 'https://api.creem.io/v1/checkouts';
			try {
				const res = await fetch(baseUrl, {
					method: 'POST',
					headers: {
						'x-api-key': creemApiKey,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						product_id: creemProductId,
						request_id: data.id,
						success_url: `${event.url.origin}/portal/dashboard?upgrade_success=true&project_id=${data.id}`
					})
				});
				
				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(`Creem API returned ${res.status}: ${errorText}`);
				}
				
				const checkoutData = await res.json() as { checkout_url: string };
				return { redirectUrl: checkoutData.checkout_url };
			} catch (err) {
				console.error('Failed to create Creem checkout:', err);
				error(500, 'Failed to initialize payment gateway.');
			}
		} else {
			// Mock Upgrade mode for local development/testing without keys
			try {
				await db
					.update(projects)
					.set({ tier: 'pro' })
					.where(and(eq(projects.id, data.id), eq(projects.userId, user.id)));

				return { success: true, mockUpgraded: true };
			} catch (err) {
				console.error('Failed to upgrade project (mock):', err);
				error(500, 'Mock upgrade failed');
			}
		}
	}
);
