<script lang="ts">
	interface TelemetryLogData {
		message?: string;
		reason?: string;
		stack?: string;
		sentiment?: string;
		comment?: string;
		[key: string]: unknown;
	}

	interface TelemetryLog {
		event: string;
		data?: TelemetryLogData | null;
		timestamp: number;
	}

	interface SessionDetails {
		projectId: string;
		sessionId: string;
		createdAt: string;
		logs?: TelemetryLog[];
		logCount?: number;
		hasCrashed?: boolean;
		avgFps?: number | null;
		gpuRenderer?: string | null;
		sentiment?: 'fun' | 'neutral' | 'unfun' | null;
		userComment?: string | null;
	}

	let {
		isOpen = false,
		sessionId = '',
		projectId = '',
		onClose = () => {}
	} = $props<{
		isOpen: boolean;
		sessionId: string;
		projectId: string;
		onClose: () => void;
	}>();

	let sessionData = $state<SessionDetails | null>(null);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedFilter = $state<'all' | 'error' | 'warn' | 'log' | 'feedback'>('all');

	$effect(() => {
		if (isOpen && sessionId && projectId) {
			loadSessionDetails();
		} else {
			sessionData = null;
			fetchError = null;
		}
	});

	async function loadSessionDetails() {
		isLoading = true;
		fetchError = null;

		try {
			const res = await fetch(`/api/portal/projects/${projectId}/sessions/${sessionId}`);
			if (!res.ok) {
				throw new Error(`Failed to load session details (${res.status})`);
			}
			sessionData = await res.json();
		} catch (err: unknown) {
			fetchError = err instanceof Error ? err.message : 'Error fetching session logs';
		} finally {
			isLoading = false;
		}
	}

	const filteredLogs = $derived(() => {
		if (!sessionData || !sessionData.logs) return [];
		return sessionData.logs.filter((log) => {
			// Level filter
			if (selectedFilter === 'error' && log.event !== 'console.error' && log.event !== 'error' && log.event !== 'unhandledrejection') {
				return false;
			}
			if (selectedFilter === 'warn' && log.event !== 'console.warn') {
				return false;
			}
			if (selectedFilter === 'log' && log.event !== 'console.log') {
				return false;
			}
			if (selectedFilter === 'feedback' && log.event !== 'feedback') {
				return false;
			}

			// Search query filter
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const msg = JSON.stringify(log.data || {}).toLowerCase();
				return msg.includes(query) || log.event.toLowerCase().includes(query);
			}

			return true;
		});
	});

	function formatTimestamp(ts: number) {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
	}
</script>

{#if isOpen}
	<!-- Modal Backdrop -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
		<div class="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-6">
				<div class="space-y-1">
					<div class="flex items-center gap-3">
						<h3 class="text-xl font-black text-white">Console Session Inspector</h3>
						<span class="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-purple-400">
							ID: {sessionId.slice(0, 12)}...
						</span>
					</div>
					{#if sessionData}
						<div class="flex flex-wrap items-center gap-2 pt-1 text-xs">
							{#if sessionData.avgFps}
								<span class="rounded border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 font-mono font-bold text-purple-300">
									⚡ {sessionData.avgFps} Avg FPS
								</span>
							{/if}
							{#if sessionData.sentiment}
								<span class="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-bold uppercase text-emerald-400">
									{sessionData.sentiment === 'fun' ? '😀 FUN' : sessionData.sentiment === 'neutral' ? '😐 OKAY' : '🙁 UNFUN'}
								</span>
							{/if}
							{#if sessionData.gpuRenderer}
								<span class="rounded border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-slate-400" title={sessionData.gpuRenderer}>
									🖥️ {sessionData.gpuRenderer.slice(0, 30)}...
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<button onclick={onClose} class="rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white">
					✕
				</button>
			</div>

			<!-- Search & Filter Controls -->
			<div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/50 p-4">
				<div class="flex items-center gap-2">
					<button
						onclick={() => (selectedFilter = 'all')}
						class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {selectedFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}"
					>
						All Logs
					</button>
					<button
						onclick={() => (selectedFilter = 'error')}
						class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {selectedFilter === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}"
					>
						Errors
					</button>
					<button
						onclick={() => (selectedFilter = 'warn')}
						class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {selectedFilter === 'warn' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}"
					>
						Warnings
					</button>
					<button
						onclick={() => (selectedFilter = 'log')}
						class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {selectedFilter === 'log' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}"
					>
						Console Logs
					</button>
					<button
						onclick={() => (selectedFilter = 'feedback')}
						class="rounded-xl px-3 py-1.5 text-xs font-bold transition-all {selectedFilter === 'feedback' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}"
					>
						Feedback
					</button>
				</div>

				<div class="w-full sm:w-64">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search logs or errors..."
						class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
					/>
				</div>
			</div>

			<!-- Terminal Console Logs Stream Body -->
			<div class="flex-1 overflow-y-auto bg-slate-950 p-6 font-mono text-xs">
				{#if isLoading}
					<div class="flex h-64 flex-col items-center justify-center space-y-3 text-slate-500">
						<span class="loading loading-spinner loading-md text-purple-500"></span>
						<p class="font-sans text-xs">Loading session telemetry logs from R2...</p>
					</div>
				{:else if fetchError}
					<div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-400">
						<p class="font-sans font-bold">Failed to load session details</p>
						<p class="mt-1 text-xs opacity-80">{fetchError}</p>
					</div>
				{:else if filteredLogs().length === 0}
					<div class="flex h-48 flex-col items-center justify-center space-y-2 text-slate-600">
						<p class="font-sans font-bold">No console events match your current filter.</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each filteredLogs() as log, idx (idx)}
							{#if log.event === 'console.error' || log.event === 'error' || log.event === 'unhandledrejection'}
								<div class="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-rose-300 shadow-md">
									<div class="flex items-center justify-between pb-2">
										<span class="font-bold text-rose-400">💥 {log.event.toUpperCase()}</span>
										<span class="text-[10px] opacity-60">{formatTimestamp(log.timestamp)}</span>
									</div>
									<div class="whitespace-pre-wrap font-mono text-xs leading-relaxed text-rose-200">
										{log.data?.message || log.data?.reason || JSON.stringify(log.data)}
									</div>
									{#if log.data?.stack}
										<details class="mt-3">
											<summary class="cursor-pointer font-sans text-[11px] font-bold text-rose-400 hover:underline">
												View Stack Trace
											</summary>
											<pre class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-400">{log.data.stack}</pre>
										</details>
									{/if}
								</div>
							{:else if log.event === 'console.warn'}
								<div class="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-amber-300">
									<span class="text-amber-400">⚠️</span>
									<div class="flex-1">
										<div class="flex items-center justify-between">
											<span class="font-bold text-amber-400">WARN</span>
											<span class="text-[10px] opacity-60">{formatTimestamp(log.timestamp)}</span>
										</div>
										<p class="mt-1 text-slate-200">{log.data?.message || JSON.stringify(log.data)}</p>
									</div>
								</div>
							{:else if log.event === 'feedback'}
								<div class="rounded-xl border border-purple-500/30 bg-purple-950/30 p-4 text-purple-200">
									<div class="flex items-center justify-between">
										<span class="font-bold text-purple-300">🎮 PLAYTESTER FEEDBACK</span>
										<span class="text-[10px] opacity-60">{formatTimestamp(log.timestamp)}</span>
									</div>
									<div class="mt-2 flex items-center gap-2">
										<span class="text-xl">{log.data?.sentiment === 'fun' ? '😀' : log.data?.sentiment === 'neutral' ? '😐' : '🙁'}</span>
										<span class="font-sans font-bold capitalize">{log.data?.sentiment}</span>
									</div>
									{#if log.data?.comment}
										<p class="mt-2 rounded-lg bg-slate-950/60 p-3 font-sans text-xs italic text-slate-300">
											"{log.data.comment}"
										</p>
									{/if}
								</div>
							{:else}
								<div class="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5 text-slate-300 hover:bg-slate-900">
									<span class="text-slate-500">[{formatTimestamp(log.timestamp)}]</span>
									<span class="font-bold text-blue-400">{log.event}:</span>
									<span class="flex-1 whitespace-pre-wrap text-slate-200">{log.data?.message || JSON.stringify(log.data)}</span>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">
				<span>Showing {filteredLogs().length} log events</span>
				<button onclick={onClose} class="btn rounded-xl border border-slate-800 bg-slate-900 px-4 font-bold text-slate-300 btn-sm hover:bg-slate-800 hover:text-white">
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
