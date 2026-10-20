<script lang="ts">
	import { X, History, CheckCircle2, RotateCcw, AlertCircle, Loader2, Package } from '@lucide/svelte';

	let {
		show = $bindable(false),
		projectId,
		onRollbackComplete
	} = $props<{
		show: boolean;
		projectId: string;
		onRollbackComplete?: () => void;
	}>();

	interface GameBuild {
		id: string;
		projectId: string;
		versionString: string | null;
		totalSizeBytes: number | null;
		isActive: boolean;
		createdAt: string | Date;
		uploadedAt: string | Date | null;
	}

	let builds = $state<GameBuild[]>([]);
	let isLoading = $state(false);
	let isActivatingId = $state<string | null>(null);
	let errorMessage = $state('');
	let successMessage = $state('');

	$effect(() => {
		if (show && projectId) {
			fetchBuilds();
		} else {
			builds = [];
			errorMessage = '';
			successMessage = '';
		}
	});

	async function fetchBuilds() {
		isLoading = true;
		errorMessage = '';
		try {
			const res = await fetch(`/v1/projects/${projectId}/builds`);
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error || 'Failed to fetch build history');
			}
			const data = (await res.json()) as { builds: GameBuild[] };
			builds = data.builds || [];
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	async function handleRollback(build: GameBuild) {
		if (build.isActive) return;
		isActivatingId = build.id;
		errorMessage = '';
		successMessage = '';

		try {
			const res = await fetch(`/v1/projects/${projectId}/builds/${build.id}/publish`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					totalSizeBytes: build.totalSizeBytes || 0
				})
			});

			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error || 'Failed to rollback build');
			}

			successMessage = `Successfully rolled back to version ${build.versionString || build.id.slice(0, 8)}!`;
			await fetchBuilds();
			if (onRollbackComplete) {
				onRollbackComplete();
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			isActivatingId = null;
		}
	}

	function formatBytes(bytes: number | null): string {
		if (!bytes || bytes === 0) return '0 KB';
		const kb = bytes / 1024;
		if (kb < 1024) return `${kb.toFixed(1)} KB`;
		return `${(kb / 1024).toFixed(2)} MB`;
	}

	function formatDate(val: string | Date | null): string {
		if (!val) return '—';
		return new Date(val).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		aria-labelledby="build-history-title"
	>
		<div
			class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
						<History class="h-5 w-5" />
					</div>
					<div>
						<h2 id="build-history-title" class="text-base font-bold text-slate-900">
							Build History & Rollbacks
						</h2>
						<p class="text-xs text-slate-500">
							View past versions and immediately roll back active deployments.
						</p>
					</div>
				</div>
				<button
					onclick={() => (show = false)}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Alerts -->
			{#if errorMessage}
				<div class="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			{#if successMessage}
				<div class="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
					<CheckCircle2 class="h-4 w-4 shrink-0" />
					<span>{successMessage}</span>
				</div>
			{/if}

			<!-- Content Body -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if isLoading}
					<div class="flex flex-col items-center justify-center py-12 text-slate-400">
						<Loader2 class="h-8 w-8 animate-spin text-purple-600" />
						<p class="mt-3 text-xs font-medium">Fetching versioned builds...</p>
					</div>
				{:else if builds.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
						<Package class="h-10 w-10 text-slate-300" />
						<p class="mt-3 text-sm font-semibold text-slate-700">No Builds Found</p>
						<p class="mt-1 text-xs text-slate-500 max-w-sm">
							Upload your first HTML5 zip archive to start tracking build versions.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each builds as build (build.id)}
							<div
								class="flex items-center justify-between rounded-xl border p-4 transition-all {build.isActive
									? 'border-purple-200 bg-purple-50/40 shadow-xs'
									: 'border-slate-200 bg-white hover:border-slate-300'}"
							>
								<div class="flex items-start gap-3">
									<div class="mt-0.5">
										{#if build.isActive}
											<div class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
												<CheckCircle2 class="h-4 w-4" />
											</div>
										{:else}
											<div class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
												<Package class="h-3.5 w-3.5" />
											</div>
										{/if}
									</div>

									<div>
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs font-bold text-slate-900">
												{build.versionString || '1.0.0'}
											</span>
											{#if build.isActive}
												<span class="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
													Active Deployment
												</span>
											{/if}
										</div>
										<div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
											<span>Uploaded: {formatDate(build.uploadedAt || build.createdAt)}</span>
											<span>•</span>
											<span>Size: {formatBytes(build.totalSizeBytes)}</span>
											<span>•</span>
											<span class="font-mono text-[10px] text-slate-400">ID: {build.id.slice(0, 8)}</span>
										</div>
									</div>
								</div>

								<div>
									{#if build.isActive}
										<span class="text-xs font-semibold text-emerald-600">Serving Live</span>
									{:else}
										<button
											onclick={() => handleRollback(build)}
											disabled={isActivatingId !== null}
											class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
										>
											{#if isActivatingId === build.id}
												<Loader2 class="h-3.5 w-3.5 animate-spin" />
												Activating...
											{:else}
												<RotateCcw class="h-3.5 w-3.5" />
												Rollback
											{/if}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 rounded-b-2xl">
				<span class="text-xs text-slate-500">
					Retaining up to 5 most recent builds for zero-downtime rollbacks.
				</span>
				<button
					onclick={() => (show = false)}
					class="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
