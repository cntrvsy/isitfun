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
	let activeEventTab = $state<'events' | 'sessions'>('events');
	let selectedEventNameState = $state<string | null>(null);

	const activeProject = $derived(data.projects.find((p) => p.id === activeProjectAnalyticsId));

	const selectedEventName = $derived(
		selectedEventNameState || activeProject?.stats.eventBreakdown[0]?.eventName || null
	);

	const filteredEvents = $derived(
		activeProject ? activeProject.recentEvents.filter((e) => e.eventName === selectedEventName) : []
	);

	const propKeys = $derived(
		Array.from(
			new Set(
				filteredEvents.flatMap((e) => {
					try {
						return Object.keys(JSON.parse(e.properties));
					} catch {
						return [];
					}
				})
			)
		)
	);

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
				href={resolve('/portal/profile')}
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
									type="email"
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
						<div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
							<div class="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
								<span
									class="mb-1 block text-[10px] font-bold tracking-widest text-slate-500 uppercase"
									>Total Sessions</span
								>
								<span class="text-3xl font-black text-purple-400"
									>{activeProject.stats.totalSessions}</span
								>
							</div>
							<div class="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
								<span
									class="mb-1 block text-[10px] font-bold tracking-widest text-slate-500 uppercase"
									>Avg. Play Duration</span
								>
								<span class="text-3xl font-black text-indigo-400">
									{#if activeProject.stats.averageDuration >= 60}
										{Math.floor(activeProject.stats.averageDuration / 60)}m {activeProject.stats
											.averageDuration % 60}s
									{:else}
										{activeProject.stats.averageDuration}s
									{/if}
								</span>
							</div>
							<div class="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
								<span
									class="mb-1 block text-[10px] font-bold tracking-widest text-slate-500 uppercase"
									>Gameplay Events</span
								>
								<span class="text-3xl font-black text-emerald-400"
									>{activeProject.stats.totalEvents}</span
								>
							</div>
						</div>

						<!-- Tab Bar -->
						<div class="mb-6 flex border-b border-slate-800">
							<button
								onclick={() => (activeEventTab = 'events')}
								class="border-b-2 px-6 py-3 text-sm font-bold transition-all {activeEventTab ===
								'events'
									? 'border-purple-500 text-purple-400'
									: 'border-transparent text-slate-400 hover:text-slate-200'}"
							>
								🎯 Custom Gameplay Events
							</button>
							<button
								onclick={() => (activeEventTab = 'sessions')}
								class="border-b-2 px-6 py-3 text-sm font-bold transition-all {activeEventTab ===
								'sessions'
									? 'border-purple-500 text-purple-400'
									: 'border-transparent text-slate-400 hover:text-slate-200'}"
							>
								⏱️ Recent Sessions
							</button>
						</div>

						<!-- Tab Contents -->
						{#if activeEventTab === 'events'}
							{#if activeProject.stats.eventBreakdown.length === 0}
								<div class="py-12 text-center">
									<div
										class="bg-slate-850 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
									>
										💡
									</div>
									<h4 class="mb-1 font-bold text-slate-300">No custom gameplay events yet</h4>
									<p class="mx-auto max-w-md text-xs leading-relaxed text-slate-500">
										Integrate custom tracking in your code to record specific action points:
									</p>
									<div
										class="border-slate-850 mx-auto mt-4 max-w-md overflow-x-auto rounded-xl border bg-slate-950 p-3 text-left font-mono text-[10px] text-slate-400"
									>
										window.IsItFun.track('level-complete', &#123; level: 1, score: 5000 &#125;);
									</div>
								</div>
							{:else}
								<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
									<!-- Event Names Selector -->
									<div class="space-y-2 lg:col-span-1">
										<span
											class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>Event Schema</span
										>
										{#each activeProject.stats.eventBreakdown as eb (eb.eventName)}
											<button
												onclick={() => (selectedEventNameState = eb.eventName)}
												class="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all {selectedEventName ===
												eb.eventName
													? 'border-purple-500/50 bg-purple-500/10 text-white'
													: 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
											>
												<span class="font-mono text-xs font-bold">{eb.eventName}</span>
												<span
													class="badge border-none bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
													>{eb.count}</span
												>
											</button>
										{/each}
									</div>

									<!-- Event Instances Table / JSON Extraction -->
									<div class="lg:col-span-2">
										<div class="mb-3 flex items-center justify-between">
											<span class="text-xs font-bold tracking-wider text-slate-500 uppercase">
												Event Instances: <span class="font-mono text-purple-400"
													>{selectedEventName}</span
												>
											</span>
										</div>

										<div
											class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40"
										>
											<table class="w-full border-collapse text-left text-xs">
												<thead>
													<tr
														class="border-b border-slate-800 bg-slate-900/30 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
													>
														<th class="p-4">Time</th>
														<th class="p-4">Session ID</th>
														{#each propKeys as pk (pk)}
															<th class="p-4">{pk}</th>
														{/each}
													</tr>
												</thead>
												<tbody class="divide-y divide-slate-800/55 font-medium text-slate-300">
													{#each filteredEvents as ev (ev.id)}
														{@const props = (() => {
															try {
																return JSON.parse(ev.properties);
															} catch {
																return {};
															}
														})()}
														<tr class="hover:bg-slate-900/20">
															<td class="text-slate-450 p-4 font-mono text-[10px]">
																{new Date(ev.timestamp).toLocaleTimeString(undefined, {
																	hour: '2-digit',
																	minute: '2-digit',
																	second: '2-digit'
																})}
															</td>
															<td
																class="p-4 font-mono text-[10px] text-purple-400/80"
																title={ev.sessionId}
															>
																{ev.sessionId.slice(0, 8)}...
															</td>
															{#each propKeys as pk (pk)}
																<td class="p-4">
																	{#if props[pk] !== undefined}
																		<span
																			class="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
																		>
																			{typeof props[pk] === 'object'
																				? JSON.stringify(props[pk])
																				: props[pk]}
																		</span>
																	{:else}
																		<span class="text-slate-600">-</span>
																	{/if}
																</td>
															{/each}
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							{/if}
						{:else if activeEventTab === 'sessions'}
							{#if activeProject.recentSessions.length === 0}
								<p class="py-12 text-center text-sm text-slate-500">
									No playtest sessions recorded yet.
								</p>
							{:else}
								<div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
									<table class="w-full border-collapse text-left text-xs">
										<thead>
											<tr
												class="border-b border-slate-800 bg-slate-900/30 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
											>
												<th class="p-4">Session ID</th>
												<th class="p-4">Date & Time</th>
												<th class="p-4">Duration</th>
												<th class="p-4">Device & Browser</th>
											</tr>
										</thead>
										<tbody class="text-slate-350 divide-y divide-slate-800/55">
											{#each activeProject.recentSessions as sess (sess.id)}
												<tr class="hover:bg-slate-900/20">
													<td class="p-4 font-mono text-[10px] text-purple-400" title={sess.id}>
														{sess.id}
													</td>
													<td class="p-4 font-medium">
														{new Date(sess.createdAt).toLocaleString(undefined, {
															month: 'short',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</td>
													<td class="p-4 font-bold text-slate-200">
														{#if sess.duration >= 60}
															{Math.floor(sess.duration / 60)}m {sess.duration % 60}s
														{:else}
															{sess.duration || 0}s
														{/if}
													</td>
													<td
														class="text-slate-450 max-w-[200px] truncate p-4 text-[10px]"
														title={sess.browserInfo}
													>
														{sess.browserInfo || 'Unknown'}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						{/if}
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
										onclick={() => {
											activeProjectAnalyticsId = p.id;
											selectedEventNameState = null;
										}}
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
					IsItFun automatically injects a floating feedback widget and hooks into browser console
					events, but you can also log custom diagnostics directly from your game code.
				</p>

				<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
					<!-- Setup Snippet -->
					<div class="flex flex-col justify-between">
						<div>
							<h3 class="mb-3 text-sm font-bold tracking-wider text-purple-400 uppercase">
								1. Script Integration
							</h3>
							<p class="mb-4 text-xs leading-relaxed text-slate-400">
								If you upload a ZIP bundle, our edge router injects this automatically. If you're
								hosting the game elsewhere, embed this script in your game's HTML:
							</p>
							<div
								class="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300"
							>
								<pre><code
										>&lt;script 
  src="{origin}/assets/overlay-widget.js" 
  data-project="YOUR_PROJECT_ID" 
  data-tier="free"&gt;&lt;/script&gt;</code
									></pre>
							</div>
						</div>

						<div class="mt-6">
							<h3 class="mb-3 text-sm font-bold tracking-wider text-indigo-400 uppercase">
								2. Custom Event Logging
							</h3>
							<p class="mb-4 text-xs leading-relaxed text-slate-400">
								Log key game loop occurrences (deaths, checkpoints, level completions) from Phaser,
								Unity WebGL, Godot, or raw JS:
							</p>
							<div
								class="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300"
							>
								<pre><code
										>// Send custom analytics events
window.IsItFun?.log("checkpoint-reached", &#123;
  level: "Chapter 1",
  durationSeconds: 120,
  healthRemaining: 85
&#125;);</code
									></pre>
							</div>
						</div>
					</div>

					<!-- Tier capabilities and expectations -->
					<div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
						<h3 class="mb-4 text-sm font-bold tracking-wider text-amber-400 uppercase">
							Tier Capabilities & Abuse Prevention
						</h3>

						<div class="space-y-4">
							<div class="flex items-start gap-3">
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-xs"
								>
									🛡️
								</div>
								<div>
									<h4 class="text-xs font-bold text-slate-200">Edge Rate Limiting</h4>
									<p class="text-[11px] leading-relaxed text-slate-400">
										All projects are limited to a daily firewall cap of 5,000 logs/day to protect
										our database quotas. High-frequency loops will get auto-throttled.
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
									<h4 class="text-xs font-bold text-slate-200">Free Jammer Limits</h4>
									<p class="text-[11px] leading-relaxed text-slate-400">
										Filters out verbose <code>console.log</code>, <code>error</code> events, and high-frequency
										10-second heartbeat pings. Capped at 3 concurrent active sessions.
									</p>
								</div>
							</div>

							<div class="flex items-start gap-3">
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-xs"
								>
									⚡
								</div>
								<div>
									<h4 class="text-xs font-bold text-slate-200">Pro Project Pass</h4>
									<p class="text-[11px] leading-relaxed text-slate-400">
										Unlocks complete exception tracking, high-frequency active play session duration
										tracking, full console trace replication, and up to 500 unique playtest runs.
									</p>
								</div>
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
</main>
