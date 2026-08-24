<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { LayoutDashboard, User, Shield, LogOut } from '@lucide/svelte';

	let { data, children } = $props();

	const currentPath = $derived(page.url.pathname);
</script>

<div class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-purple-100 selection:text-purple-900">
	<!-- Unified Portal Navigation Bar -->
	<header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-12">
			<!-- Left: Logo & Nav Links -->
			<div class="flex items-center gap-8">
				<a href={resolve('/(app)/portal/dashboard')} class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
						🎮
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm font-bold tracking-tight text-slate-900">IsItFun</span>
						<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Console</span>
					</div>
				</a>

				<nav class="hidden items-center gap-1 sm:flex">
					<a
						href={resolve('/(app)/portal/dashboard')}
						class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {currentPath.startsWith('/portal/dashboard')
							? 'bg-slate-100 text-slate-900 font-bold'
							: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
					>
						<LayoutDashboard class="h-3.5 w-3.5" /> Dashboard
					</a>
					<a
						href={resolve('/(app)/portal/profile')}
						class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {currentPath.startsWith('/portal/profile')
							? 'bg-slate-100 text-slate-900 font-bold'
							: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
					>
						<User class="h-3.5 w-3.5" /> Profile
					</a>
					{#if data.user?.role === 'admin'}
						<a
							href={resolve('/(app)/portal/admin')}
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {currentPath.startsWith('/portal/admin')
								? 'bg-purple-100 text-purple-900 font-bold'
								: 'text-purple-700 hover:bg-purple-50'}"
						>
							<Shield class="h-3.5 w-3.5" /> Admin
						</a>
					{/if}
				</nav>
			</div>

			<!-- Right: User Email & Sign Out -->
			<div class="flex items-center gap-3">
				{#if data.user?.email}
					<span class="hidden rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 md:inline-block">
						{data.user.email}
					</span>
				{/if}
				<form method="POST" action="/auth?/signOut">
					<button
						type="submit"
						class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
					>
						<LogOut class="h-3.5 w-3.5" /> Sign Out
					</button>
				</form>
			</div>
		</div>
	</header>

	<!-- Main Content Slot -->
	<div class="flex flex-1 flex-col">
		{@render children()}
	</div>
</div>
