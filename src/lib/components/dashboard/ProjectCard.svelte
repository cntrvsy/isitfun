<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteProject, upgradeProject } from '../../../routes/(app)/portal/dashboard/dashboard.remote';
	import { Lock, Check, Trash2, BarChart2, Upload, Copy } from '@lucide/svelte';

	interface Quota {
		monthlyWriteCount: number | null;
		maxWriteLimit: number | null;
		storageBytesUsed: number | null;
	}

	interface Project {
		id: string;
		name: string;
		tier: string | null;
		passwordProtected: boolean | null;
		createdAt: Date | string | null;
		stats?: {
			totalSessions: number;
			totalEvents: number;
		};
		projectQuotas?: Quota[];
	}

	interface Props {
		project: Project;
		origin?: string;
		onUpload: (id: string) => void;
		onViewAnalytics: (id: string) => void;
	}

	let { project, onUpload, onViewAnalytics }: Props = $props();

	const del = deleteProject;
	const upgrade = upgradeProject;

	let isDeleting = $state(false);
	let isUpgrading = $state(false);
	let isCopied = $state(false);

	function handleCopy() {
		const playUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/play/${project.id}`;
		navigator.clipboard.writeText(playUrl).then(() => {
			isCopied = true;
			setTimeout(() => {
				isCopied = false;
			}, 2000);
		});
	}
</script>

<article
	class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
>
	<div>
		<!-- Card Top Header -->
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-bold tracking-tight text-slate-900">
					{project.name}
				</h3>
				<span class="font-mono text-[11px] text-slate-400">ID: {project.id}</span>
			</div>

			<div class="flex items-center gap-1.5">
				{#if project.passwordProtected}
					<span
						class="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
					>
						<Lock class="h-3 w-3" /> Protected
					</span>
				{/if}

				{#if project.tier === 'free'}
					<span
						class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase"
					>
						Free
					</span>
				{:else}
					<span
						class="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 uppercase"
					>
						Pro
					</span>
				{/if}
			</div>
		</div>

		<!-- Numeric Metrics Row -->
		<div
			class="mb-6 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center"
		>
			<div class="px-2">
				<span class="block text-[10px] font-medium text-slate-500 uppercase">Sessions</span>
				<span class="font-mono text-sm font-bold text-slate-900">
					{project.stats?.totalSessions || 0}
				</span>
			</div>
			<div class="px-2">
				<span class="block text-[10px] font-medium text-slate-500 uppercase">Events</span>
				<span class="font-mono text-sm font-bold text-slate-900">
					{project.stats?.totalEvents || 0}
				</span>
			</div>
			<div class="px-2">
				<span class="block text-[10px] font-medium text-slate-500 uppercase">Storage</span>
				<span class="font-mono text-sm font-bold text-slate-900">
					{((project.projectQuotas?.[0]?.storageBytesUsed || 0) / (1024 * 1024)).toFixed(1)} MB
				</span>
			</div>
		</div>
	</div>

	<!-- Bottom Action Controls -->
	<div class="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
		<div class="flex flex-wrap items-center gap-2">
			<button
				onclick={() => onViewAnalytics(project.id)}
				class="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate-800"
				aria-label="View Analytics"
			>
				<BarChart2 class="h-3.5 w-3.5" /> Analytics
			</button>
			<button
				onclick={handleCopy}
				class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
				aria-label="Copy play link"
			>
				{#if isCopied}
					<Check class="h-3.5 w-3.5 text-emerald-600" /> Copied
				{:else}
					<Copy class="h-3.5 w-3.5 text-slate-400" /> Link
				{/if}
			</button>
			<button
				onclick={() => onUpload(project.id)}
				class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
				aria-label="Upload game bundle"
			>
				<Upload class="h-3.5 w-3.5" /> Upload ZIP
			</button>

			{#if project.tier === 'free'}
				<form
					{...upgrade.enhance(async ({ submit }: any) => {
						try {
							isUpgrading = true;
							if (await submit()) {
								const res = upgrade.result;
								if (res && typeof res === 'object') {
									if ('redirectUrl' in res && res.redirectUrl) {
										window.location.href = String(res.redirectUrl);
									} else if ('success' in res && res.success) {
										await invalidateAll();
									}
								}
							}
						} catch (e) {
							console.error(e);
						} finally {
							isUpgrading = false;
						}
					})}
					class="inline"
				>
					<input {...upgrade.fields.id.as('hidden', project.id)} />
					<button
						type="submit"
						disabled={isUpgrading}
						class="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
						aria-label="Upgrade project"
					>
						{isUpgrading ? 'Upgrading...' : 'Upgrade (£15)'}
					</button>
				</form>
			{/if}
		</div>

		<!-- Delete Project Form -->
		<form
			{...del.enhance(async ({ submit }: any) => {
				if (confirm('Permanently delete this project and all associated logs?')) {
					isDeleting = true;
					if (await submit()) {
						await invalidateAll();
					}
					isDeleting = false;
				}
			})}
		>
			<input {...del.fields.id.as('hidden', project.id)} />
			<button
				type="submit"
				disabled={isDeleting}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
				aria-label="Delete project"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</form>
	</div>
</article>
