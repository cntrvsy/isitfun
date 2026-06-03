<script lang="ts">
	import { resolve } from '$app/paths';
	import { deleteProject, upgradeProject } from './dashboard.remote';
	import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';

	let { data } = $props();

	// Svelte 5 Reactive States
	let showCreateModal = $state(false);
	let selectedProjectId = $state('');
	let showUploadModal = $state(false);

	// Create project state tracking
	let copyStatus = $state<Record<string, boolean>>({});

	function triggerCopy(projectId: string) {
		const playUrl = `${window.location.origin}/play/${projectId}`;
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
		<!-- Welcome Header and Stats Overview -->
		<header class="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-center">
			<div>
				<h1
					id="main-title"
					class="mb-2 bg-linear-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl"
				>
					Game Dashboard
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
					<span class="text-3xl font-black">{data.projects.length}</span>
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
					>{data.projects.length}</span
				>
			</h2>

			{#if data.projects.length === 0}
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
					{#each data.projects as p (p.id)}
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
		</section>
	</div>

	<CreateProjectModal bind:show={showCreateModal} />

	<UploadModal
		bind:show={showUploadModal}
		projectId={selectedProjectId}
		isFree={selectedProjectTier === 'free'}
	/>
</main>
