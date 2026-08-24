<script lang="ts">
	import { resolve } from '$app/paths';
	import Footer from '#lib/components/Footer.svelte';
	import { Users, Package, Activity, BarChart3, Database, HardDrive, ShieldCheck, ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	const cards = $derived([
		{
			name: 'Total System Users',
			value: data.stats.totalUsers,
			icon: Users,
			color: 'text-blue-600'
		},
		{
			name: 'Active Projects',
			value: data.stats.totalProjects,
			icon: Package,
			color: 'text-purple-600'
		},
		{
			name: 'Telemetry Sessions',
			value: data.stats.totalSessions,
			icon: Activity,
			color: 'text-pink-600'
		},
		{
			name: 'Log Records',
			value: data.stats.totalLogs,
			icon: BarChart3,
			color: 'text-emerald-600'
		}
	]);
</script>

<svelte:head>
	<title>Admin System Console | IsItFun</title>
</svelte:head>

<main class="mx-auto mt-10 w-full max-w-6xl flex-1 px-6 pb-24 lg:px-8">
		<!-- Page Header -->
		<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-slate-900">System Admin Console</h1>
				<p class="mt-1 text-xs text-slate-500">
					Global platform analytics, user role distribution, and system service diagnostics.
				</p>
			</div>
		</div>

		<!-- Stats Grid -->
		<section class="mb-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
			{#each cards as c (c.name)}
				<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-500 uppercase tracking-wider">{c.name}</span>
						<c.icon class="h-4 w-4 {c.color}" />
					</div>
					<div class="mt-3 text-2xl font-bold tracking-tight text-slate-900">
						{c.value}
					</div>
				</div>
			{/each}
		</section>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<!-- User Role Breakdown Table -->
			<section class="lg:col-span-2">
				<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
					<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">
						User Accounts & Roles
					</h2>

					<div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
						<table class="w-full text-left text-xs">
							<thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
								<tr>
									<th class="p-3">Role Profile</th>
									<th class="p-3">Description</th>
									<th class="p-3 text-right">Users</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 text-slate-700">
								{#each data.roleDistribution as item (item.role)}
									<tr class="hover:bg-slate-50/60 transition-colors">
										<td class="p-3 font-semibold text-slate-900 capitalize">
											<span class="inline-flex items-center gap-1.5">
												<span
													class="h-2 w-2 rounded-full {item.role === 'admin'
														? 'bg-purple-600'
														: item.role === 'game_developer'
															? 'bg-blue-600'
															: 'bg-emerald-600'}"
												></span>
												{item.role.replace('_', ' ')}
											</span>
										</td>
										<td class="p-3 text-xs text-slate-500">
											{#if item.role === 'admin'}
												Platform administration and observer metrics.
											{:else if item.role === 'game_developer'}
												Uploads game builds and inspects playtest telemetry.
											{:else}
												Playtester account.
											{/if}
										</td>
										<td class="p-3 text-right font-mono text-xs font-bold text-slate-900">
											{item.count}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="3" class="p-6 text-center text-xs text-slate-400 italic">
											No user records found.
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<!-- Diagnostics Sidebar -->
			<section>
				<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
					<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">
						Service State
					</h2>

					<div class="mt-4 space-y-3">
						<div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
							<div class="flex items-center gap-3">
								<Database class="h-4 w-4 text-purple-600" />
								<div>
									<h4 class="text-xs font-bold text-slate-900">D1 SQLite Database</h4>
									<span class="font-mono text-[10px] text-slate-400">isitfun-db</span>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Online
							</span>
						</div>

						<div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
							<div class="flex items-center gap-3">
								<HardDrive class="h-4 w-4 text-indigo-600" />
								<div>
									<h4 class="text-xs font-bold text-slate-900">R2 Asset Bucket</h4>
									<span class="font-mono text-[10px] text-slate-400">GAMES_BUCKET</span>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Online
							</span>
						</div>

						<div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
							<div class="flex items-center gap-3">
								<ShieldCheck class="h-4 w-4 text-emerald-600" />
								<div>
									<h4 class="text-xs font-bold text-slate-900">Better Auth Engine</h4>
									<span class="font-mono text-[10px] text-slate-400">v1.6.9 edge</span>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Active
							</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	</main>

	<Footer />
