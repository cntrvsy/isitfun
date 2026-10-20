<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import {
		upgradeOrganization,
		manageSubscription,
		inviteMember,
		cancelInvite,
		removeMember,
		leaveOrganization
	} from '../../../routes/(app)/portal/dashboard/dashboard.remote';
	import { X, CreditCard, Trash2, LogOut, Copy } from '@lucide/svelte';

	interface MemberUser {
		id: string;
		name: string | null;
		email: string;
	}

	interface OrgMembership {
		id: string;
		userId: string;
		role: string;
		user: MemberUser;
	}

	interface OrgInvite {
		id: string;
		email: string;
		expiresAt: Date | string;
	}

	interface Organization {
		id: string;
		name: string;
		tier: string | null;
		ownerId: string;
		memberships: OrgMembership[];
		invites: OrgInvite[];
	}

	interface Props {
		activeOrg: Organization;
		userId?: string;
		show: boolean;
		onClose: () => void;
	}

	let { activeOrg, userId, show, onClose }: Props = $props();

	let inviteEmail = $state('');
	let generatedInviteUrl = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);

	function showStatus(msg: string) {
		statusMessage = msg;
		setTimeout(() => {
			if (statusMessage === msg) statusMessage = null;
		}, 4000);
	}
</script>

{#if show && activeOrg}
	<div class="mb-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
		<div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
			<div>
				<h2 class="text-xl font-bold tracking-tight text-slate-900">
					Team Settings: {activeOrg.name}
				</h2>
				<p class="text-xs text-slate-500">
					Manage memberships, invite collaborators, and manage seat billing.
				</p>
			</div>
			<button
				onclick={onClose}
				class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				aria-label="Close team settings"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		{#if statusMessage}
			<div
				class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800"
			>
				{statusMessage}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Subscription Billing -->
			<div class="space-y-6 rounded-xl border border-slate-100 bg-slate-50/70 p-6">
				<h3 class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
					Subscription & Plan
				</h3>
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div>
						<span class="block text-[11px] text-slate-500">Current Plan</span>
						<span class="text-base font-bold text-slate-900">
							{activeOrg.tier === 'team' ? 'Team Plan (£5/seat)' : 'Free Team'}
						</span>
					</div>
					{#if activeOrg.tier === 'free'}
						<form
							{...upgradeOrganization.enhance(async ({ submit }: any) => {
								if (await submit()) {
									const res = upgradeOrganization.result;
									if (res && typeof res === 'object') {
										if ('redirectUrl' in res && res.redirectUrl) {
											window.location.href = String(res.redirectUrl);
										} else if ('success' in res && res.success) {
											showStatus('Team upgraded to Team Plan subscription!');
											await refreshAll();
										}
									}
								}
							})}
						>
							<input {...upgradeOrganization.fields.id.as('hidden', activeOrg.id)} />
							<button
								type="submit"
								class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800"
							>
								Upgrade to Team (£5/seat)
							</button>
						</form>
					{:else}
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
							>
								<CreditCard class="h-3.5 w-3.5" /> Active Subscription
							</span>
							{#if activeOrg.ownerId === userId}
								<form
									{...manageSubscription.enhance(async ({ submit }: any) => {
										if (await submit()) {
											const res = manageSubscription.result;
											if (res && typeof res === 'object' && 'portalUrl' in res && res.portalUrl) {
												window.location.href = String(res.portalUrl);
											}
										}
									})}
								>
									<input {...manageSubscription.fields.organizationId.as('hidden', activeOrg.id)} />
									<button
										type="submit"
										class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
									>
										Manage Subscription
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Invites and Members -->
			<div class="space-y-6">
				<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-6">
					<h3 class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						Invite Teammate
					</h3>
					<form
						{...inviteMember.enhance(async ({ submit }: any) => {
							if (await submit()) {
								const res = inviteMember.result;
								if (res && typeof res === 'object' && 'inviteUrl' in res && res.inviteUrl) {
									generatedInviteUrl = String(res.inviteUrl);
									showStatus('Invitation link generated!');
								}
								inviteEmail = '';
								await refreshAll();
							}
						})}
						class="flex gap-2"
					>
						<input {...inviteMember.fields.organizationId.as('hidden', activeOrg.id)} />
						<input
							placeholder="collaborator@studio.com"
							class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
							required
							bind:value={inviteEmail}
							{...inviteMember.fields.email.as('email')}
						/>
						<button
							type="submit"
							class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
						>
							Invite
						</button>
					</form>

					{#if generatedInviteUrl}
						<div class="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
							<div class="mb-1 flex items-center justify-between">
								<span class="text-[10px] font-bold text-purple-800 uppercase">
									Direct Invite Link:
								</span>
								<button
									type="button"
									onclick={() => {
										if (generatedInviteUrl) {
											navigator.clipboard.writeText(generatedInviteUrl);
											showStatus('Invite link copied to clipboard!');
										}
									}}
									class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:underline"
								>
									<Copy class="h-3 w-3" /> Copy Link
								</button>
							</div>
							<code class="block font-mono text-[11px] break-all text-slate-800 select-all">
								{generatedInviteUrl}
							</code>
						</div>
					{/if}
				</div>

				<!-- Members List -->
				<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-6">
					<h3 class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						Team Members ({activeOrg.memberships.length})
					</h3>
					<div class="divide-y divide-slate-100">
						{#each activeOrg.memberships as mem (mem.id)}
							<div class="flex items-center justify-between py-2.5">
								<div>
									<span class="block text-xs font-bold text-slate-900"
										>{mem.user.name || 'Anonymous User'}</span
									>
									<span class="block font-mono text-[11px] text-slate-500">{mem.user.email}</span>
								</div>
								<div class="flex items-center gap-2">
									<span
										class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase"
									>
										{mem.role}
									</span>
									{#if activeOrg.ownerId !== mem.userId && activeOrg.ownerId === userId}
										<form
											{...removeMember.enhance(async ({ submit }: any) => {
												if (await submit()) {
													showStatus('Member removed');
													await refreshAll();
												}
											})}
										>
											<input {...removeMember.fields.organizationId.as('hidden', activeOrg.id)} />
											<input {...removeMember.fields.userId.as('hidden', mem.userId)} />
											<button
												type="submit"
												class="p-1 text-slate-400 hover:text-rose-600"
												aria-label="Remove member"
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</form>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Pending Invites List -->
				{#if activeOrg.invites && activeOrg.invites.length > 0}
					<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-6">
						<h3 class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
							Pending Invites
						</h3>
						<div class="divide-y divide-slate-100">
							{#each activeOrg.invites as inv (inv.id)}
								<div class="flex items-center justify-between py-2.5">
									<div>
										<span class="block font-mono text-xs font-semibold text-slate-900"
											>{inv.email}</span
										>
										<span class="block text-[10px] text-slate-400">
											Expires {new Date(inv.expiresAt).toLocaleDateString()}
										</span>
									</div>
									<form
										{...cancelInvite.enhance(async ({ submit }: any) => {
											if (await submit()) {
												showStatus('Invite revoked');
												await refreshAll();
											}
										})}
									>
										<input {...cancelInvite.fields.id.as('hidden', inv.id)} />
										<input {...cancelInvite.fields.organizationId.as('hidden', activeOrg.id)} />
										<button
											type="submit"
											class="text-xs font-semibold text-slate-400 hover:text-rose-600"
										>
											Revoke
										</button>
									</form>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Non-owner Leave Team action -->
				{#if activeOrg.ownerId !== userId}
					<div class="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
						<div class="flex items-center justify-between">
							<div>
								<span class="block text-xs font-bold text-rose-900">Leave Team</span>
								<span class="block text-[11px] text-rose-700"
									>Remove yourself from this workspace</span
								>
							</div>
							<form
								{...leaveOrganization.enhance(async ({ submit }: any) => {
									if (confirm('Are you sure you want to leave this team workspace?')) {
										if (await submit()) {
											onClose();
											await refreshAll();
										}
									}
								})}
							>
								<input {...leaveOrganization.fields.organizationId.as('hidden', activeOrg.id)} />
								<button
									type="submit"
									class="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
								>
									<LogOut class="h-3.5 w-3.5" /> Leave Team
								</button>
							</form>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
