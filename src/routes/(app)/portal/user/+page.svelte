<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();

	// Mock statistics for high-fidelity demonstration
	const stats = [
		{ name: 'Games Tested', value: '14', icon: '🎮', color: 'from-purple-500 to-indigo-500' },
		{ name: 'Feedback Submitted', value: '38', icon: '📝', color: 'from-pink-500 to-rose-500' },
		{ name: 'Bugs Spotted', value: '9', icon: '🐛', color: 'from-amber-500 to-orange-500' },
		{ name: 'Experience Level', value: 'Lv. 4', icon: '⭐', color: 'from-emerald-500 to-teal-500' }
	];

	// Mock playtest participation list
	const participations = [
		{
			name: 'Nebula Runner 2060',
			date: '2 hours ago',
			rating: 5,
			status: 'Reviewed',
			developer: 'Studio Cyber'
		},
		{
			name: 'Retro Pong Edge',
			date: 'Yesterday',
			rating: 4,
			status: 'Reviewed',
			developer: 'BitForge Games'
		},
		{
			name: 'Godot Castle Quest',
			date: '3 days ago',
			rating: 3,
			status: 'Feedback sent',
			developer: 'Astra Inc.'
		}
	];
</script>

<svelte:head>
	<title>Playtester Portal | IsItFun</title>
</svelte:head>

<div class="relative z-10 mx-auto mt-12 max-w-5xl px-6">
	<!-- Top Welcome Header -->
	<header class="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-center">
		<div>
			<span class="text-xs font-extrabold tracking-widest text-purple-400 uppercase"
				>Tester Hub</span
			>
			<h1
				id="main-title"
				class="mb-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl"
			>
				Tester Dashboard
			</h1>
			<p class="text-base text-slate-400">
				Your hub for providing quality insights and shaping awesome games.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<a
				href={resolve('/portal/profile')}
				class="btn rounded-xl border-slate-800 text-slate-300 btn-outline hover:text-white"
			>
				Edit Profile
			</a>
		</div>
	</header>

	<!-- Cyber Stats Grid -->
	<section class="mb-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
		{#each stats as s (s.name)}
			<div
				class="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-slate-700 hover:shadow-2xl"
			>
				<!-- Micro background gradient -->
				<div
					class="absolute top-0 right-0 h-24 w-24 bg-gradient-to-tr {s.color} rounded-full opacity-[0.03] blur-2xl"
				></div>
				<div class="mb-4 flex items-center justify-between">
					<span class="text-3xl">{s.icon}</span>
					<span class="font-mono text-xs tracking-widest text-slate-500 uppercase">Active</span>
				</div>
				<h3 class="mb-1 text-3xl font-black tracking-tight text-white">{s.value}</h3>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">{s.name}</p>
			</div>
		{/each}
	</section>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- Left main panel: Participation history -->
		<section class="space-y-6 lg:col-span-2">
			<div class="rounded-3xl border border-slate-800 bg-slate-900/30 p-8 backdrop-blur-md">
				<h3 class="mb-6 text-xl font-extrabold tracking-tight text-white">
					Recent Playtest Engagements
				</h3>

				<div class="space-y-4">
					{#each participations as p (p.name)}
						<div
							class="border-slate-850 flex flex-col justify-between gap-4 rounded-2xl border bg-slate-950/40 p-5 transition-all duration-300 hover:border-purple-500/20 sm:flex-row sm:items-center"
						>
							<div class="flex items-center gap-4">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/15 bg-purple-500/10 text-xl text-purple-400"
								>
									🎮
								</div>
								<div>
									<h4 class="text-base font-bold text-white">{p.name}</h4>
									<p class="text-xs text-slate-500">
										Developer: <span class="text-slate-400">{p.developer}</span> • {p.date}
									</p>
								</div>
							</div>

							<div class="flex items-center justify-between gap-4 sm:justify-end">
								<!-- Star rating -->
								<div class="flex gap-0.5">
									{#each Array(5) as _, i (i)}
										<span class="text-xs {i < p.rating ? 'text-amber-400' : 'text-slate-700'}"
											>★</span
										>
									{/each}
								</div>
								<span
									class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-extrabold tracking-wider text-emerald-400 uppercase"
								>
									{p.status}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Right sidebar: Achievements and rewards -->
		<section class="space-y-6">
			<div
				class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/30 p-8 backdrop-blur-md"
			>
				<!-- Top accent line -->
				<div
					class="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-purple-500 to-pink-500"
				></div>

				<h3 class="mb-6 text-xl font-extrabold tracking-tight text-white">Next Milestones</h3>

				<div class="space-y-6">
					<div>
						<div class="mb-2 flex justify-between text-xs font-bold tracking-wider uppercase">
							<span class="text-slate-300">Beta Pioneer Badge</span>
							<span class="text-purple-400">80%</span>
						</div>
						<div
							class="border-slate-850 h-2 w-full overflow-hidden rounded-full border bg-slate-950"
						>
							<div
								class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
								style="width: 80%"
							></div>
						</div>
						<p class="mt-1 text-[10px] text-slate-500">
							Submit feedback for 2 more prototype playtests.
						</p>
					</div>

					<div>
						<div class="mb-2 flex justify-between text-xs font-bold tracking-wider uppercase">
							<span class="text-slate-300">Super Bug Hunter</span>
							<span class="text-pink-400">45%</span>
						</div>
						<div
							class="border-slate-850 h-2 w-full overflow-hidden rounded-full border bg-slate-950"
						>
							<div
								class="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500"
								style="width: 45%"
							></div>
						</div>
						<p class="mt-1 text-[10px] text-slate-500">
							Report 10 total browser errors (currently at 9).
						</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
