<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		deleteProject,
		upgradeProject,
		createOrganization,
		upgradeOrganization,
		inviteMember,
		cancelInvite,
		removeMember
	} from './dashboard.remote';
	import CreateProjectModal from '#lib/components/CreateProjectModal.svelte';
	import UploadModal from '#lib/components/UploadModal.svelte';
	import PlaytestChart from '#lib/components/charts/PlaytestChart.svelte';
	import ConsoleInspectorModal from '#lib/components/dashboard/ConsoleInspectorModal.svelte';
	import OnboardingTourModal from '#lib/components/dashboard/OnboardingTourModal.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { onMount } from 'svelte';
	let { data } = $props();

	// Svelte 5 Reactive States
	let showCreateModal = $state(false);
	let selectedProjectId = $state('');
	let showUploadModal = $state(false);
	let showOnboardingModal = $state(false);
	let origin = $state('https://isitfun.co.ke');

	// Multi-tenancy states
	let selectedWorkspaceId = $state('personal');
	let showCreateOrgModal = $state(false);
	let showOrgSettings = $state(false);
	let inviteEmail = $state('');
	let orgNameInput = $state('');

	let activeProjectAnalyticsId = $state<string | null>(null);
	let activeGuideTab = $state<'js' | 'godot' | 'unity' | 'phaser'>('js');

	const activeProject = $derived(data.projects.find((p) => p.id === activeProjectAnalyticsId));

	const projectSessions = $derived(
		activeProject
			? data.recentSessions.filter((session) => session.projectId === activeProject.id)
			: []
	);

	let showInspectorModal = $state(false);
	let inspectorSessionId = $state('');

	function inspectSession(session: (typeof data.recentSessions)[number]) {
		inspectorSessionId = session.id;
		showInspectorModal = true;
	}

	// Derived Workspace variables
	const activeWorkspaceProjects = $derived(
		selectedWorkspaceId === 'personal'
			? data.projects.filter((p) => !p.organizationId)
			: data.projects.filter((p) => p.organizationId === selectedWorkspaceId)
	);

	const activeOrg = $derived(
		selectedWorkspaceId === 'personal'
			? null
			: data.organizations.find((o) => o.id === selectedWorkspaceId)
	);

	// Developer-centric workspace aggregate metrics
	const workspaceTotalSessions = $derived(
		activeWorkspaceProjects.reduce((acc, p) => acc + (p.stats?.totalSessions || 0), 0)
	);

	const workspaceStorageUsedBytes = $derived(
		activeWorkspaceProjects.reduce(
			(acc, p) => acc + (p.projectQuotas?.[0]?.storageBytesUsed || 0),
			0
		)
	);

	const workspaceStorageMaxBytes = $derived(
		activeWorkspaceProjects.reduce((acc, p) => {
			const limit = p.tier === 'pro' ? 5000 * 1024 * 1024 : 250 * 1024 * 1024;
			return acc + limit;
		}, 0) || 250 * 1024 * 1024
	);

	const workspaceStorageUsedMB = $derived((workspaceStorageUsedBytes / (1024 * 1024)).toFixed(1));

	const workspaceStorageMaxMB = $derived((workspaceStorageMaxBytes / (1024 * 1024)).toFixed(0));

	const workspaceStoragePercent = $derived(
		Math.min(100, Math.round((workspaceStorageUsedBytes / (workspaceStorageMaxBytes || 1)) * 100))
	);

	onMount(() => {
		origin = window.location.origin;
	});

	// Create project state tracking
	let copyStatus = $state<Record<string, boolean>>({});

	function triggerCopy(projectId: string) {
		const playUrl = `${origin}/play/${projectId}`;
		navigator.clipboard.writeText(playUrl).then(() => {
			copyStatus[projectId] = true;
			setTimeout(() => {
				copyStatus[projectId] = false;
			}, 2000);
		});
	}

	function openUpload(projectId: string) {
		selectedProjectId = projectId;
		showUploadModal = true;
	}

	const selectedProjectTier = $derived(
		data.projects.find((p) => p.id === selectedProjectId)?.tier || 'free'
	);
</script>

<svelte:head>
	<title>Developer Portal | Is It Fun?</title>
	<meta
		name="description"
		content="Manage your playtests, upload game files, and review user satisfaction and telemetry."
	/>
</svelte:head>

<div
	class="flex min-h-screen flex-col bg-transparent font-sans text-slate-800 selection:bg-purple-300"
>
	<!-- Blueprint / Retro Top Navigation Bar -->
	<nav
		class="sticky top-0 z-30 flex items-center justify-between border-b border-purple-200/50 bg-white/40 px-6 py-4 backdrop-blur-md md:px-12"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center border border-slate-900 bg-slate-900 text-lg font-bold text-white shadow-md"
			>
				🎮
			</div>
			<div>
				<span class="font-mono text-lg font-black tracking-tight text-slate-900">IS IT FUN?</span>
				<span
					class="block font-mono text-[10px] font-bold tracking-widest text-purple-700 uppercase"
					>// DEVELOPER_PORTAL</span
				>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={() => (showOnboardingModal = true)}
				class="border border-purple-400 bg-purple-50 px-4 py-2 font-mono text-xs font-bold text-purple-900 uppercase transition-all hover:bg-purple-600 hover:text-white"
			>
				🏓 Onboarding Demo
			</button>
			<a
				href={resolve('/(app)/portal/profile')}
				class="border border-purple-200/80 bg-white/60 px-4 py-2 font-mono text-xs font-bold text-slate-800 uppercase transition-all hover:border-slate-900 hover:bg-white"
				>Profile</a
			>
			<form method="POST" action="/auth?/signOut">
				<button
					type="submit"
					class="border border-slate-900 bg-slate-900 px-4 py-2 font-mono text-xs font-bold text-white uppercase transition-all hover:bg-transparent hover:text-slate-900"
				>
					Sign Out
				</button>
			</form>
		</div>
	</nav>

	<!-- Dashboard Container -->
	<main class="relative z-10 mx-auto mt-10 w-full max-w-7xl flex-1 px-6 pb-24 lg:px-12">
		<!-- Workspace Switcher Ribbon -->

		<div
			class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-purple-200/50 pb-6"
		>
			<div class="flex items-center gap-3">
				<span class="font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
					>Workspace:</span
				>
				<div class="relative">
					<select
						bind:value={selectedWorkspaceId}
						class="rounded-lg border border-purple-200/80 bg-white/70 px-4 py-2 font-mono text-xs font-bold text-slate-900 shadow-xs transition-all focus:border-purple-600 focus:outline-none"
					>
						<option value="personal">👤 Personal Workspace</option>
						{#each data.organizations as org (org.id)}
							<option value={org.id}
								>🏢 {org.name} ({org.tier === 'team' ? 'Team Plan' : 'Free Team'})</option
							>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex gap-2">
				<button
					onclick={() => (showCreateOrgModal = true)}
					class="border border-purple-200/80 bg-white/80 px-4 py-2 font-mono text-xs font-bold text-slate-800 uppercase transition-all hover:border-slate-900 hover:bg-white"
				>
					＋ Create Team
				</button>
				{#if selectedWorkspaceId !== 'personal'}
					<button
						onclick={() => (showOrgSettings = !showOrgSettings)}
						class="border border-purple-300 bg-purple-100/50 px-4 py-2 font-mono text-xs font-bold text-purple-800 uppercase transition-all hover:border-purple-600 hover:bg-purple-200/60"
					>
						⚙️ Team Settings
					</button>
				{/if}
			</div>
		</div>

		<!-- Team Settings View -->
		{#if showOrgSettings && activeOrg}
			<div
				class="mb-12 rounded-3xl border border-purple-200/50 bg-white/60 p-8 shadow-xl backdrop-blur-md"
			>
				<div class="mb-6 flex items-center justify-between border-b border-purple-200/50 pb-4">
					<div>
						<h2 class="font-mono text-2xl font-black text-slate-900">
							Team Management: {activeOrg.name}
						</h2>
						<p class="text-xs text-slate-600">
							Manage memberships, invite teammates, and view your seat subscription billing.
						</p>
					</div>
					<button
						onclick={() => (showOrgSettings = false)}
						class="btn btn-circle text-slate-600 btn-ghost btn-sm">✕</button
					>
				</div>

				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Billing and Upgrades -->
					<div class="space-y-6 rounded-2xl border border-purple-200/60 bg-white/70 p-6 shadow-sm">
						<h3 class="font-mono text-sm font-bold text-slate-900 uppercase">
							[ Subscription Status ]
						</h3>
						<div class="flex flex-wrap items-center justify-between gap-4">
							<div>
								<span class="block font-mono text-[10px] font-bold text-slate-500 uppercase"
									>Active Tier</span
								>
								<span class="font-mono text-xl font-black text-purple-700 uppercase"
									>{activeOrg.tier === 'team' ? 'Team Plan ($5/seat)' : 'Free Team'}</span
								>
							</div>
							{#if activeOrg.tier === 'free'}
								<form
									{...upgradeOrganization.enhance(async ({ submit }) => {
										if (await submit()) {
											const res = upgradeOrganization.result;
											if (res && typeof res === 'object') {
												if ('redirectUrl' in res && res.redirectUrl) {
													window.location.href = String(res.redirectUrl);
												} else if ('success' in res && res.success) {
													alert(
														'Simulated payment successful! Team upgraded to Team Plan subscription.'
													);
													window.location.reload();
												}
											}
										}
									})}
								>
									<input {...upgradeOrganization.fields.id.as('hidden', activeOrg.id)} />
									<button
										type="submit"
										class="border border-slate-900 bg-slate-900 px-5 py-3 font-mono text-xs font-bold text-white uppercase shadow-md transition-all hover:bg-transparent hover:text-slate-900"
									>
										⚡ Upgrade to Team ($5/seat)
									</button>
								</form>
							{:else}
								<span
									class="badge border border-emerald-300 bg-emerald-100/80 px-3 py-1.5 font-mono text-xs font-bold text-emerald-800 uppercase"
									>💳 Active Subscription</span
								>
							{/if}
						</div>
					</div>

					<!-- Invites and Members -->
					<div class="space-y-6">
						<div class="rounded-2xl border border-purple-200/60 bg-white/70 p-6 shadow-sm">
							<h3 class="mb-4 font-mono text-sm font-bold text-slate-900 uppercase">
								[ Invite Teammate ]
							</h3>
							<form
								{...inviteMember.enhance(async ({ submit }) => {
									if (await submit()) {
										const res = inviteMember.result;
										if (res && typeof res === 'object' && 'inviteUrl' in res) {
											alert(`Invitation URL generated! Copy this to accept:\n\n${res.inviteUrl}`);
										}
										inviteEmail = '';
										window.location.reload();
									}
								})}
								class="flex gap-2"
							>
								<input {...inviteMember.fields.organizationId.as('hidden', activeOrg.id)} />
								<input
									placeholder="teammate@studio.com"
									class="input flex-1 rounded-lg border border-purple-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
									required
									bind:value={inviteEmail}
									{...inviteMember.fields.email.as('email')}
								/>
								<button
									type="submit"
									class="border border-slate-900 bg-slate-900 px-4 py-2 font-mono text-xs font-bold text-white uppercase transition-all hover:bg-transparent hover:text-slate-900"
									>Invite</button
								>
							</form>
						</div>

						<!-- Members list -->
						<div class="rounded-2xl border border-purple-200/60 bg-white/70 p-6 shadow-sm">
							<h3 class="mb-4 font-mono text-sm font-bold text-slate-900 uppercase">
								[ Workspace Members ({activeOrg.memberships.length}) ]
							</h3>
							<div class="divide-y divide-purple-100">
								{#each activeOrg.memberships as mem (mem.id)}
									<div class="flex items-center justify-between py-3">
										<div>
											<span class="block text-sm font-bold text-slate-900">{mem.user.name}</span>
											<span class="block font-mono text-xs text-slate-500">{mem.user.email}</span>
										</div>
										<div class="flex items-center gap-2">
											<span
												class="badge border border-purple-200 bg-purple-50 font-mono text-xs text-purple-700 uppercase"
												>{mem.role}</span
											>
											{#if activeOrg.ownerId !== mem.userId && activeOrg.ownerId === data.user?.id}
												<form
													{...removeMember.enhance(async ({ submit }) => {
														if (await submit()) window.location.reload();
													})}
												>
													<input
														{...removeMember.fields.organizationId.as('hidden', activeOrg.id)}
													/>
													<input {...removeMember.fields.userId.as('hidden', mem.userId)} />
													<button type="submit" class="btn font-mono text-rose-600 btn-ghost btn-xs"
														>Remove</button
													>
												</form>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Pending Invites list -->
						{#if activeOrg.invites && activeOrg.invites.length > 0}
							<div class="rounded-2xl border border-purple-200/60 bg-white/70 p-6 shadow-sm">
								<h3 class="mb-4 font-mono text-sm font-bold text-slate-900 uppercase">
									[ Pending Invites ]
								</h3>
								<div class="divide-y divide-purple-100 font-medium">
									{#each activeOrg.invites as inv (inv.id)}
										<div class="flex items-center justify-between py-3">
											<div>
												<span class="block font-mono text-xs font-bold text-slate-900"
													>{inv.email}</span
												>
												<span class="block font-mono text-[10px] text-slate-500"
													>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span
												>
											</div>
											<form
												{...cancelInvite.enhance(async ({ submit }) => {
													if (await submit()) window.location.reload();
												})}
											>
												<input {...cancelInvite.fields.id.as('hidden', inv.id)} />
												<input {...cancelInvite.fields.organizationId.as('hidden', activeOrg.id)} />
												<button
													type="submit"
													class="btn font-mono text-slate-500 btn-ghost btn-xs hover:text-rose-600"
													>Revoke</button
												>
											</form>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Welcome Header and Stats Overview -->
		<header class="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-center">
			<div>
				<div class="mb-2 font-mono text-xs font-bold tracking-widest text-purple-700 uppercase">
					[ METRICS_OBSERVED ]
				</div>
				<h1
					id="main-title"
					class="mb-3 font-mono text-4xl font-black tracking-tight text-slate-900 md:text-5xl"
				>
					{#if activeOrg}
						{activeOrg.name} Dashboard
					{:else}
						Game Dashboard
					{/if}
				</h1>
				<p class="max-w-xl text-base font-medium text-slate-600">
					Create, deploy, and monitor your browser playtests at the edge.
				</p>
			</div>
			<div>
				<button
					id="create-project-btn"
					onclick={() => (showCreateModal = true)}
					class="group inline-flex items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-6 py-4 font-mono text-xs font-bold tracking-wider text-white uppercase shadow-xl transition-all duration-150 hover:bg-transparent hover:text-slate-900"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					New Playtest Project
				</button>
			</div>
		</header>

		<!-- Statistics Ribbon -->
		<div class="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
			<div
				class="flex items-center justify-between rounded-2xl border border-purple-200/50 bg-white/40 p-6 shadow-xl backdrop-blur-md transition-all hover:border-purple-300"
			>
				<div>
					<span
						class="mb-1 block font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
						>Active Playtest Builds</span
					>
					<span class="font-mono text-3xl font-black text-slate-900"
						>{activeWorkspaceProjects.length}</span
					>
				</div>
				<div
					class="flex h-12 w-12 items-center justify-center border border-purple-200 bg-purple-50 text-xl"
				>
					🎮
				</div>
			</div>
			<div
				class="flex flex-col justify-between rounded-2xl border border-purple-200/50 bg-white/40 p-6 shadow-xl backdrop-blur-md transition-all hover:border-purple-300"
			>
				<div class="flex items-center justify-between">
					<div>
						<span
							class="mb-1 block font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
							>Storage Allocation</span
						>
						<span class="font-mono text-2xl font-black text-slate-900">
							{workspaceStorageUsedMB} MB
							<span class="text-xs font-medium text-slate-500">/ {workspaceStorageMaxMB} MB</span>
						</span>
					</div>
					<div
						class="flex h-10 w-10 items-center justify-center border border-indigo-200 bg-indigo-50 text-lg"
					>
						💾
					</div>
				</div>
				<div class="mt-3 w-full">
					<div class="mb-1 flex justify-between font-mono text-[10px] font-bold text-slate-500">
						<span>Quota Used</span>
						<span>{workspaceStoragePercent}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-purple-100">
						<div
							class="h-full rounded-full bg-linear-to-r from-purple-600 to-indigo-600 transition-all duration-500"
							style="width: {workspaceStoragePercent}%"
						></div>
					</div>
				</div>
			</div>
			<div
				class="flex items-center justify-between rounded-2xl border border-purple-200/50 bg-white/40 p-6 shadow-xl backdrop-blur-md transition-all hover:border-purple-300"
			>
				<div>
					<span
						class="mb-1 block font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
						>Total Playtest Sessions</span
					>
					<span class="font-mono text-3xl font-black text-emerald-700"
						>{workspaceTotalSessions}</span
					>
				</div>
				<div
					class="flex h-12 w-12 items-center justify-center border border-emerald-200 bg-emerald-50 text-xl"
				>
					🕹️
				</div>
			</div>
		</div>

		<!-- Projects Section -->
		<section>
			<h2
				class="mb-6 flex items-center gap-3 font-mono text-xl font-black tracking-tight text-slate-900 uppercase"
			>
				<span>Your Playtests</span>
				<span
					class="border border-purple-200 bg-white/80 px-2 py-0.5 font-mono text-xs text-purple-700"
					>{activeWorkspaceProjects.length}</span
				>
			</h2>

			{#if activeProjectAnalyticsId}
				{#if activeProject}
					<div
						class="rounded-3xl border border-purple-200/50 bg-white/40 p-8 shadow-2xl backdrop-blur-md"
					>
						<!-- Breadcrumb Header -->
						<div
							class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-purple-200/40 pb-6"
						>
							<div class="flex items-center gap-3">
								<button
									onclick={() => (activeProjectAnalyticsId = null)}
									class="border border-slate-900 bg-white px-4 py-2 font-mono text-xs font-bold text-slate-900 uppercase transition-all hover:bg-slate-900 hover:text-white"
								>
									← Back to Projects
								</button>
								<div class="h-4 w-px bg-purple-200"></div>
								<h3 class="font-mono text-2xl font-black text-slate-900">
									{activeProject.name}
									<span class="font-mono text-xs font-normal text-slate-500"
										>({activeProject.id})</span
									>
								</h3>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="border border-purple-200 bg-purple-50 px-2.5 py-1 font-mono text-[10px] font-bold text-purple-700 uppercase"
								>
									{activeProject.tier}
								</span>
								{#if activeProject.passwordProtected}
									<span
										class="border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-700 uppercase"
									>
										🔐 Private
									</span>
								{/if}
							</div>
						</div>

						<!-- Telemetry Aggregation Stats -->
						<div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
							<div class="rounded-2xl border border-purple-200/60 bg-white/60 p-5 shadow-xs">
								<span
									class="mb-1 block font-mono text-[10px] font-bold tracking-widest text-purple-700 uppercase"
									>Total Play Sessions</span
								>
								<span class="font-mono text-3xl font-black text-purple-900"
									>{activeProject.stats.totalSessions}</span
								>
							</div>
							<div class="rounded-2xl border border-purple-200/60 bg-white/60 p-5 shadow-xs">
								<span
									class="mb-1 block font-mono text-[10px] font-bold tracking-widest text-purple-700 uppercase"
									>Total Custom Logs</span
								>
								<span class="font-mono text-3xl font-black text-emerald-700"
									>{activeProject.stats.totalEvents}</span
								>
							</div>
						</div>

						<!-- Layerchart Visual Analytics -->
						<div class="mb-8">
							<PlaytestChart sessions={projectSessions} />
						</div>

						<!-- Export Data Options -->
						<div
							class="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-200/60 bg-white/60 p-6 shadow-sm"
						>
							<div>
								<h4 class="font-mono text-sm font-bold text-slate-900 uppercase">
									Export Raw Playtest Data
								</h4>
								<p class="text-xs font-medium text-slate-600">
									Download the complete dataset of playtest logs to feed into custom visualization
									tools, LLMs, or spreadsheets.
								</p>
							</div>
							<div class="flex flex-wrap gap-3">
								<a
									href={resolve('/(app)/portal/dashboard/projects/[id]/export/json', {
										id: activeProject.id
									})}
									download
									class="border border-purple-300 bg-purple-50 px-4 py-2 font-mono text-xs font-bold text-purple-800 uppercase transition-all hover:bg-purple-600 hover:text-white"
								>
									📥 JSON
								</a>
								<a
									href={resolve('/(app)/portal/dashboard/projects/[id]/export/csv', {
										id: activeProject.id
									})}
									download
									class="border border-indigo-300 bg-indigo-50 px-4 py-2 font-mono text-xs font-bold text-indigo-800 uppercase transition-all hover:bg-indigo-600 hover:text-white"
								>
									📥 CSV
								</a>
								<a
									href={resolve('/(app)/portal/dashboard/projects/[projectId]/export/zip', {
										projectId: activeProject.id
									})}
									download
									class="border border-emerald-300 bg-emerald-50 px-4 py-2 font-mono text-xs font-bold text-emerald-800 uppercase transition-all hover:bg-emerald-600 hover:text-white"
								>
									📦 Download ZIP
								</a>
							</div>
						</div>

						<!-- Playtest session list inspector -->
						<div class="space-y-4">
							<div class="flex items-center justify-between">
								<h4 class="font-mono text-xs font-bold tracking-wider text-purple-700 uppercase">
									Recent Playtest Sessions (Latest 30)
								</h4>
								<span
									class="border border-purple-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-600"
									>{projectSessions.length} sessions loaded</span
								>
							</div>

							{#if projectSessions.length === 0}
								<div
									class="rounded-2xl border border-dashed border-purple-200 bg-white/40 py-16 text-center"
								>
									<div
										class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-purple-200 bg-white text-2xl"
									>
										⏳
									</div>
									<h4 class="mb-1 font-mono text-sm font-bold text-slate-800 uppercase">
										Waiting for playtests...
									</h4>
									<p class="mx-auto max-w-md text-xs leading-relaxed text-slate-500">
										No playtest sessions have been received for this project yet. Use the code
										templates in the guide below to start sending data from your game.
									</p>
								</div>
							{:else}
								<div
									class="overflow-x-auto rounded-2xl border border-purple-200/60 bg-white/60 shadow-xs"
								>
									<table class="w-full border-collapse text-left text-xs">
										<thead>
											<tr
												class="border-b border-purple-200/60 bg-purple-50/50 font-mono text-[10px] font-bold tracking-wider text-purple-900 uppercase"
											>
												<th class="p-4">Started At</th>
												<th class="p-4">Session ID</th>
												<th class="p-4">Duration</th>
												<th class="p-4">Total Logs</th>
												<th class="p-4">Avg FPS</th>
												<th class="p-4">Sentiment</th>
												<th class="p-4">Status</th>
												<th class="p-4 text-right">Actions</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-purple-100 font-medium text-slate-700">
											{#each projectSessions as session (session.id)}
												<tr class="transition-colors hover:bg-purple-50/40">
													<td class="p-4 font-mono text-[10px] whitespace-nowrap text-slate-500">
														{new Date(session.createdAt).toLocaleString()}
													</td>
													<td
														class="p-4 font-mono text-[10px] font-bold text-purple-700"
														title={session.gpuRenderer ? `GPU: ${session.gpuRenderer}` : session.id}
													>
														{session.id.slice(0, 8)}...
													</td>
													<td class="p-4 font-mono whitespace-nowrap">
														{session.duration}s
													</td>
													<td class="p-4">
														<span
															class="border border-purple-200 bg-purple-50 px-2 py-0.5 font-mono text-xs font-semibold text-purple-900"
														>
															{session.logCount}
														</span>
													</td>
													<td class="p-4">
														{#if session.avgFps}
															<span
																class="border border-purple-300 bg-purple-100/60 px-2 py-0.5 font-mono text-xs font-bold text-purple-800"
															>
																{session.avgFps} FPS
															</span>
														{:else}
															<span class="font-mono text-[10px] text-slate-400">--</span>
														{/if}
													</td>
													<td class="p-4">
														{#if session.sentiment === 'fun'}
															<span
																class="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800"
																title={session.userComment || 'Playtest rated Fun'}
															>
																😀 FUN
															</span>
														{:else if session.sentiment === 'neutral'}
															<span
																class="border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
																title={session.userComment || 'Playtest rated Neutral'}
															>
																😐 OKAY
															</span>
														{:else if session.sentiment === 'unfun'}
															<span
																class="border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-800"
																title={session.userComment || 'Playtest rated Unfun'}
															>
																🙁 UNFUN
															</span>
														{:else}
															<span class="font-mono text-[10px] text-slate-400">--</span>
														{/if}
													</td>
													<td class="p-4">
														{#if session.hasCrashed}
															<span
																class="border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-800"
															>
																💥 CRASHED
															</span>
														{:else}
															<span
																class="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800"
															>
																✅ ACTIVE / OK
															</span>
														{/if}
													</td>
													<td class="p-4 text-right">
														<button
															onclick={() => inspectSession(session)}
															class="border border-slate-900 bg-white px-3 py-1 font-mono text-[10px] font-bold text-slate-900 uppercase transition-all hover:bg-slate-900 hover:text-white"
														>
															🔍 Inspect Logs
														</button>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{:else if activeWorkspaceProjects.length === 0}
				<div
					class="rounded-3xl border border-dashed border-purple-200/70 bg-white/40 px-6 py-20 text-center shadow-xl backdrop-blur-md"
				>
					<div
						class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-purple-200 bg-white text-3xl shadow-xs"
					>
						👾
					</div>
					<h3 class="mb-2 font-mono text-xl font-bold text-slate-900 uppercase">
						No playtests found
					</h3>
					<p class="mx-auto mb-8 max-w-md font-medium text-slate-600">
						Ready to test if your game is actually fun? Create a new project to start streaming
						telemetry.
					</p>
					<button
						onclick={() => (showCreateModal = true)}
						class="border border-slate-900 bg-slate-900 px-6 py-3 font-mono text-xs font-bold text-white uppercase shadow-lg transition-all hover:bg-transparent hover:text-slate-900"
					>
						Create First Project
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
					{#each activeWorkspaceProjects as p (p.id)}
						{@const del = deleteProject.for(p.id)}
						{@const upgrade = upgradeProject.for(p.id)}
						<article
							class="group relative rounded-3xl border border-purple-200/50 bg-white/40 p-8 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-2xl"
						>
							<div class="relative z-10 mb-4 flex items-start justify-between">
								<div>
									<h3
										class="mb-1 font-mono text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-purple-700"
									>
										{p.name}
									</h3>
									<span class="font-mono text-xs font-medium text-slate-500">
										Created on {new Date(p.createdAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</span>
								</div>
								<div class="flex items-center gap-2">
									{#if p.passwordProtected}
										<span
											class="border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] font-bold text-amber-700 uppercase"
										>
											🔐 Private
										</span>
									{:else}
										<span
											class="border border-purple-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-600 uppercase"
										>
											🌐 Public
										</span>
									{/if}
									<span
										class="border border-purple-200 bg-purple-50 px-2 py-1 font-mono text-[10px] font-bold text-purple-700 uppercase"
									>
										{p.tier}
									</span>
									{#if p.payments && p.payments.length > 0}
										<span
											class="border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[10px] font-bold text-emerald-800 uppercase"
											title="Creem Order ID: {p.payments[0].creemOrderId || 'Local'}"
										>
											💳 Paid
										</span>
									{/if}
								</div>
							</div>

							<!-- Telemetry Stats mockup or link -->
							<div
								class="relative z-10 mb-6 flex justify-between divide-x divide-purple-200/60 rounded-2xl border border-purple-200/60 bg-white/70 p-4 text-center shadow-xs"
							>
								<div class="flex-1 px-1">
									<span
										class="mb-1 block font-mono text-[9px] font-bold tracking-wider text-purple-700 uppercase"
										>Telemetry ID</span
									>
									<code class="font-mono text-xs font-bold text-slate-900">{p.id}</code>
								</div>
								<div class="flex-1 px-1">
									<span
										class="mb-1 block font-mono text-[9px] font-bold tracking-wider text-purple-700 uppercase"
										>Writes</span
									>
									<span class="font-mono text-xs font-bold text-slate-900">
										{p.projectQuotas?.[0]?.monthlyWriteCount || 0} / {p.projectQuotas?.[0]
											?.maxWriteLimit || (p.tier === 'free' ? 5000 : 100000)}
									</span>
								</div>
								<div class="flex-1 px-1">
									<span
										class="mb-1 block font-mono text-[9px] font-bold tracking-wider text-purple-700 uppercase"
										>Storage</span
									>
									<span class="font-mono text-xs font-bold text-slate-900">
										{((p.projectQuotas?.[0]?.storageBytesUsed || 0) / (1024 * 1024)).toFixed(2)} MB
									</span>
								</div>
							</div>

							<!-- Action Buttons -->
							<div
								class="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-purple-200/40 pt-4"
							>
								<div class="flex flex-wrap gap-2">
									<button
										onclick={() => openUpload(p.id)}
										class="border border-purple-300 bg-purple-50 px-3 py-1.5 font-mono text-xs font-bold text-purple-800 uppercase transition-all hover:bg-purple-600 hover:text-white"
										aria-label="Upload game bundle"
									>
										☁️ Upload ZIP
									</button>
									<button
										onclick={() => triggerCopy(p.id)}
										class="border border-purple-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800 uppercase transition-all hover:border-slate-900"
										aria-label="Copy play link"
									>
										{#if copyStatus[p.id]}
											✨ Copied!
										{:else}
											🔗 Play Link
										{/if}
									</button>
									<button
										onclick={() => (activeProjectAnalyticsId = p.id)}
										class="border border-indigo-300 bg-indigo-50 px-3 py-1.5 font-mono text-xs font-bold text-indigo-800 uppercase transition-all hover:bg-indigo-600 hover:text-white"
										aria-label="View Telemetry"
									>
										📊 Analytics
									</button>

									{#if p.tier === 'free'}
										<form
											{...upgrade.enhance(async ({ submit }) => {
												try {
													if (await submit()) {
														const res = upgrade.result;
														if (res && typeof res === 'object') {
															if ('redirectUrl' in res && res.redirectUrl) {
																window.location.href = String(res.redirectUrl);
															} else if ('success' in res && res.success) {
																alert(
																	'Simulated payment successful! Project upgraded to Project Pass.'
																);
																window.location.reload();
															}
														}
													}
												} catch (e) {
													console.error(e);
												}
											})}
											class="inline"
										>
											<input {...upgrade.fields.id.as('hidden', p.id)} />
											<button
												type="submit"
												class="border border-slate-900 bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold text-white uppercase transition-all hover:bg-transparent hover:text-slate-900"
												aria-label="Upgrade project"
											>
												⚡ Upgrade (£15)
											</button>
										</form>
									{/if}
								</div>

								<!-- Delete Project (Remote Function) -->
								<form {...del}>
									<input {...del.fields.id.as('hidden', p.id)} />
									<button
										type="submit"
										class="btn btn-circle text-slate-400 btn-ghost transition-colors btn-sm hover:bg-rose-100 hover:text-rose-600"
										aria-label="Delete project"
										onclick={(e) => {
											if (
												!confirm(
													'Are you absolutely sure? This will purge all game assets and telemetry permanently.'
												)
											)
												e.preventDefault();
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</form>
							</div>
						</article>
					{/each}
				</div>
			{/if}

			<!-- Integration & Telemetry Guide -->
			<div
				class="mt-16 rounded-3xl border border-purple-200/50 bg-white/40 p-8 shadow-xl backdrop-blur-md"
			>
				<h2
					class="mb-4 flex items-center gap-2 font-mono text-2xl font-black tracking-tight text-slate-900"
				>
					<span>🛠️ TELEMETRY INTEGRATION GUIDE</span>
				</h2>
				<p class="mb-6 text-sm font-medium text-slate-600">
					IsItFun exposes a simple window-level logging API. Embed the script and call our logging
					function from any HTML5 engine.
				</p>

				<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
					<!-- Setup Snippet -->
					<div class="space-y-6 lg:col-span-2">
						<div>
							<h3
								class="mb-3 font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
							>
								1. Include script (Automatically injected on hosted builds)
							</h3>
							<div
								class="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 shadow-inner"
							>
								<pre><code
										>&lt;script 
  src="{origin}/assets/overlay-widget.js" 
  data-project="YOUR_PROJECT_ID"&gt;&lt;/script&gt;</code
									></pre>
							</div>
						</div>

						<div>
							<div class="mb-4 flex items-center justify-between">
								<h3 class="font-mono text-xs font-bold tracking-widest text-purple-700 uppercase">
									2. Call Log API from your game engine
								</h3>
							</div>

							<!-- Guide Tabs -->
							<div class="mb-4 flex border-b border-purple-200 font-mono text-xs font-bold">
								<button
									onclick={() => (activeGuideTab = 'js')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'js'
										? 'border-purple-600 text-purple-700'
										: 'border-transparent text-slate-500 hover:text-slate-900'}"
								>
									JavaScript
								</button>
								<button
									onclick={() => (activeGuideTab = 'godot')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'godot'
										? 'border-purple-600 text-purple-700'
										: 'border-transparent text-slate-500 hover:text-slate-900'}"
								>
									Godot 4
								</button>
								<button
									onclick={() => (activeGuideTab = 'unity')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'unity'
										? 'border-purple-600 text-purple-700'
										: 'border-transparent text-slate-500 hover:text-slate-900'}"
								>
									Unity WebGL
								</button>
								<button
									onclick={() => (activeGuideTab = 'phaser')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'phaser'
										? 'border-purple-600 text-purple-700'
										: 'border-transparent text-slate-500 hover:text-slate-900'}"
								>
									Phaser
								</button>
							</div>

							<div
								class="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs font-medium text-slate-200 shadow-inner"
							>
								{#if activeGuideTab === 'js'}
									<pre><code
											>// Native JS / HTML5 Canvas
window.IsItFun?.log("level_complete", &#123;
  level_id: "world_1_1",
  score: 12500,
  coins: 42
&#125;);</code
										></pre>
								{:else if activeGuideTab === 'godot'}
									<pre><code
											># Godot 4 GDScript Web Bridge
func log_event(event_name: String, data: Dictionary):
    if OS.has_feature("web"):
        var js_code = "window.IsItFun.log(%s, %s);" % [JSON.stringify(event_name), JSON.stringify(data)]
        JavaScriptBridge.eval(js_code, true)</code
										></pre>
								{:else if activeGuideTab === 'unity'}
									<pre><code
											>// 1. Create Assets/Plugins/WebGL/IsItFunBridge.jslib:
// mergeInto(LibraryManager.library, &#123;
//   IsItFunLog: function(evtPtr, jsonPtr) &#123;
//     var evt = UTF8ToString(evtPtr);
//     var data = JSON.parse(UTF8ToString(jsonPtr));
//     if (window.IsItFun) window.IsItFun.log(evt, data);
//   &#125;
// &#125;);

// 2. In Unity C# script:
[DllImport("__Internal")]
private static extern void IsItFunLog(string eventName, string jsonPayload);

public void LogEvent(string name, object data) &#123;
    #if !UNITY_EDITOR && UNITY_WEBGL
    IsItFunLog(name, JsonUtility.ToJson(data));
    #endif
&#125;</code
										></pre>
								{:else if activeGuideTab === 'phaser'}
									<pre><code
											>// Phaser 3 Scene Event Logging
this.events.on('score_changed', (newScore) => &#123;
    window.IsItFun?.log("score_update", &#123; score: newScore &#125;);
&#125;);</code
										></pre>
								{/if}
							</div>
						</div>
					</div>

					<!-- Limits and retention -->
					<div
						class="h-fit space-y-4 rounded-2xl border border-purple-200/60 bg-white/70 p-6 shadow-xs"
					>
						<h3 class="font-mono text-xs font-bold tracking-wider text-purple-700 uppercase">
							Security & Rate Limits
						</h3>

						<div class="flex items-start gap-3">
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-purple-200 bg-purple-50 text-xs"
							>
								🛡️
							</div>
							<div>
								<h4 class="font-mono text-xs font-bold text-slate-900">
									Daily Telemetry Rate Limit
								</h4>
								<p class="text-[11px] leading-relaxed font-medium text-slate-600">
									Projects have a protective limit of 5,000 logs/day to guard against infinite game
									loops and spam.
								</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-purple-200 bg-purple-50 text-xs"
							>
								🆓
							</div>
							<div>
								<h4 class="font-mono text-xs font-bold text-slate-900">Free Tier Log decay</h4>
								<p class="text-[11px] leading-relaxed font-medium text-slate-600">
									Free projects have a 7-day logs decay protocol. Clean records are retained for
									week-long prototype sessions.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	</main>

	<Footer />

	<CreateProjectModal
		bind:show={showCreateModal}
		organizationId={selectedWorkspaceId === 'personal' ? '' : selectedWorkspaceId}
	/>

	<UploadModal
		bind:show={showUploadModal}
		projectId={selectedProjectId}
		isFree={selectedProjectTier === 'free'}
	/>

	{#if showCreateOrgModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
		>
			<div
				class="w-full max-w-md rounded-3xl border border-purple-200/60 bg-white/95 p-8 shadow-2xl backdrop-blur-xl"
			>
				<header class="mb-6 flex items-center justify-between">
					<h3 class="font-mono text-xl font-black text-slate-900">Create Workspace Team</h3>
					<button
						onclick={() => (showCreateOrgModal = false)}
						class="btn btn-circle text-slate-600 btn-ghost btn-sm">✕</button
					>
				</header>
				<form
					{...createOrganization.enhance(async ({ submit }) => {
						if (await submit()) {
							const res = createOrganization.result;
							if (res && typeof res === 'object' && 'organizationId' in res) {
								selectedWorkspaceId = String(res.organizationId);
							}
							showCreateOrgModal = false;
							orgNameInput = '';
							window.location.reload();
						}
					})}
					class="space-y-4"
				>
					<div class="form-control">
						<label class="label mb-2" for="org-name-input">
							<span class="label-text font-mono text-xs font-bold text-purple-700 uppercase"
								>Team / Studio Name</span
							>
						</label>
						<input
							id="org-name-input"
							placeholder="e.g. Pixel Arts Studio"
							class="input w-full rounded-xl border border-purple-200 bg-white text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
							required
							bind:value={orgNameInput}
							{...createOrganization.fields.name.as('text')}
						/>
					</div>
					<div class="flex justify-end gap-3 border-t border-purple-200/60 pt-4">
						<button
							type="button"
							onclick={() => (showCreateOrgModal = false)}
							class="btn rounded-xl font-mono text-slate-600 btn-ghost">Cancel</button
						>
						<button
							type="submit"
							class="border border-slate-900 bg-slate-900 px-4 py-2 font-mono text-xs font-bold text-white uppercase shadow-md hover:bg-transparent hover:text-slate-900"
							>Create Team</button
						>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if activeProjectAnalyticsId}
		<ConsoleInspectorModal
			isOpen={showInspectorModal}
			sessionId={inspectorSessionId}
			projectId={activeProjectAnalyticsId}
			onClose={() => (showInspectorModal = false)}
		/>
	{/if}

	<OnboardingTourModal isOpen={showOnboardingModal} onClose={() => (showOnboardingModal = false)} />
</div>
