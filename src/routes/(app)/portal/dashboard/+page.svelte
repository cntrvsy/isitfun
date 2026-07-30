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
	import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import PlaytestChart from '$lib/components/charts/PlaytestChart.svelte';
	import ConsoleInspectorModal from '$lib/components/dashboard/ConsoleInspectorModal.svelte';
	import { onMount } from 'svelte';
	let { data } = $props();

	// Svelte 5 Reactive States
	let showCreateModal = $state(false);
	let selectedProjectId = $state('');
	let showUploadModal = $state(false);
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

<main class="relative min-h-screen overflow-hidden bg-slate-950 pb-24 font-sans text-slate-100">
	<!-- Decorative background glows -->
	<div
		class="pointer-events-none absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[120px]"
	></div>
	<div
		class="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]"
	></div>

	<!-- Premium Top Navigation Bar -->
	<nav
		class="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-4 backdrop-blur-md"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-purple-600 to-indigo-600 text-xl font-bold shadow-lg shadow-purple-500/25"
			>
				🎮
			</div>
			<div>
				<span
					class="bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
					>IsItFun</span
				>
				<span class="block text-xs font-semibold tracking-wider text-slate-400 uppercase"
					>Developer Portal</span
				>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<a
				href={resolve('/(app)/portal/profile')}
				class="btn text-slate-300 btn-ghost btn-sm hover:text-white">Profile</a
			>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="btn rounded-lg btn-outline btn-sm btn-error">Sign Out</button>
			</form>
		</div>
	</nav>

	<!-- Dashboard Container -->
	<div class="relative z-10 mx-auto mt-12 max-w-6xl px-6">
		<!-- Workspace Switcher Ribbon -->
		<div
			class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6"
		>
			<div class="flex items-center gap-3">
				<span class="text-xs font-bold tracking-wider text-slate-500 uppercase">Workspace:</span>
				<div class="relative">
					<select
						bind:value={selectedWorkspaceId}
						class="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all focus:border-purple-500 focus:outline-none"
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
					class="btn rounded-xl border border-slate-800 bg-slate-900/45 px-4 font-bold text-slate-300 btn-sm hover:bg-slate-800 hover:text-white"
				>
					＋ Create Team
				</button>
				{#if selectedWorkspaceId !== 'personal'}
					<button
						onclick={() => (showOrgSettings = !showOrgSettings)}
						class="bg-indigo-655/20 btn rounded-xl border border-indigo-500/20 px-4 font-bold text-indigo-300 btn-sm hover:bg-indigo-600 hover:text-white"
					>
						⚙️ Team Settings
					</button>
				{/if}
			</div>
		</div>

		<!-- Team Settings View -->
		{#if showOrgSettings && activeOrg}
			<div class="mb-12 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-md">
				<div class="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
					<div>
						<h2 class="text-2xl font-black text-white">Team Management: {activeOrg.name}</h2>
						<p class="text-xs text-slate-500">
							Manage memberships, invite teammates, and view your seat subscription billing.
						</p>
					</div>
					<button onclick={() => (showOrgSettings = false)} class="btn btn-circle btn-ghost btn-sm"
						>✕</button
					>
				</div>

				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Billing and Upgrades -->
					<div class="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
						<h3 class="text-lg font-bold text-slate-200">Subscription Status</h3>
						<div class="flex flex-wrap items-center justify-between gap-4">
							<div>
								<span class="block text-xs font-bold text-slate-500 uppercase">Active Tier</span>
								<span class="text-xl font-black text-purple-400 uppercase"
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
										class="btn rounded-xl border-none bg-linear-to-r from-amber-500 to-orange-500 font-extrabold text-slate-950 shadow-lg"
									>
										⚡ Upgrade to Team ($5/seat)
									</button>
								</form>
							{:else}
								<span
									class="badge border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 uppercase"
									>💳 Active Subscription</span
								>
							{/if}
						</div>
					</div>

					<!-- Invites and Members -->
					<div class="space-y-6">
						<div class="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
							<h3 class="mb-4 text-lg font-bold text-slate-200">Invite Teammate</h3>
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
									class="input flex-1 rounded-xl border border-slate-800 bg-slate-950 text-sm text-white placeholder-slate-700 focus:border-purple-500 focus:outline-none"
									required
									bind:value={inviteEmail}
									{...inviteMember.fields.email.as('email')}
								/>
								<button
									type="submit"
									class="btn rounded-xl border-none bg-purple-600 px-4 font-bold text-white btn-sm"
									>Invite</button
								>
							</form>
						</div>

						<!-- Members list -->
						<div class="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
							<h3 class="mb-4 text-lg font-bold text-slate-200">
								Workspace Members ({activeOrg.memberships.length})
							</h3>
							<div class="divide-y divide-slate-800">
								{#each activeOrg.memberships as mem (mem.id)}
									<div class="flex items-center justify-between py-3">
										<div>
											<span class="block text-sm font-bold text-slate-200">{mem.user.name}</span>
											<span class="block text-xs text-slate-500">{mem.user.email}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="badge border-none bg-slate-800 badge-sm text-slate-400 uppercase"
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
													<button type="submit" class="btn text-rose-500 btn-ghost btn-xs"
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
							<div class="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
								<h3 class="mb-4 text-lg font-bold text-slate-200">Pending Invites</h3>
								<div class="divide-y divide-slate-800 font-medium">
									{#each activeOrg.invites as inv (inv.id)}
										<div class="flex items-center justify-between py-3">
											<div>
												<span class="block text-sm font-bold text-slate-200">{inv.email}</span>
												<span class="block text-xs text-slate-500"
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
													class="btn text-slate-500 btn-ghost btn-xs hover:text-rose-500"
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
				<h1
					id="main-title"
					class="mb-2 bg-linear-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl"
				>
					{#if activeOrg}
						{activeOrg.name} Dashboard
					{:else}
						Game Dashboard
					{/if}
				</h1>
				<p class="text-lg text-slate-400">
					Create, deploy, and monitor your browser playtests at the edge.
				</p>
			</div>
			<div>
				<button
					id="create-project-btn"
					onclick={() => (showCreateModal = true)}
					class="btn rounded-xl border-none bg-linear-to-r from-purple-600 to-indigo-600 px-6 font-bold text-white shadow-xl shadow-purple-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-purple-500 hover:to-indigo-500"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-5 w-5"
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
				class="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-purple-500/30"
			>
				<div>
					<span class="mb-1 block text-xs font-semibold tracking-widest text-slate-400 uppercase"
						>Active Projects</span
					>
					<span class="text-3xl font-black">{activeWorkspaceProjects.length}</span>
				</div>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400"
				>
					📦
				</div>
			</div>
			<div
				class="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-indigo-500/30"
			>
				<div>
					<span class="mb-1 block text-xs font-semibold tracking-widest text-slate-400 uppercase"
						>D1 Analytics DB</span
					>
					<span class="text-3xl font-black text-emerald-400">Active</span>
				</div>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"
				>
					⚡
				</div>
			</div>
			<div
				class="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-blue-500/30"
			>
				<div>
					<span class="mb-1 block text-xs font-semibold tracking-widest text-slate-400 uppercase"
						>R2 Assets Storage</span
					>
					<span class="text-3xl font-black text-indigo-400">Online</span>
				</div>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400"
				>
					☁️
				</div>
			</div>
		</div>

		<!-- Projects Section -->
		<section>
			<h2 class="mb-6 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-300">
				<span>Your Playtests</span>
				<span class="badge border-none bg-slate-800 px-2 py-1 badge-sm text-slate-400"
					>{activeWorkspaceProjects.length}</span
				>
			</h2>

			{#if activeProjectAnalyticsId}
				{#if activeProject}
					<div class="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-md">
						<!-- Breadcrumb Header -->
						<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
							<div class="flex items-center gap-3">
								<button
									onclick={() => (activeProjectAnalyticsId = null)}
									class="btn rounded-lg border border-slate-700 bg-slate-800/80 px-4 font-bold text-slate-300 transition-all btn-sm hover:bg-slate-700 hover:text-white"
								>
									← Back to Projects
								</button>
								<div class="h-4 w-[1px] bg-slate-800"></div>
								<h3 class="text-2xl font-black text-white">
									{activeProject.name}
									<span class="text-sm font-medium text-slate-500">({activeProject.id})</span>
								</h3>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="badge rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[10px] font-bold text-purple-400 uppercase"
								>
									{activeProject.tier}
								</span>
								{#if activeProject.passwordProtected}
									<span
										class="badge rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400 uppercase"
									>
										🔐 Private
									</span>
								{/if}
							</div>
						</div>

						<!-- Telemetry Aggregation Stats -->
						<div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
							<div class="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
								<span
									class="mb-1 block text-[10px] font-bold tracking-widest text-slate-500 uppercase"
									>Total Play Sessions</span
								>
								<span class="text-3xl font-black text-purple-400"
									>{activeProject.stats.totalSessions}</span
								>
							</div>
							<div class="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
								<span
									class="mb-1 block text-[10px] font-bold tracking-widest text-slate-500 uppercase"
									>Total Custom Logs</span
								>
								<span class="text-3xl font-black text-emerald-400"
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
							class="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
						>
							<div>
								<h4 class="text-sm font-bold text-slate-200">Export Raw Playtest Data</h4>
								<p class="text-xs text-slate-500">
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
									class="btn rounded-xl border border-purple-500/25 bg-purple-500/10 px-5 font-bold text-purple-400 transition-all btn-sm hover:bg-purple-600 hover:text-white"
								>
									📥 JSON
								</a>
								<a
									href={resolve('/(app)/portal/dashboard/projects/[id]/export/csv', {
										id: activeProject.id
									})}
									download
									class="btn rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-5 font-bold text-indigo-400 transition-all btn-sm hover:bg-indigo-600 hover:text-white"
								>
									📥 CSV
								</a>
								<a
									href={resolve('/(app)/portal/dashboard/projects/[projectId]/export/zip', {
										projectId: activeProject.id
									})}
									download
									class="btn rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 font-bold text-emerald-400 transition-all btn-sm hover:bg-emerald-600 hover:text-white"
								>
									📦 Download ZIP
								</a>
							</div>
						</div>

						<!-- Playtest session list inspector -->
						<div class="space-y-4">
							<div class="flex items-center justify-between">
								<h4 class="text-sm font-bold tracking-wider text-slate-400 uppercase">
									Recent Playtest Sessions (Latest 30)
								</h4>
								<span class="badge border-none bg-slate-800 font-mono text-xs text-slate-400"
									>{projectSessions.length} sessions loaded</span
								>
							</div>

							{#if projectSessions.length === 0}
								<div
									class="rounded-2xl border border-slate-800/80 bg-slate-950/20 py-16 text-center"
								>
									<div
										class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-2xl"
									>
										⏳
									</div>
									<h4 class="text-slate-350 mb-1 font-bold">Waiting for playtests...</h4>
									<p class="mx-auto max-w-md text-xs leading-relaxed text-slate-500">
										No playtest sessions have been received for this project yet. Use the code
										templates in the guide below to start sending data from your game.
									</p>
								</div>
							{:else}
								<div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
									<table class="w-full border-collapse text-left text-xs">
										<thead>
											<tr
												class="text-slate-450 border-b border-slate-800 bg-slate-900/30 text-[10px] font-bold tracking-wider uppercase"
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
										<tbody class="text-slate-350 divide-y divide-slate-800/55 font-medium">
											{#each projectSessions as session (session.id)}
												<tr class="hover:bg-slate-900/20">
													<td class="p-4 font-mono text-[10px] whitespace-nowrap text-slate-500">
														{new Date(session.createdAt).toLocaleString()}
													</td>
													<td
														class="p-4 font-mono text-[10px] text-indigo-400"
														title={session.gpuRenderer ? `GPU: ${session.gpuRenderer}` : session.id}
													>
														{session.id.slice(0, 8)}...
													</td>
													<td class="p-4 whitespace-nowrap">
														{session.duration}s
													</td>
													<td class="p-4">
														<span
															class="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-slate-300"
														>
															{session.logCount}
														</span>
													</td>
													<td class="p-4">
														{#if session.avgFps}
															<span
																class="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-bold text-purple-300"
															>
																{session.avgFps} FPS
															</span>
														{:else}
															<span class="text-[10px] text-slate-600">--</span>
														{/if}
													</td>
													<td class="p-4">
														{#if session.sentiment === 'fun'}
															<span
																class="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
																title={session.userComment || 'Playtest rated Fun'}
															>
																😀 FUN
															</span>
														{:else if session.sentiment === 'neutral'}
															<span
																class="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400"
																title={session.userComment || 'Playtest rated Neutral'}
															>
																😐 OKAY
															</span>
														{:else if session.sentiment === 'unfun'}
															<span
																class="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400"
																title={session.userComment || 'Playtest rated Unfun'}
															>
																🙁 UNFUN
															</span>
														{:else}
															<span class="text-[10px] text-slate-600">--</span>
														{/if}
													</td>
													<td class="p-4">
														{#if session.hasCrashed}
															<span
																class="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400"
															>
																💥 CRASHED
															</span>
														{:else}
															<span
																class="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
															>
																✅ ACTIVE / OK
															</span>
														{/if}
													</td>
													<td class="p-4 text-right">
														<button
															onclick={() => inspectSession(session)}
															class="btn rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-[10px] font-bold text-purple-300 transition-all hover:bg-purple-600 hover:text-white"
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
					class="rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 px-6 py-20 text-center backdrop-blur-md"
				>
					<div
						class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-900/60 text-3xl shadow-inner"
					>
						👾
					</div>
					<h3 class="mb-2 text-xl font-bold text-slate-200">No playtests found</h3>
					<p class="mx-auto mb-8 max-w-md text-slate-500">
						Ready to test if your game is actually fun? Create a new project to start streaming
						telemetry.
					</p>
					<button
						onclick={() => (showCreateModal = true)}
						class="btn rounded-xl border-none bg-purple-600 shadow-lg btn-primary hover:bg-purple-500"
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
							class="group relative rounded-3xl border border-slate-800 bg-slate-900/30 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/5"
						>
							<!-- Glowing border effect -->
							<div
								class="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-r from-purple-500/0 to-indigo-500/0 transition-all group-hover:from-purple-500/5 group-hover:to-indigo-500/5"
							></div>

							<div class="relative z-10 mb-4 flex items-start justify-between">
								<div>
									<h3
										class="mb-1 text-2xl font-extrabold tracking-tight text-white transition-colors group-hover:text-purple-300"
									>
										{p.name}
									</h3>
									<span class="text-xs font-medium text-slate-500">
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
											class="badge rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-400 uppercase"
										>
											🔐 Private
										</span>
									{:else}
										<span
											class="badge rounded-md border-none bg-slate-800 px-2 py-1 text-[10px] text-slate-400 uppercase"
										>
											🌐 Public
										</span>
									{/if}
									<span
										class="badge rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[10px] font-bold text-purple-400 uppercase"
									>
										{p.tier}
									</span>
									{#if p.payments && p.payments.length > 0}
										<span
											class="badge rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase"
											title="Creem Order ID: {p.payments[0].creemOrderId || 'Local'}"
										>
											💳 Paid
										</span>
									{/if}
								</div>
							</div>

							<!-- Telemetry Stats mockup or link -->
							<div
								class="relative z-10 mb-6 flex justify-between divide-x divide-slate-800/60 rounded-2xl border border-slate-900 bg-slate-950/60 p-4 text-center"
							>
								<div class="flex-1 px-1">
									<span class="mb-1 block text-[9px] tracking-wider text-slate-500 uppercase"
										>Telemetry ID</span
									>
									<code class="font-mono text-xs font-bold text-purple-400">{p.id}</code>
								</div>
								<div class="flex-1 px-1">
									<span class="mb-1 block text-[9px] tracking-wider text-slate-500 uppercase"
										>Writes</span
									>
									<span class="text-xs font-bold text-slate-300">
										{p.projectQuotas?.[0]?.monthlyWriteCount || 0} / {p.projectQuotas?.[0]
											?.maxWriteLimit || (p.tier === 'free' ? 5000 : 100000)}
									</span>
								</div>
								<div class="flex-1 px-1">
									<span class="mb-1 block text-[9px] tracking-wider text-slate-500 uppercase"
										>Storage</span
									>
									<span class="text-xs font-bold text-slate-300">
										{((p.projectQuotas?.[0]?.storageBytesUsed || 0) / (1024 * 1024)).toFixed(2)} MB
									</span>
								</div>
							</div>

							<!-- Action Buttons -->
							<div
								class="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 pt-4"
							>
								<div class="flex gap-2">
									<button
										onclick={() => openUpload(p.id)}
										class="btn rounded-lg border border-purple-500/20 bg-purple-600/20 px-4 font-bold text-purple-300 transition-all btn-sm hover:bg-purple-600 hover:text-white"
										aria-label="Upload game bundle"
									>
										☁️ Upload Game ZIP
									</button>
									<button
										onclick={() => triggerCopy(p.id)}
										class="btn rounded-lg px-3 text-slate-300 btn-ghost btn-sm hover:text-white"
										aria-label="Copy play link"
									>
										{#if copyStatus[p.id]}
											✨ Copied!
										{:else}
											🔗 Copy Play Link
										{/if}
									</button>
									<button
										onclick={() => (activeProjectAnalyticsId = p.id)}
										class="btn rounded-lg border border-indigo-500/20 bg-indigo-600/20 px-4 font-bold text-indigo-300 transition-all btn-sm hover:bg-indigo-600 hover:text-white"
										aria-label="View Telemetry"
									>
										📊 View Analytics
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
												class="btn rounded-lg border-none bg-linear-to-r from-amber-500 to-orange-500 px-4 font-extrabold text-slate-950 shadow-lg shadow-orange-500/10 transition-all btn-sm hover:from-amber-400 hover:to-orange-400 hover:shadow-orange-500/25"
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
										class="btn btn-circle text-slate-500 btn-ghost transition-colors btn-sm hover:bg-rose-500/10 hover:text-rose-500"
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
			<div class="mt-16 rounded-3xl border border-slate-800 bg-slate-900/10 p-8 backdrop-blur-md">
				<h2 class="mb-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white">
					<span>🛠️ Telemetry Integration Guide</span>
				</h2>
				<p class="mb-6 text-sm leading-relaxed text-slate-400">
					IsItFun exposes a simple window-level logging API. Embed the script and call our logging
					function from any HTML5 engine.
				</p>

				<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
					<!-- Setup Snippet -->
					<div class="space-y-6 lg:col-span-2">
						<div>
							<h3 class="mb-3 text-sm font-bold tracking-wider text-purple-400 uppercase">
								1. Include script (Automatically injected on hosted builds)
							</h3>
							<div
								class="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300"
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
								<h3 class="text-sm font-bold tracking-wider text-indigo-400 uppercase">
									2. Call Log API from your game engine
								</h3>
							</div>

							<!-- Guide Tabs -->
							<div class="mb-4 flex border-b border-slate-800 text-xs font-bold">
								<button
									onclick={() => (activeGuideTab = 'js')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'js'
										? 'border-indigo-500 text-indigo-400'
										: 'text-slate-450 border-transparent hover:text-slate-200'}"
								>
									JavaScript
								</button>
								<button
									onclick={() => (activeGuideTab = 'godot')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'godot'
										? 'border-indigo-500 text-indigo-400'
										: 'text-slate-450 border-transparent hover:text-slate-200'}"
								>
									Godot 4
								</button>
								<button
									onclick={() => (activeGuideTab = 'unity')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'unity'
										? 'border-indigo-500 text-indigo-400'
										: 'text-slate-450 border-transparent hover:text-slate-200'}"
								>
									Unity WebGL
								</button>
								<button
									onclick={() => (activeGuideTab = 'phaser')}
									class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'phaser'
										? 'border-indigo-500 text-indigo-400'
										: 'text-slate-450 border-transparent hover:text-slate-200'}"
								>
									Phaser
								</button>
							</div>

							<div
								class="text-slate-350 relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs font-medium"
							>
								{#if activeGuideTab === 'js'}
									<pre><code
											>window.IsItFun.log("level_complete", &#123;
  level_id: "world_1_1",
  score: 12500,
  coins: 42
&#125;);</code
										></pre>
								{:else if activeGuideTab === 'godot'}
									<pre><code
											># GDScript Web Bridge
func log_event(event_name: String, data: Dictionary):
    if OS.has_feature("web"):
        JavaScriptBridge.eval("window.IsItFun.log('" + event_name + "', " + JSON.stringify(data) + ")")</code
										></pre>
								{:else if activeGuideTab === 'unity'}
									<pre><code
											>// C# WebGL Plugin Method
public void LogEvent(string eventName, string jsonPayload) &#123;
    #if !UNITY_EDITOR && UNITY_WEBGL
    Application.ExternalCall("window.IsItFun.log", eventName, jsonPayload);
    #endif
&#125;</code
										></pre>
								{:else if activeGuideTab === 'phaser'}
									<pre><code
											>// Log collection in Phaser scene
this.registry.events.on('changedata', (parent, key, value) => &#123;
    window.IsItFun?.log("state_change", &#123; key: key, val: value &#125;);
&#125;);</code
										></pre>
								{/if}
							</div>
						</div>
					</div>

					<!-- Limits and retention -->
					<div class="h-fit space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
						<h3 class="text-sm font-bold tracking-wider text-amber-400 uppercase">
							Security & Rate Limits
						</h3>

						<div class="flex items-start gap-3">
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-xs"
							>
								🛡️
							</div>
							<div>
								<h4 class="text-xs font-bold text-slate-200">Daily Cap Check</h4>
								<p class="text-[11px] leading-relaxed text-slate-500">
									All projects are limited to a daily firewall cap of 5,000 logs/day to protect D1
									storage from loop overhead.
								</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-xs"
							>
								🆓
							</div>
							<div>
								<h4 class="text-xs font-bold text-slate-200">Free Tier Log decay</h4>
								<p class="text-slate-550 text-[11px] leading-relaxed">
									Free projects have a 7-day logs decay protocol. Clean records are retained for
									week-long prototype sessions.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>

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
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-lg"
		>
			<div
				class="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl"
			>
				<header class="mb-6 flex items-center justify-between">
					<h3 class="text-xl font-black text-white">Create Workspace Team</h3>
					<button
						onclick={() => (showCreateOrgModal = false)}
						class="btn btn-circle btn-ghost btn-sm">✕</button
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
							<span class="label-text text-slate-350 text-xs font-bold uppercase"
								>Team / Studio Name</span
							>
						</label>
						<input
							id="org-name-input"
							placeholder="e.g. Pixel Arts Studio"
							class="input w-full rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-700 focus:border-purple-500 focus:outline-none"
							required
							bind:value={orgNameInput}
							{...createOrganization.fields.name.as('text')}
						/>
					</div>
					<div class="flex justify-end gap-3 border-t border-slate-800 pt-4">
						<button
							type="button"
							onclick={() => (showCreateOrgModal = false)}
							class="btn rounded-xl btn-ghost">Cancel</button
						>
						<button
							type="submit"
							class="btn rounded-xl border-none bg-linear-to-r from-purple-600 to-indigo-600 font-bold text-white"
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
</main>
