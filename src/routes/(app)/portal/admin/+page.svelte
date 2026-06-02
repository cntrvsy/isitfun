<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();

	// Stats cards
	const cards = $derived([
		{ name: 'Total System Users', value: data.stats.totalUsers, icon: '👥', color: 'from-blue-500 to-cyan-500' },
		{ name: 'Total Active Projects', value: data.stats.totalProjects, icon: '📦', color: 'from-purple-500 to-indigo-500' },
		{ name: 'Telemetry Sessions', value: data.stats.totalSessions, icon: '⚡', color: 'from-pink-500 to-rose-500' },
		{ name: 'Telemetry Log Records', value: data.stats.totalLogs, icon: '📊', color: 'from-emerald-500 to-teal-500' }
	]);
</script>

<svelte:head>
	<title>Admin System Console | IsItFun</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-6 mt-12 relative z-10">
	<!-- Admin Header -->
	<header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
		<div>
			<span class="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Security & Analytics Console</span>
			<h1 id="main-title" class="text-4xl md:text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
				System Admin Console
			</h1>
			<p class="text-slate-400 text-base">Global platform analytics, observer metrics, and system diagnostics.</p>
		</div>
		
		<div class="flex items-center gap-3">
			<a href={resolve('/portal/dashboard')} class="btn bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl">
				Developer Portal
			</a>
		</div>
	</header>

	<!-- Stats Grid -->
	<section class="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
		{#each cards as c (c.name)}
			<div class="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-2xl">
				<!-- Ambient accent glow -->
				<div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr {c.color} opacity-[0.03] rounded-full blur-2xl"></div>
				<div class="flex items-center justify-between mb-4">
					<span class="text-3xl">{c.icon}</span>
					<span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[9px] uppercase tracking-wider">Edge-Synced</span>
				</div>
				<h3 class="text-3xl font-black text-white tracking-tight mb-1">{c.value}</h3>
				<p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">{c.name}</p>
			</div>
		{/each}
	</section>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- Left main panel: User Role breakdown -->
		<section class="lg:col-span-2 space-y-6">
			<div class="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
				<h3 class="text-xl font-extrabold tracking-tight text-white mb-6">User Accounts & Roles</h3>
				
				<div class="overflow-x-auto">
					<table class="table w-full text-slate-300 border-collapse">
						<thead>
							<tr class="border-b border-slate-800/80 text-slate-400 text-xs uppercase font-extrabold tracking-wider">
								<th class="py-4 text-left">Role Profile</th>
								<th class="py-4 text-center">Description</th>
								<th class="py-4 text-right">Count</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-850">
							{#each data.roleDistribution as item (item.role)}
								<tr class="hover:bg-slate-900/20 transition-all">
									<td class="py-4 font-bold text-white capitalize flex items-center gap-2">
										<span class="w-2.5 h-2.5 rounded-full {item.role === 'admin' ? 'bg-indigo-500' : item.role === 'game_developer' ? 'bg-purple-500' : 'bg-pink-500'}"></span>
										{item.role.replace('_', ' ')}
									</td>
									<td class="py-4 text-center text-xs text-slate-400 font-medium">
										{#if item.role === 'admin'}
											Core platform administration and metrics scrutiny.
										{:else if item.role === 'game_developer'}
											Uploads game ZIPs and analyzes player telemetry.
										{:else}
											Frictionless playtester account.
										{/if}
									</td>
									<td class="py-4 text-right font-mono font-bold text-white text-base">
										{item.count}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="3" class="py-8 text-center text-slate-500 font-bold italic">
										No user roles detected.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- Right sidebar: System diagnostic status -->
		<section class="space-y-6">
			<div class="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
				<!-- High-tech top line -->
				<div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500"></div>
				
				<h3 class="text-xl font-extrabold tracking-tight text-white mb-6">Diagnostic State</h3>
				
				<div class="space-y-6">
					<div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
						<div>
							<h4 class="font-bold text-white text-sm">D1 SQLite Database</h4>
							<span class="text-[10px] text-slate-500 font-mono">isitfun-db</span>
						</div>
						<span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 rounded-full">
							Online
						</span>
					</div>

					<div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
						<div>
							<h4 class="font-bold text-white text-sm">R2 Asset Storage</h4>
							<span class="text-[10px] text-slate-500 font-mono">GAMES_BUCKET</span>
						</div>
						<span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 rounded-full">
							Online
						</span>
					</div>

					<div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
						<div>
							<h4 class="font-bold text-white text-sm">Better Auth Service</h4>
							<span class="text-[10px] text-slate-500 font-mono">v1.6.9 minimal</span>
						</div>
						<span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 rounded-full">
							Active
						</span>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
