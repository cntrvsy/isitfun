<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Lock, AlertCircle, ArrowLeft } from '@lucide/svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Private Playtest Access | Is It Fun?</title>
	<meta
		name="description"
		content="Enter the security code to access this private game playtest session."
	/>
</svelte:head>

<main
	class="relative flex min-h-screen items-center justify-center bg-slate-950 p-6 font-sans text-slate-100 selection:bg-purple-900 selection:text-purple-100"
>
	<div class="relative z-10 w-full max-w-md">
		{#if data.notFound}
			<div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-xl">
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
					<AlertCircle class="h-6 w-6" />
				</div>
				<h1 class="text-xl font-bold tracking-tight text-white">Playtest Unavailable</h1>
				<p class="mt-2 text-xs text-slate-400">
					This playtest link is missing or no longer active. Please request an updated access key from the game developer.
				</p>
				<a
					href={resolve('/(website)')}
					class="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
				>
					<ArrowLeft class="h-4 w-4" /> Return to Homepage
				</a>
			</div>
		{:else}
			<div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
				<!-- Header -->
				<div class="mb-6 text-center">
					<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
						<Lock class="h-6 w-6" />
					</div>
					<h1 class="text-xl font-bold tracking-tight text-white">Private Playtest</h1>
					<p class="mt-1 text-xs text-slate-400">
						This build of <span class="font-semibold text-purple-300">{data.projectName}</span> requires access authorization.
					</p>
				</div>

				<form
					method="POST"
					action="?/verify"
					use:enhance={() => {
						isSubmitting = true;
						return ({ update }) => {
							isSubmitting = false;
							update();
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="projectId" value={data.projectId} />

					<div>
						<label class="mb-1.5 block text-xs font-semibold text-slate-300" for="playtest-password">
							Access Password / Code
						</label>
						<input
							id="playtest-password"
							type="password"
							name="password"
							placeholder="Enter password..."
							class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-center font-mono text-sm tracking-wider text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none"
							required
						/>

						{#if data.urlError || form?.error}
							<p
								id="error-message"
								class="mt-2 rounded-lg border border-rose-800/40 bg-rose-950/40 p-2.5 text-center text-xs font-medium text-rose-300"
							>
								{data.urlError || form?.error}
							</p>
						{:else if form?.incorrect}
							<p
								id="error-message"
								class="mt-2 rounded-lg border border-rose-800/40 bg-rose-950/40 p-2.5 text-center text-xs font-medium text-rose-300"
							>
								Incorrect password or access key. Please verify with the developer.
							</p>
						{/if}
					</div>

					<button
						type="submit"
						class="w-full rounded-lg bg-purple-600 py-2.5 text-xs font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Verifying...' : 'Unlock & Launch Game'}
					</button>
				</form>
			</div>

			<div class="mt-6 text-center">
				<a
					href={resolve('/(website)')}
					class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
				>
					<ArrowLeft class="h-3.5 w-3.5" /> Back to IsItFun
				</a>
			</div>
		{/if}
	</div>
</main>
