import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

export const createProject = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Project name is required')),
		passwordProtected: v.optional(v.boolean(), false),
		password: v.optional(v.string()),
		organizationId: v.optional(v.string())
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.projects.$post({
			json: {
				name: data.name.trim(),
				passwordProtected: data.passwordProtected,
				password: data.password,
				organizationId: data.organizationId || null
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to create project');
		}

		const json = await res.json();
		return { success: true, projectId: json.projectId };
	}
);

export const deleteProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.projects[':id'].$delete({
			param: { id: data.id }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to delete project');
		}

		return { success: true };
	}
);

export const upgradeProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const successUrl = `${event.url.origin}/portal/dashboard?upgrade_success=true&project_id=${data.id}`;
		const res = await locals.api.v1.billing.checkout.project[':id'].$post({
			param: { id: data.id },
			json: { successUrl }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to initialize project upgrade');
		}

		const json = await res.json();
		if ('redirectUrl' in json && json.redirectUrl) {
			return { redirectUrl: json.redirectUrl };
		}

		return { success: true, mockUpgraded: true };
	}
);

export const createOrganization = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Organization name is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.orgs.$post({
			json: { name: data.name.trim() }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to create organization');
		}

		const json = await res.json();
		return { success: true, organizationId: json.organizationId };
	}
);

export const upgradeOrganization = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const successUrl = `${event.url.origin}/portal/dashboard?org_upgrade_success=true&org_id=${data.id}`;
		const res = await locals.api.v1.billing.checkout.org[':id'].$post({
			param: { id: data.id },
			json: { successUrl }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to initialize organization upgrade');
		}

		const json = await res.json();
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
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.orgs[':id'].invites.$post({
			param: { id: data.organizationId },
			json: {
				email: data.email.trim().toLowerCase(),
				role: data.role || 'member'
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to send invite');
		}

		const json = await res.json();
		return { success: true, inviteId: json.inviteId };
	}
);

export const cancelInvite = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Invite ID is required')),
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.orgs[':id'].invites[':inviteId'].$delete({
			param: {
				id: data.organizationId,
				inviteId: data.id
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to cancel invitation');
		}

		return { success: true };
	}
);

export const removeMember = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required')),
		userId: v.pipe(v.string(), v.nonEmpty('User ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.orgs[':id'].members[':memberId'].$delete({
			param: {
				id: data.organizationId,
				memberId: data.userId
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to remove team member');
		}

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
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.projects[':id'].keys.$post({
			param: { id: data.projectId },
			json: {
				name: data.name.trim(),
				maxUses: data.maxUses,
				expiresAt: data.expiresAt
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to create access key');
		}

		const json = await res.json();
		return { success: true, key: json.key };
	}
);

export const toggleAccessKey = form(
	v.object({
		keyId: v.pipe(v.string(), v.nonEmpty('Key ID is required')),
		isActive: v.optional(v.boolean(), false)
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request event missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.projects.keys[':keyId'].$patch({
			param: { keyId: data.keyId },
			json: { isActive: data.isActive }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to toggle access key');
		}

		return { success: true };
	}
);

export const deleteAccessKey = form(
	v.object({
		keyId: v.pipe(v.string(), v.nonEmpty('Key ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request event missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.projects.keys[':keyId'].$delete({
			param: { keyId: data.keyId }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to delete access key');
		}

		return { success: true };
	}
);

export const leaveOrganization = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.orgs[':id'].leave.$post({
			param: { id: data.organizationId }
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to leave organization');
		}

		return { success: true };
	}
);
