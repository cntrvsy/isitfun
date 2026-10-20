import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { CreateProjectSchema, CreateOrgSchema } from '@isitfun/shared';

function requireAuthContext() {
	const event = getRequestEvent();
	if (!event) error(500, 'Request context missing');
	const { locals } = event;
	if (!locals.session || !locals.user) {
		error(401, 'Unauthorized');
	}
	return event;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function unwrapResponse<T = any>(promise: Promise<any>, fallbackMsg: string): Promise<T> {
	const res = await promise;
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
		error(res.status || 500, err.error || err.message || fallbackMsg);
	}
	return await res.json();
}

export const createProject = form(CreateProjectSchema, async (data) => {
	const { locals } = requireAuthContext();
	const json = await unwrapResponse<{ projectId: string }>(
		locals.api.v1.projects.$post({
			json: {
				name: data.name.trim(),
				organizationId: data.organizationId || undefined
			}
		}),
		'Failed to create project'
	);

	return { success: true, projectId: json.projectId };
});

export const deleteProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.projects[':id'].$delete({
				param: { id: data.id }
			}),
			'Failed to delete project'
		);

		return { success: true };
	}
);

export const upgradeProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = requireAuthContext();
		const successUrl = `${event.url.origin}/portal/dashboard?upgrade_success=true&project_id=${data.id}`;
		const json = await unwrapResponse<{ redirectUrl?: string }>(
			event.locals.api.v1.billing.checkout.project[':id'].$post({
				param: { id: data.id },
				json: { successUrl }
			}),
			'Failed to initialize project upgrade'
		);

		if ('redirectUrl' in json && json.redirectUrl) {
			return { redirectUrl: json.redirectUrl };
		}

		return { success: true, mockUpgraded: true };
	}
);

export const createOrganization = form(CreateOrgSchema, async (data) => {
	const { locals } = requireAuthContext();
	const json = await unwrapResponse<{ organizationId: string }>(
		locals.api.v1.orgs.$post({
			json: { name: data.name.trim() }
		}),
		'Failed to create organization'
	);

	return { success: true, organizationId: json.organizationId };
});

export const upgradeOrganization = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = requireAuthContext();
		const successUrl = `${event.url.origin}/portal/dashboard?org_upgrade_success=true&org_id=${data.id}`;
		const json = await unwrapResponse<{ redirectUrl?: string }>(
			event.locals.api.v1.billing.checkout.org[':id'].$post({
				param: { id: data.id },
				json: { successUrl }
			}),
			'Failed to initialize organization upgrade'
		);

		if ('redirectUrl' in json && json.redirectUrl) {
			return { redirectUrl: json.redirectUrl };
		}

		return { success: true, mockUpgraded: true };
	}
);

export const inviteMember = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required')),
		email: v.pipe(v.string(), v.email('A valid email address is required')),
		role: v.optional(v.picklist(['admin', 'member']), 'member')
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		const json = await unwrapResponse<{ inviteId: string; inviteUrl?: string }>(
			locals.api.v1.orgs[':id'].invites.$post({
				param: { id: data.organizationId },
				json: {
					email: data.email.trim().toLowerCase(),
					role: data.role || 'member'
				}
			}),
			'Failed to send invite'
		);

		return { success: true, inviteId: json.inviteId, inviteUrl: json.inviteUrl };
	}
);

export const manageSubscription = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		const json = await unwrapResponse<{ portalUrl: string }>(
			locals.api.v1.billing.portal[':orgId'].$post({
				param: { orgId: data.organizationId }
			}),
			'Failed to access billing portal'
		);

		return { success: true, portalUrl: json.portalUrl };
	}
);

export const cancelInvite = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Invite ID is required')),
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.orgs[':id'].invites[':inviteId'].$delete({
				param: {
					id: data.organizationId,
					inviteId: data.id
				}
			}),
			'Failed to cancel invitation'
		);

		return { success: true };
	}
);

export const removeMember = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required')),
		userId: v.pipe(v.string(), v.nonEmpty('User ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.orgs[':id'].members[':memberId'].$delete({
				param: {
					id: data.organizationId,
					memberId: data.userId
				}
			}),
			'Failed to remove team member'
		);

		return { success: true };
	}
);

export const createAccessKey = form(
	v.object({
		projectId: v.pipe(v.string(), v.nonEmpty('Project ID is required')),
		name: v.pipe(v.string(), v.nonEmpty('Key name is required')),
		maxUses: v.optional(v.number()),
		expiresAt: v.optional(v.string())
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		const json = await unwrapResponse<{ key: unknown }>(
			locals.api.v1.projects[':id'].keys.$post({
				param: { id: data.projectId },
				json: {
					name: data.name.trim(),
					maxUses: data.maxUses,
					expiresAt: data.expiresAt
				}
			}),
			'Failed to create access key'
		);

		return { success: true, key: json.key };
	}
);

export const toggleAccessKey = form(
	v.object({
		keyId: v.pipe(v.string(), v.nonEmpty('Key ID is required')),
		isActive: v.optional(v.boolean(), false)
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.projects.keys[':keyId'].$patch({
				param: { keyId: data.keyId },
				json: { isActive: data.isActive }
			}),
			'Failed to toggle access key'
		);

		return { success: true };
	}
);

export const deleteAccessKey = form(
	v.object({
		keyId: v.pipe(v.string(), v.nonEmpty('Key ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.projects.keys[':keyId'].$delete({
				param: { keyId: data.keyId }
			}),
			'Failed to delete access key'
		);

		return { success: true };
	}
);

export const leaveOrganization = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const { locals } = requireAuthContext();
		await unwrapResponse(
			locals.api.v1.orgs[':id'].leave.$post({
				param: { id: data.organizationId }
			}),
			'Failed to leave organization'
		);

		return { success: true };
	}
);
