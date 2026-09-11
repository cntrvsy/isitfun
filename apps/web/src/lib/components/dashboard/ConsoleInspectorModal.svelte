<script lang="ts">
	import { X, Activity, Monitor, Terminal } from '@lucide/svelte';

	interface Props {
		isOpen: boolean;
		sessionId: string;
		projectId: string;
		onClose: () => void;
	}

	let { isOpen, sessionId, projectId, onClose }: Props = $props();

	interface LogData {
		message?: string;
		reason?: string;
		stack?: string;
		sentiment?: string;
		comment?: string;
		[key: string]: unknown;
	}

	interface LogEvent {
		timestamp: number;
		event: string;
		data?: LogData;
	}

	interface SessionMetadata {
		id: string;
		projectId: string;
		createdAt: string;
		duration: number | null;
		avgFps: number | null;
		sentiment: string | null;
		gpuRenderer: string | null;
		hasCrashed: boolean;
		logCount: number;
	}

	let logs = $state<LogEvent[]>([]);
	let sessionData = $state<SessionMetadata | null>(null);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let selectedFilter = $state<'all' | 'error' | 'warn' | 'log' | 'feedback'>('all');
	let searchQuery = $state('');

	async function fetchLogs() {
		if (!sessionId || !projectId) return;

		isLoading = true;
		fetchError = null;

		try {
			const res = await fetch(`/api/games/${projectId}/sessions/${sessionId}`);
			if (!res.ok) {
				const err = (await res.json().catch(() => ({}))) as { message?: string };
				throw new Error(err.message || `Failed to fetch telemetry logs (HTTP ${res.status})`);
			}
			const json = (await res.json()) as { logs?: LogEvent[]; session?: SessionMetadata };
			logs = json.logs || [];
			sessionData = json.session || null;
		} catch (err: unknown) {
			fetchError = err instanceof Error ? err.message : 'Error retrieving telemetry from edge storage';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (isOpen && sessionId) {
			fetchLogs();
		} else {
			logs = [];
			sessionData = null;
			fetchError = null;
		}
	});

	const filteredLogs = $derived(
		logs.filter((log) => {
			if (selectedFilter === 'error') {
				const isErr =
					log.event === 'console.error' ||
					log.event === 'error' ||
					log.event === 'unhandledrejection';
				if (!isErr) return false;
			} else if (selectedFilter === 'warn') {
				if (log.event !== 'console.warn') return false;
			} else if (selectedFilter === 'feedback') {
				if (log.event !== 'feedback') return false;
			} else if (selectedFilter === 'log') {
				if (log.event.startsWith('console.error') || log.event === 'console.warn' || log.event === 'feedback') return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const str = `${log.event} ${JSON.stringify(log.data || {})}`.toLowerCase();
				return str.includes(q);
			}

			return true;
		})
	);

	function formatTimestamp(ts: number) {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
	}
</script>

{#snippet logEntry(log: LogEvent)}
	{#if log.event === 'console.error' || log.event === 'error' || log.event === 'unhandledrejection'}
		<div class="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-rose-300 shadow-xs">
			<div class="flex items-center justify-between pb-2">
				<span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-rose-400">
					<span class="h-2 w-2 rounded-full bg-rose-500"></span>
					{log.event.toUpperCase()}
				</span>
				<span class="font-mono text-[10px] text-slate-400">{formatTimestamp(log.timestamp)}</span>
			</div>
			<div class="font-mono text-xs leading-relaxed whitespace-pre-wrap text-rose-200">
				{log.data?.message || log.data?.reason || JSON.stringify(log.data)}
			</div>
			{#if log.data?.stack}
				<details class="mt-3">
					<summary class="cursor-pointer font-sans text-[11px] font-semibold text-rose-400 hover:underline">
						View Stack Trace
					</summary>
					<pre class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-400">{log.data.stack}</pre>
				</details>
			{/if}
		</div>
	{:else if log.event === 'console.warn'}
		<div class="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-amber-300">
			<div class="flex items-center justify-between">
				<span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-400">
					<span class="h-2 w-2 rounded-full bg-amber-500"></span>
					WARN
				</span>
				<span class="font-mono text-[10px] text-slate-400">{formatTimestamp(log.timestamp)}</span>
			</div>
			<p class="mt-1 font-mono text-xs text-slate-200">
				{log.data?.message || JSON.stringify(log.data)}
			</p>
		</div>
	{:else if log.event === 'feedback'}
		<div class="rounded-xl border border-purple-500/30 bg-purple-950/30 p-4 text-purple-200">
			<div class="flex items-center justify-between">
				<span class="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-purple-300">
					<span class="h-2 w-2 rounded-full bg-purple-400"></span>
					PLAYTESTER FEEDBACK
				</span>
				<span class="font-mono text-[10px] text-slate-400">{formatTimestamp(log.timestamp)}</span>
			</div>
			<div class="mt-2 flex items-center gap-2">
				<span class="rounded-md bg-purple-900/60 px-2 py-0.5 font-mono text-xs font-bold text-purple-200 uppercase">
					Rating: {log.data?.sentiment || 'Neutral'}
				</span>
			</div>
			{#if log.data?.comment}
				<p class="mt-2 rounded-lg bg-slate-950/60 p-3 font-sans text-xs text-slate-300 italic">
					"{log.data.comment}"
				</p>
			{/if}
		</div>
	{:else}
		<div class="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5 font-mono text-xs text-slate-300 hover:bg-slate-900">
			<span class="text-slate-500">[{formatTimestamp(log.timestamp)}]</span>
			<span class="font-bold text-blue-400">{log.event}:</span>
			<span class="flex-1 whitespace-pre-wrap text-slate-200">{log.data?.message || JSON.stringify(log.data)}</span>
		</div>
	{/if}
{/snippet}

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
		<div class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-100 p-6">
				<div>
					<div class="flex items-center gap-3">
						<h3 class="text-lg font-bold tracking-tight text-slate-900">Session Inspector</h3>
						<span class="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600">
							ID: {sessionId.slice(0, 12)}
						</span>
					</div>
					{#if sessionData}
						<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
							{#if sessionData.avgFps}
								<span class="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
									<Activity class="h-3 w-3" /> {sessionData.avgFps} FPS
								</span>
							{/if}
							{#if sessionData.sentiment}
								<span class="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 uppercase">
									{sessionData.sentiment}
								</span>
							{/if}
							{#if sessionData.gpuRenderer}
								<span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-600" title={sessionData.gpuRenderer}>
									<Monitor class="h-3 w-3" /> {sessionData.gpuRenderer.slice(0, 24)}...
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<button
					onclick={onClose}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close inspector"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Filter Ribbon -->
			<div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-4">
				<div class="flex items-center gap-1.5">
					<button
						onclick={() => (selectedFilter = 'all')}
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-all {selectedFilter === 'all'
							? 'bg-slate-900 text-white'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}"
					>
						All Logs ({logs.length})
					</button>
					<button
						onclick={() => (selectedFilter = 'error')}
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-all {selectedFilter === 'error'
							? 'bg-rose-600 text-white'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}"
					>
						Errors
					</button>
					<button
						onclick={() => (selectedFilter = 'warn')}
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-all {selectedFilter === 'warn'
							? 'bg-amber-600 text-white'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}"
					>
						Warnings
					</button>
					<button
						onclick={() => (selectedFilter = 'log')}
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-all {selectedFilter === 'log'
							? 'bg-blue-600 text-white'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}"
					>
						Console Logs
					</button>
					<button
						onclick={() => (selectedFilter = 'feedback')}
						class="rounded-lg px-3 py-1 text-xs font-semibold transition-all {selectedFilter === 'feedback'
							? 'bg-purple-600 text-white'
							: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}"
					>
						Feedback
					</button>
				</div>

				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search telemetry events..."
					class="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
				/>
			</div>

			<!-- Terminal Logs Container -->
			<div class="flex-1 overflow-y-auto bg-slate-950 p-5 font-mono text-xs">
				{#if isLoading}
					<div class="flex h-48 flex-col items-center justify-center space-y-2 text-slate-400">
						<Terminal class="h-6 w-6 animate-pulse text-purple-400" />
						<p class="font-sans text-xs">Loading session telemetry from R2...</p>
					</div>
				{:else if fetchError}
					<div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-400">
						<p class="font-sans font-bold">Failed to load session details</p>
						<p class="mt-1 text-xs opacity-80">{fetchError}</p>
					</div>
				{:else if filteredLogs.length === 0}
					<div class="flex h-48 flex-col items-center justify-center text-slate-500">
						<p class="font-sans text-xs">No console events match your current filter.</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each filteredLogs as log, idx (idx)}
							{@render logEntry(log)}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-between border-t border-slate-100 p-4 text-xs text-slate-500">
				<span>Showing {filteredLogs.length} events</span>
				<button
					onclick={onClose}
					class="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
