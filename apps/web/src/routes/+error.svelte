<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AlertTriangle, ArrowLeft, Home } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{page.status} | IsItFun</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 font-sans text-slate-900 selection:bg-purple-100 selection:text-purple-900">
	<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
		<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
			<AlertTriangle class="h-6 w-6" />
		</div>

		<span class="font-mono text-3xl font-extrabold text-slate-900">
			{page.status}
		</span>

		<h1 class="mt-2 text-lg font-bold tracking-tight text-slate-900">
			{#if page.status === 404}
				Page Not Found
			{:else if page.status === 403}
				Access Denied
			{:else}
				Unexpected Error
			{/if}
		</h1>

		<p class="mt-2 text-xs text-slate-500">
			{page.error?.message || 'The page you requested does not exist or has been moved.'}
		</p>

		<div class="mt-6 flex flex-col gap-2 sm:flex-row">
			<a
				href={resolve('/(app)/portal/dashboard')}
				class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-800"
			>
				<Home class="h-3.5 w-3.5" /> Dashboard
			</a>
			<a
				href={resolve('/(website)')}
				class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
			>
				<ArrowLeft class="h-3.5 w-3.5" /> Homepage
			</a>
		</div>
	</div>
</div>
