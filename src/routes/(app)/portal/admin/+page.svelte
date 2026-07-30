<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();

	// Stats cards
	const cards = $derived([
		{
			name: 'Total System Users',
			value: data.stats.totalUsers,
			icon: '👥',
			color: 'from-blue-500 to-cyan-500'
		},
		{
			name: 'Total Active Projects',
			value: data.stats.totalProjects,
			icon: '📦',
			color: 'from-purple-500 to-indigo-500'
		},
		{
			name: 'Telemetry Sessions',
			value: data.stats.totalSessions,
			icon: '⚡',
			color: 'from-pink-500 to-rose-500'
		},
		{
			name: 'Telemetry Log Records',
			value: data.stats.totalLogs,
			icon: '📊',
			color: 'from-emerald-500 to-teal-500'
		}
	]);
</script>

<svelte:head>
	<title>Admin System Console | IsItFun</title>
</svelte:head>

<div class="relative z-10 mx-auto mt-12 max-w-6xl px-6">
	<!-- Admin Header -->
	<header class="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-center">
		<div>
			<span class="text-xs font-extrabold tracking-widest text-indigo-400 uppercase"
				>Security & Analytics Console</span
			>
			<h1
				id="main-title"
				class="mb-2 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl"
			>
				System Admin Console
			</h1>
			<p class="text-base text-slate-400">
				Global platform analytics, observer metrics, and system diagnostics.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<a
				href={resolve('/(app)/portal/dashboard')}
				class="btn rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
			>
				Developer Portal
			</a>
		</div>
	</header>

	<!-- Stats Grid -->
	<section class="mb-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
		{#each cards as c (c.name)}
			<div
				class="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-slate-700 hover:shadow-2xl"
			>
				<!-- Ambient accent glow -->
				<div
					class="absolute top-0 right-0 h-24 w-24 bg-gradient-to-tr {c.color} rounded-full opacity-[0.03] blur-2xl"
				></div>
				<div class="mb-4 flex items-center justify-between">
					<span class="text-3xl">{c.icon}</span>
					<span
						class="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-indigo-400 uppercase"
						>Edge-Synced</span
					>
				</div>
				<h3 class="mb-1 text-3xl font-black tracking-tight text-white">{c.value}</h3>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">{c.name}</p>
			</div>
		{/each}
	</section>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- Left main panel: User Role breakdown -->
		<section class="space-y-6 lg:col-span-2">
			<div class="rounded-3xl border border-slate-800 bg-slate-900/30 p-8 backdrop-blur-md">
				<h3 class="mb-6 text-xl font-extrabold tracking-tight text-white">User Accounts & Roles</h3>

				<div class="overflow-x-auto">
					<table class="table w-full border-collapse text-slate-300">
						<thead>
							<tr
								class="border-b border-slate-800/80 text-xs font-extrabold tracking-wider text-slate-400 uppercase"
							>
								<th class="py-4 text-left">Role Profile</th>
								<th class="py-4 text-center">Description</th>
								<th class="py-4 text-right">Count</th>
							</tr>
						</thead>
						<tbody class="divide-slate-850 divide-y">
							{#each data.roleDistribution as item (item.role)}
								<tr class="transition-all hover:bg-slate-900/20">
									<td class="flex items-center gap-2 py-4 font-bold text-white capitalize">
										<span
											class="h-2.5 w-2.5 rounded-full {item.role === 'admin'
												? 'bg-indigo-500'
												: item.role === 'game_developer'
													? 'bg-purple-500'
													: 'bg-pink-500'}"
										></span>
										{item.role.replace('_', ' ')}
									</td>
									<td class="py-4 text-center text-xs font-medium text-slate-400">
										{#if item.role === 'admin'}
											Core platform administration and metrics scrutiny.
										{:else if item.role === 'game_developer'}
											Uploads game ZIPs and analyzes player telemetry.
										{:else}
											Frictionless playtester account.
										{/if}
									</td>
									<td class="py-4 text-right font-mono text-base font-bold text-white">
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
			<div
				class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/30 p-8 backdrop-blur-md"
			>
				<!-- High-tech top line -->
				<div
					class="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500"
				></div>

				<h3 class="mb-6 text-xl font-extrabold tracking-tight text-white">Diagnostic State</h3>

				<div class="space-y-6">
					<div
						class="border-slate-850 flex items-center justify-between rounded-2xl border bg-slate-950/40 p-4"
					>
						<div>
							<h4 class="text-sm font-bold text-white">D1 SQLite Database</h4>
							<span class="font-mono text-[10px] text-slate-500">isitfun-db</span>
						</div>
						<span
							class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-extrabold tracking-widest text-emerald-400 uppercase"
						>
							Online
						</span>
					</div>

					<div
						class="border-slate-850 flex items-center justify-between rounded-2xl border bg-slate-950/40 p-4"
					>
						<div>
							<h4 class="text-sm font-bold text-white">R2 Asset Storage</h4>
							<span class="font-mono text-[10px] text-slate-500">GAMES_BUCKET</span>
						</div>
						<span
							class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-extrabold tracking-widest text-emerald-400 uppercase"
						>
							Online
						</span>
					</div>

					<div
						class="border-slate-850 flex items-center justify-between rounded-2xl border bg-slate-950/40 p-4"
					>
						<div>
							<h4 class="text-sm font-bold text-white">Better Auth Service</h4>
							<span class="font-mono text-[10px] text-slate-500">v1.6.9 minimal</span>
						</div>
						<span
							class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-extrabold tracking-widest text-emerald-400 uppercase"
						>
							Active
						</span>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
