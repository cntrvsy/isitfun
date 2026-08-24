<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { updateProfile } from './profile.remote';
	import Footer from '#lib/components/Footer.svelte';
	import { Shield, ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	let firstNameVal = $state('');
	let lastNameVal = $state('');
	let orgNameVal = $state('');

	$effect(() => {
		firstNameVal = data.profile?.firstName || data.user.name?.split(' ')[0] || '';
		lastNameVal = data.profile?.lastName || data.user.name?.split(' ').slice(1).join(' ') || '';
		orgNameVal = data.profile?.organizationName || '';
	});

	let isSaving = $state(false);
	let saveStatus = $state<string | null>(null);

	function showStatus(msg: string) {
		saveStatus = msg;
		setTimeout(() => {
			if (saveStatus === msg) saveStatus = null;
		}, 3000);
	}
</script>

<svelte:head>
	<title>Account Profile | Is It Fun?</title>
	<meta name="description" content="Manage your developer account settings and profile details." />
</svelte:head>

<main class="mx-auto mt-10 w-full max-w-3xl flex-1 px-6 pb-24">
		<!-- Page Title -->
		<div class="mb-8">
			<h1 class="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
			<p class="mt-1 text-xs text-slate-500">
				Manage your personal details, developer workspace profile, and authentication preferences.
			</p>
		</div>

		{#if saveStatus}
			<div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
				{saveStatus}
			</div>
		{/if}

		<div class="space-y-6">
			<!-- Account Identity Card -->
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">
					Account Identity
				</h2>

				<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
						<span class="block text-[11px] font-medium text-slate-500">Email Address</span>
						<span class="mt-1 block font-mono text-xs font-bold text-slate-900">{data.user.email}</span>
					</div>

					<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
						<span class="block text-[11px] font-medium text-slate-500">System Role</span>
						<span class="mt-1 inline-flex items-center gap-1 text-xs font-bold text-purple-700 capitalize">
							<Shield class="h-3.5 w-3.5" /> {data.user.role || 'Developer'}
						</span>
					</div>

					<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:col-span-2">
						<span class="block text-[11px] font-medium text-slate-500">Account ID</span>
						<span class="mt-1 block font-mono text-xs text-slate-700">{data.user.id}</span>
					</div>
				</div>
			</div>

			<!-- Profile Details Form -->
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">
					Developer Profile
				</h2>
				<p class="mt-1 text-xs text-slate-500">
					Your name and studio will appear on project invitations and team workspaces.
				</p>

				<form
					{...updateProfile.enhance(async ({ submit }: any) => {
						isSaving = true;
						try {
							if (await submit()) {
								showStatus('Profile updated successfully!');
								await invalidateAll();
							}
						} catch (e) {
							console.error(e);
						} finally {
							isSaving = false;
						}
					})}
					class="mt-6 space-y-4"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="firstName">
								First Name
							</label>
							<input
								id="firstName"
								placeholder="e.g. Jane"
								class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
								required
								bind:value={firstNameVal}
								{...updateProfile.fields.firstName.as('text')}
							/>
						</div>

						<div>
							<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="lastName">
								Last Name
							</label>
							<input
								id="lastName"
								placeholder="e.g. Doe"
								class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
								required
								bind:value={lastNameVal}
								{...updateProfile.fields.lastName.as('text')}
							/>
						</div>
					</div>

					<div>
						<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="organizationName">
							Studio / Organization Name (Optional)
						</label>
						<input
							id="organizationName"
							placeholder="e.g. Pixel Arts Studio"
							class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
							bind:value={orgNameVal}
							{...updateProfile.fields.organizationName.as('text')}
						/>
					</div>

					<div class="flex justify-end pt-4">
						<button
							type="submit"
							disabled={isSaving}
							class="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
						>
							{isSaving ? 'Saving...' : 'Save Profile Changes'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</main>

	<Footer />
