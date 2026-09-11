<script lang="ts">
	import { resolve } from '$app/paths';
	import CreateProjectModal from '#lib/components/dashboard/CreateProjectModal.svelte';
	import UploadModal from '#lib/components/dashboard/UploadModal.svelte';
	import PlaytestChart from '#lib/components/charts/PlaytestChart.svelte';
	import ConsoleInspectorModal from '#lib/components/dashboard/ConsoleInspectorModal.svelte';
	import OnboardingTourModal from '#lib/components/dashboard/OnboardingTourModal.svelte';
	import TeamManagementModal from '#lib/components/dashboard/TeamManagementModal.svelte';
	import CreateOrgModal from '#lib/components/dashboard/CreateOrgModal.svelte';
	import ProjectCard from '#lib/components/dashboard/ProjectCard.svelte';
	import SdkIntegrationTabs from '#lib/components/dashboard/SdkIntegrationTabs.svelte';
	import DataTable from '#lib/components/ui/DataTable.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import {
		Plus,
		Download,
		BarChart3,
		HardDrive,
		Activity,
		Inbox,
		ExternalLink,
		Settings,
		Sparkles
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { renderSnippet, type ColumnDef } from '@tanstack/svelte-table';

	let { data } = $props();

	// Modal & Navigation States
	let showCreateModal = $state(false);
	let selectedProjectId = $state('');
	let showUploadModal = $state(false);
	let showOnboardingModal = $state(false);
	let origin = $state('https://isitfun.frstudios.co.ke');

	// Multi-tenancy States
	let selectedWorkspaceId = $state('personal');
	let showCreateOrgModal = $state(false);
	let showOrgSettings = $state(false);

	// Analytics View States
	let activeProjectAnalyticsId = $state<string | null>(null);
	let showInspectorModal = $state(false);
	let inspectorSessionId = $state('');

	const activeProject = $derived(data.projects.find((p) => p.id === activeProjectAnalyticsId));

	const projectSessions = $derived(
		activeProject
			? data.recentSessions.filter((session) => session.projectId === activeProject.id)
			: []
	);

	function inspectSession(session: (typeof data.recentSessions)[number]) {
		inspectorSessionId = session.id;
		showInspectorModal = true;
	}

	// Derived Workspace Variables
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

	// Workspace aggregated storage & session counts
	const workspaceStorageUsedBytes = $derived(
		activeWorkspaceProjects.reduce((acc, p) => {
			const quotaStorage = p.projectQuotas?.[0]?.storageBytesUsed || 0;
			return acc + quotaStorage;
		}, 0)
	);
	const workspaceStorageUsedMB = $derived(
		Math.round((workspaceStorageUsedBytes / (1024 * 1024)) * 10) / 10
	);
	const workspaceStorageMaxMB = $derived(
		activeOrg ? (activeOrg.tier === 'team' ? 20480 : 500) : 500
	);
	const workspaceStoragePercent = $derived(
		Math.min(100, Math.round((workspaceStorageUsedMB / workspaceStorageMaxMB) * 100))
	);
	const workspaceTotalSessions = $derived(
		activeWorkspaceProjects.reduce((acc, p) => acc + (p.stats?.totalSessions || 0), 0)
	);

	onMount(() => {
		if (typeof window !== 'undefined') {
			origin = window.location.origin;
		}
	});

	function handleOpenUpload(projectId: string) {
		selectedProjectId = projectId;
		showUploadModal = true;
	}

	const selectedProjectTier = $derived(
		data.projects.find((p) => p.id === selectedProjectId)?.tier || 'free'
	);

	// TanStack Table Column Definitions with Svelte 5 Snippets
	const sessionColumns = $derived<any[]>([
		{
			accessorKey: 'createdAt',
			header: 'Started',
			cell: (info: any) => renderSnippet(startedCell, info)
		},
		{
			accessorKey: 'id',
			header: 'Session ID',
			cell: (info: any) => renderSnippet(sessionIdCell, info)
		},
		{
			accessorKey: 'duration',
			header: 'Duration',
			cell: (info: any) => `${info.getValue() ?? 0}s`
		},
		{
			accessorKey: 'logCount',
			header: 'Logs',
			cell: (info: any) => info.getValue()
		},
		{
			accessorKey: 'avgFps',
			header: 'Avg FPS',
			cell: (info: any) => (info.getValue() ? `${info.getValue()} FPS` : '—')
		},
		{
			accessorKey: 'sentiment',
			header: 'Sentiment',
			cell: (info: any) => renderSnippet(sentimentCell, info)
		},
		{
			accessorKey: 'hasCrashed',
			header: 'Status',
			cell: (info: any) => renderSnippet(statusCell, info)
		},
		{
			id: 'actions',
			header: '',
			cell: (info: any) => renderSnippet(actionCell, info)
		}
	]);
</script>

{#snippet startedCell({ getValue }: any)}
	<span class="font-mono text-[11px] text-slate-500 whitespace-nowrap">
		{new Date(getValue()).toLocaleString()}
	</span>
{/snippet}

{#snippet sessionIdCell({ getValue }: any)}
	<span class="font-mono text-[11px] font-semibold text-slate-900">
		{getValue().slice(0, 8)}
	</span>
{/snippet}

{#snippet sentimentCell({ getValue }: any)}
	{#if getValue() === 'fun'}
		<span class="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Fun</span>
	{:else if getValue() === 'neutral'}
		<span class="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Neutral</span>
	{:else if getValue() === 'unfun'}
		<span class="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Unfun</span>
	{:else}
		<span class="text-slate-400">—</span>
	{/if}
{/snippet}

{#snippet statusCell({ getValue }: any)}
	{#if getValue()}
		<span class="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
			<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Crashed
		</span>
	{:else}
		<span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
			<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Clean
		</span>
	{/if}
{/snippet}

{#snippet actionCell({ row }: any)}
	<div class="text-right">
		<button
			onclick={() => inspectSession(row.original)}
			class="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
		>
			Inspect
		</button>
	</div>
{/snippet}

<svelte:head>
	<title>Developer Portal | Is It Fun?</title>
	<meta
		name="description"
		content="Manage your playtests, upload game files, and review user satisfaction and telemetry."
	/>
</svelte:head>

<!-- Main Content Area -->
<main class="mx-auto mt-8 w-full max-w-7xl flex-1 px-6 pb-24 lg:px-12">
	<!-- Workspace Switcher Ribbon -->
	<div class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
		<div class="flex items-center gap-3">
			<span class="text-xs font-semibold text-slate-500">Workspace</span>
			<div class="relative">
				<select
					bind:value={selectedWorkspaceId}
					class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-xs transition-all focus:border-purple-600 focus:outline-none"
				>
					<option value="personal">Personal Workspace</option>
					{#each data.organizations as org (org.id)}
						<option value={org.id}>
							{org.name} ({org.tier === 'team' ? 'Team Plan' : 'Free'})
						</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={() => (showOnboardingModal = true)}
				class="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
			>
				<Sparkles class="h-3.5 w-3.5" /> Onboarding Tour
			</button>
			<button
				onclick={() => (showCreateOrgModal = true)}
				class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
			>
				<Plus class="h-3.5 w-3.5" /> New Team
			</button>
			{#if selectedWorkspaceId !== 'personal' && activeOrg}
				<button
					onclick={() => (showOrgSettings = !showOrgSettings)}
					class="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100"
				>
					<Settings class="h-3.5 w-3.5" /> Team Settings
				</button>
			{/if}
		</div>
	</div>

	<!-- Team Settings View -->
	{#if activeOrg}
		<TeamManagementModal
			{activeOrg}
			userId={data.user?.id}
			show={showOrgSettings}
			onClose={() => (showOrgSettings = false)}
		/>
	{/if}

	<!-- Overview Header -->
	<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-900">
				{activeOrg ? `${activeOrg.name} Overview` : 'Developer Dashboard'}
			</h1>
			<p class="mt-1 text-xs text-slate-500">
				Manage game uploads, generate playtest links, and analyze player sentiment telemetry.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800"
			>
				<Plus class="h-3.5 w-3.5" /> New Project
			</button>
		</div>
	</div>

	<!-- Metrics Cards -->
	<div class="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Builds</span>
				<Activity class="h-4 w-4 text-purple-600" />
			</div>
			<div class="mt-3 text-2xl font-bold tracking-tight text-slate-900">
				{activeWorkspaceProjects.length}
			</div>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Storage Usage</span>
				<HardDrive class="h-4 w-4 text-indigo-600" />
			</div>
			<div class="mt-3 flex items-baseline gap-1.5">
				<span class="text-2xl font-bold tracking-tight text-slate-900">{workspaceStorageUsedMB} MB</span>
				<span class="text-xs font-medium text-slate-400">/ {workspaceStorageMaxMB} MB</span>
			</div>
			<div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
				<div
					class="h-full rounded-full bg-purple-600 transition-all duration-300"
					style="width: {workspaceStoragePercent}%"
				></div>
			</div>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Sessions</span>
				<BarChart3 class="h-4 w-4 text-emerald-600" />
			</div>
			<div class="mt-3 text-2xl font-bold tracking-tight text-slate-900">
				{workspaceTotalSessions}
			</div>
		</div>
	</div>

	<!-- Projects Section -->
	<section>
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-base font-bold tracking-tight text-slate-900">
				Projects ({activeWorkspaceProjects.length})
			</h2>
		</div>

		{#if activeProjectAnalyticsId}
			{#if activeProject}
				<div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
					<!-- Breadcrumb Header -->
					<div class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
						<div class="flex items-center gap-3">
							<button
								onclick={() => (activeProjectAnalyticsId = null)}
								class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								← Back to Projects
							</button>
							<div class="h-4 w-px bg-slate-200"></div>
							<h3 class="text-lg font-bold text-slate-900">
								{activeProject.name}
								<span class="font-mono text-xs font-normal text-slate-400">({activeProject.id})</span>
							</h3>
						</div>
						<div class="flex items-center gap-2">
							<span class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 uppercase">
								{activeProject.tier}
							</span>
							{#if activeProject.passwordProtected}
								<span class="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
									Protected
								</span>
							{/if}
						</div>
					</div>

					<!-- Telemetry Aggregation Stats -->
					<div class="mb-6 grid grid-cols-2 gap-4">
						<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
							<span class="block text-xs font-medium text-slate-500">Total Play Sessions</span>
							<span class="mt-1 block font-mono text-2xl font-bold text-slate-900">
								{activeProject.stats?.totalSessions || 0}
							</span>
						</div>
						<div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
							<span class="block text-xs font-medium text-slate-500">Custom Log Events</span>
							<span class="mt-1 block font-mono text-2xl font-bold text-slate-900">
								{activeProject.stats?.totalEvents || 0}
							</span>
						</div>
					</div>

					<!-- Layerchart Visual Analytics -->
					<div class="mb-8">
						<PlaytestChart sessions={projectSessions} />
					</div>

					<!-- Export Data Options -->
					<div class="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-5">
						<div>
							<h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">
								Export Raw Playtest Data
							</h4>
							<p class="mt-0.5 text-xs text-slate-500">
								Download raw session JSON, CSV, or complete log archives.
							</p>
						</div>
						<div class="flex flex-wrap gap-2">
							<a
								href={resolve('/(app)/portal/dashboard/projects/[id]/export/json', {
									id: activeProject.id
								})}
								download
								class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								<Download class="h-3.5 w-3.5" /> JSON
							</a>
							<a
								href={resolve('/(app)/portal/dashboard/projects/[id]/export/csv', {
									id: activeProject.id
								})}
								download
								class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								<Download class="h-3.5 w-3.5" /> CSV
							</a>
							<a
								href={resolve('/(app)/portal/dashboard/projects/[projectId]/export/zip', {
									projectId: activeProject.id
								})}
								download
								class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								<Download class="h-3.5 w-3.5" /> ZIP
							</a>
						</div>
					</div>

					<!-- Sessions Table powered by TanStack Table -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h4 class="text-xs font-bold uppercase tracking-wider text-slate-500">
								Playtest Sessions
							</h4>
						</div>

						{#if projectSessions.length === 0}
							<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
								<Inbox class="mx-auto h-8 w-8 text-slate-400" />
								<h4 class="mt-2 text-xs font-bold text-slate-800">No playtests yet</h4>
								<p class="mt-1 text-xs text-slate-500">
									Send your game link to playtesters to start recording sessions.
								</p>
							</div>
						{:else}
							<DataTable
								data={projectSessions}
								columns={sessionColumns}
								pageSize={10}
								searchPlaceholder="Search session logs or sentiment..."
							/>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each activeWorkspaceProjects as project (project.id)}
					<ProjectCard
						{project}
						onUpload={handleOpenUpload}
						onViewAnalytics={(id) => (activeProjectAnalyticsId = id)}
					/>
				{/each}
			</div>
		{/if}

		<!-- Telemetry & SDK Integration Guide -->
		<SdkIntegrationTabs {origin} />
	</section>
</main>

<Footer />

<!-- Modals -->
<CreateProjectModal
	bind:show={showCreateModal}
	organizationId={selectedWorkspaceId === 'personal' ? '' : selectedWorkspaceId}
/>

<UploadModal
	bind:show={showUploadModal}
	projectId={selectedProjectId}
	isFree={selectedProjectTier === 'free'}
/>

<CreateOrgModal
	show={showCreateOrgModal}
	onClose={() => (showCreateOrgModal = false)}
	onCreated={(newOrgId) => (selectedWorkspaceId = newOrgId)}
/>

{#if activeProjectAnalyticsId}
	<ConsoleInspectorModal
		isOpen={showInspectorModal}
		sessionId={inspectorSessionId}
		projectId={activeProjectAnalyticsId}
		onClose={() => (showInspectorModal = false)}
	/>
{/if}

<OnboardingTourModal isOpen={showOnboardingModal} onClose={() => (showOnboardingModal = false)} />
