import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import { createD1Client, schema } from '@isitfun/db';
import { CreateOrgSchema, InviteMemberSchema } from '@isitfun/shared';
import type { AppEnv } from '../types';
import { sessionMiddleware, requireAuth } from '../middleware/auth';
import { sendOrganizationInviteEmail } from '../lib/email';

export const orgsRouter = new Hono<AppEnv>();

orgsRouter.use('*', sessionMiddleware, requireAuth);

// GET /v1/orgs - List user's organizations
orgsRouter.get('/', async (c) => {
	const user = c.get('user')!;
	const db = createD1Client(c.env.DB);

	const memberships = await db
		.select({
			organization: schema.organizations,
			role: schema.organizationMemberships.role
		})
		.from(schema.organizationMemberships)
		.innerJoin(
			schema.organizations,
			eq(schema.organizationMemberships.organizationId, schema.organizations.id)
		)
		.where(eq(schema.organizationMemberships.userId, user.id))
		.all();

	return c.json({ organizations: memberships });
});

// POST /v1/orgs - Create a new organization
orgsRouter.post('/', vValidator('json', CreateOrgSchema), async (c) => {
	const user = c.get('user')!;
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	const orgId = schema.generateNanoID(12);
	const now = new Date();

	await db.insert(schema.organizations).values({
		id: orgId,
		name: data.name.trim(),
		ownerId: user.id,
		tier: 'free',
		createdAt: now
	});

	await db.insert(schema.organizationMemberships).values({
		id: crypto.randomUUID(),
		organizationId: orgId,
		userId: user.id,
		role: 'owner',
		createdAt: now
	});

	return c.json({ success: true, organizationId: orgId }, 201);
});

// GET /v1/orgs/:id - Get organization details, members, invites
orgsRouter.get('/:id', async (c) => {
	const user = c.get('user')!;
	const orgId = c.req.param('id');
	const db = createD1Client(c.env.DB);

	// Check membership
	const myMembership = await db
		.select()
		.from(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.organizationId, orgId),
				eq(schema.organizationMemberships.userId, user.id)
			)
		)
		.get();

	if (!myMembership && user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	const org = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, orgId))
		.get();

	if (!org) return c.json({ error: 'Organization not found' }, 404);

	const members = await db
		.select({
			membershipId: schema.organizationMemberships.id,
			userId: schema.organizationMemberships.userId,
			role: schema.organizationMemberships.role,
			name: schema.user.name,
			email: schema.user.email,
			image: schema.user.image,
			createdAt: schema.organizationMemberships.createdAt
		})
		.from(schema.organizationMemberships)
		.innerJoin(schema.user, eq(schema.organizationMemberships.userId, schema.user.id))
		.where(eq(schema.organizationMemberships.organizationId, orgId))
		.all();

	const invites = await db
		.select()
		.from(schema.organizationInvites)
		.where(eq(schema.organizationInvites.organizationId, orgId))
		.all();

	return c.json({ organization: org, members, invites, myRole: myMembership?.role || 'member' });
});

// POST /v1/orgs/:id/invites - Invite a user to organization
orgsRouter.post('/:id/invites', vValidator('json', InviteMemberSchema), async (c) => {
	const user = c.get('user')!;
	const orgId = c.req.param('id');
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	// Check that requester is owner or admin
	const myMembership = await db
		.select()
		.from(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.organizationId, orgId),
				eq(schema.organizationMemberships.userId, user.id)
			)
		)
		.get();

	if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
		if (user.role !== 'admin') {
			return c.json({ error: 'Forbidden: Admin or Owner role required' }, 403);
		}
	}

	const org = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, orgId))
		.get();

	if (!org) return c.json({ error: 'Organization not found' }, 404);

	const token = crypto.randomUUID();
	const inviteId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

	await db.insert(schema.organizationInvites).values({
		id: inviteId,
		organizationId: orgId,
		email: data.email.trim().toLowerCase(),
		token,
		expiresAt,
		createdAt: new Date()
	});

	const baseURL = c.env.BETTER_AUTH_URL || 'https://isitfun.frstudios.co.ke';
	const inviteUrl = `${baseURL}/auth?invite=${token}`;

	await sendOrganizationInviteEmail({
		apiKey: c.env.RESEND_API_KEY,
		from: c.env.RESEND_FROM_EMAIL,
		to: data.email.trim().toLowerCase(),
		inviterName: user.name,
		orgName: org.name,
		inviteUrl
	});

	return c.json({ success: true, inviteId }, 201);
});

// DELETE /v1/orgs/:id/invites/:inviteId - Cancel an invitation
orgsRouter.delete('/:id/invites/:inviteId', async (c) => {
	const user = c.get('user')!;
	const orgId = c.req.param('id');
	const inviteId = c.req.param('inviteId');
	const db = createD1Client(c.env.DB);

	const myMembership = await db
		.select()
		.from(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.organizationId, orgId),
				eq(schema.organizationMemberships.userId, user.id)
			)
		)
		.get();

	if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
		if (user.role !== 'admin') {
			return c.json({ error: 'Forbidden' }, 403);
		}
	}

	await db
		.delete(schema.organizationInvites)
		.where(
			and(
				eq(schema.organizationInvites.id, inviteId),
				eq(schema.organizationInvites.organizationId, orgId)
			)
		);

	return c.json({ success: true });
});

// DELETE /v1/orgs/:id/members/:memberId - Remove member
orgsRouter.delete('/:id/members/:memberId', async (c) => {
	const user = c.get('user')!;
	const orgId = c.req.param('id');
	const memberId = c.req.param('memberId');
	const db = createD1Client(c.env.DB);

	const myMembership = await db
		.select()
		.from(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.organizationId, orgId),
				eq(schema.organizationMemberships.userId, user.id)
			)
		)
		.get();

	if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
		if (user.role !== 'admin') {
			return c.json({ error: 'Forbidden' }, 403);
		}
	}

	await db
		.delete(schema.organizationMemberships)
		.where(
			and(
				eq(schema.organizationMemberships.id, memberId),
				eq(schema.organizationMemberships.organizationId, orgId)
			)
		);

	return c.json({ success: true });
});
