<script lang="ts">
	import { LineChart, defaultChartPadding } from 'layerchart';
	import { SvelteMap, SvelteDate } from 'svelte/reactivity';

	interface SessionSummary {
		id: string;
		createdAt: string | number | Date;
		duration: number | null;
		logCount: number;
		hasCrashed: boolean;
		sentiment?: 'fun' | 'neutral' | 'unfun' | null;
		avgFps?: number | null;
	}

	let { sessions = [] } = $props<{
		sessions: SessionSummary[];
	}>();

	// Process daily aggregated timeline data for the last 14 days
	const timelineData = $derived.by(() => {
		const daysMap = new SvelteMap<string, { date: Date; count: number; duration: number }>();

		// Initialize last 14 days
		const now = new SvelteDate();
		for (let i = 13; i >= 0; i--) {
			const d = new SvelteDate(now);
			d.setDate(d.getDate() - i);
			d.setHours(0, 0, 0, 0);
			const key = d.toISOString().split('T')[0];
			daysMap.set(key, { date: d, count: 0, duration: 0 });
		}

		// Populate with actual session data
		for (const s of sessions) {
			const sDate = new Date(s.createdAt);
			const key = sDate.toISOString().split('T')[0];
			if (daysMap.has(key)) {
				const dayObj = daysMap.get(key)!;
				dayObj.count += 1;
				dayObj.duration += s.duration || 0;
			}
		}

		return Array.from(daysMap.values());
	});

	// Sentiment stats
	const sentimentStats = $derived.by(() => {
		let fun = 0;
		let neutral = 0;
		let unfun = 0;
		let total = 0;

		for (const s of sessions) {
			if (s.sentiment === 'fun') fun++;
			else if (s.sentiment === 'neutral') neutral++;
			else if (s.sentiment === 'unfun') unfun++;
			if (s.sentiment) total++;
		}

		return {
			fun,
			neutral,
			unfun,
			total,
			funPct: total > 0 ? Math.round((fun / total) * 100) : 0,
			neutralPct: total > 0 ? Math.round((unfun / total) * 100) : 0,
			unfunPct: total > 0 ? Math.round((unfun / total) * 100) : 0
		};
	});
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
	<!-- Chart 1: 14-Day Playtest Sessions Trend (layerchart LineChart) -->
	<div
		class="rounded-3xl border border-purple-200/50 bg-white/60 p-6 shadow-sm backdrop-blur-md lg:col-span-2"
	>
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h3 class="font-mono text-lg font-black text-slate-900">Daily Playtest Sessions</h3>
				<p class="text-xs font-medium text-slate-600">Total volume of playtest runs over the past 14 days.</p>
			</div>
			<span
				class="border border-purple-200 bg-purple-50 px-3 py-1 font-mono text-xs font-bold text-purple-700 uppercase"
			>
				14-Day Trend
			</span>
		</div>

		<div class="h-64 w-full">
			<LineChart
				data={timelineData}
				x="date"
				y="count"
				padding={defaultChartPadding({ right: 10, top: 10 })}
				height={240}
			/>
		</div>
	</div>

	<!-- Chart 2: Player Sentiment Breakdown -->
	<div
		class="flex flex-col justify-between rounded-3xl border border-purple-200/50 bg-white/60 p-6 shadow-sm backdrop-blur-md"
	>
		<div>
			<h3 class="font-mono text-lg font-black text-slate-900">Player Sentiment</h3>
			<p class="text-xs font-medium text-slate-600">Qualitative feedback ratings collected from playtesters.</p>

			<div class="mt-6 space-y-4">
				<!-- Fun -->
				<div class="space-y-1">
					<div class="flex justify-between font-mono text-xs font-bold">
						<span class="text-emerald-700">😀 Fun ({sentimentStats.fun})</span>
						<span class="text-slate-600">{sentimentStats.funPct}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-purple-100/60">
						<div
							class="h-full bg-emerald-500 transition-all duration-500"
							style="width: {sentimentStats.funPct}%"
						></div>
					</div>
				</div>

				<!-- Neutral -->
				<div class="space-y-1">
					<div class="flex justify-between font-mono text-xs font-bold">
						<span class="text-amber-700">😐 Okay ({sentimentStats.neutral})</span>
						<span class="text-slate-600">{sentimentStats.neutralPct}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-purple-100/60">
						<div
							class="h-full bg-amber-500 transition-all duration-500"
							style="width: {sentimentStats.neutralPct}%"
						></div>
					</div>
				</div>

				<!-- Unfun -->
				<div class="space-y-1">
					<div class="flex justify-between font-mono text-xs font-bold">
						<span class="text-rose-700">🙁 Unfun ({sentimentStats.unfun})</span>
						<span class="text-slate-600">{sentimentStats.unfunPct}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-purple-100/60">
						<div
							class="h-full bg-rose-500 transition-all duration-500"
							style="width: {sentimentStats.unfunPct}%"
						></div>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-6 rounded-2xl border border-purple-200/60 bg-white/80 p-4 text-center shadow-xs">
			<span class="block font-mono text-[10px] font-bold tracking-widest text-purple-700 uppercase"
				>Total Rated Playtests</span
			>
			<span class="font-mono text-2xl font-black text-slate-900">{sentimentStats.total} Ratings</span>
		</div>
	</div>
</div>
