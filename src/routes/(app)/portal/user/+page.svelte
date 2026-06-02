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
		{ name: 'Nebula Runner 2060', date: '2 hours ago', rating: 5, status: 'Reviewed', developer: 'Studio Cyber' },
		{ name: 'Retro Pong Edge', date: 'Yesterday', rating: 4, status: 'Reviewed', developer: 'BitForge Games' },
		{ name: 'Godot Castle Quest', date: '3 days ago', rating: 3, status: 'Feedback sent', developer: 'Astra Inc.' }
	];
</script>

<svelte:head>
	<title>Playtester Portal | IsItFun</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-6 mt-12 relative z-10">
	<!-- Top Welcome Header -->
	<header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
		<div>
			<span class="text-xs uppercase font-extrabold tracking-widest text-purple-400">Tester Hub</span>
			<h1 id="main-title" class="text-4xl md:text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
				Tester Dashboard
			</h1>
			<p class="text-slate-400 text-base">Your hub for providing quality insights and shaping awesome games.</p>
		</div>
		
		<div class="flex items-center gap-3">
			<a href={resolve('/portal/profile')} class="btn btn-outline border-slate-800 text-slate-300 hover:text-white rounded-xl">
				Edit Profile
			</a>
		</div>
	</header>

	<!-- Cyber Stats Grid -->
	<section class="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
		{#each stats as s (s.name)}
			<div class="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl">
				<!-- Micro background gradient -->
				<div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr {s.color} opacity-[0.03] rounded-full blur-2xl"></div>
				<div class="flex items-center justify-between mb-4">
					<span class="text-3xl">{s.icon}</span>
					<span class="text-xs font-mono uppercase tracking-widest text-slate-500">Active</span>
				</div>
				<h3 class="text-3xl font-black text-white tracking-tight mb-1">{s.value}</h3>
				<p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">{s.name}</p>
			</div>
		{/each}
	</section>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- Left main panel: Participation history -->
		<section class="lg:col-span-2 space-y-6">
			<div class="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
				<h3 class="text-xl font-extrabold tracking-tight text-white mb-6">Recent Playtest Engagements</h3>
				
				<div class="space-y-4">
					{#each participations as p (p.name)}
						<div class="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-950/40 border border-slate-850 rounded-2xl gap-4 hover:border-purple-500/20 transition-all duration-300">
							<div class="flex items-center gap-4">
								<div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-xl text-purple-400 border border-purple-500/15">
									🎮
								</div>
								<div>
									<h4 class="font-bold text-white text-base">{p.name}</h4>
									<p class="text-xs text-slate-500">Developer: <span class="text-slate-400">{p.developer}</span> • {p.date}</p>
								</div>
							</div>
							
							<div class="flex items-center gap-4 justify-between sm:justify-end">
								<!-- Star rating -->
								<div class="flex gap-0.5">
									{#each Array(5) as _, i (i)}
										<span class="text-xs {i < p.rating ? 'text-amber-400' : 'text-slate-700'}">★</span>
									{/each}
								</div>
								<span class="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
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
			<div class="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
				<!-- Top accent line -->
				<div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-pink-500"></div>
				
				<h3 class="text-xl font-extrabold tracking-tight text-white mb-6">Next Milestones</h3>
				
				<div class="space-y-6">
					<div>
						<div class="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
							<span class="text-slate-300">Beta Pioneer Badge</span>
							<span class="text-purple-400">80%</span>
						</div>
						<div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
							<div class="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full" style="width: 80%"></div>
						</div>
						<p class="text-[10px] text-slate-500 mt-1">Submit feedback for 2 more prototype playtests.</p>
					</div>

					<div>
						<div class="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
							<span class="text-slate-300">Super Bug Hunter</span>
							<span class="text-pink-400">45%</span>
						</div>
						<div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
							<div class="bg-gradient-to-r from-pink-500 to-rose-500 h-full rounded-full" style="width: 45%"></div>
						</div>
						<p class="text-[10px] text-slate-500 mt-1">Report 10 total browser errors (currently at 9).</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
