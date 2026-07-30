<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

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
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 font-sans text-slate-100"
>
	<!-- Decorative space glows -->
	<div
		class="pointer-events-none absolute top-[20%] left-[20%] h-[350px] w-[350px] rounded-full bg-purple-600/10 blur-[100px]"
	></div>
	<div
		class="pointer-events-none absolute right-[20%] bottom-[20%] h-[350px] w-[350px] rounded-full bg-indigo-600/10 blur-[100px]"
	></div>

	<div class="relative z-10 w-full max-w-md">
		{#if data.notFound}
			<div class="mb-8 flex flex-col items-center text-center">
				<div
					class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-3xl text-rose-400 shadow-xl"
				>
					🚫
				</div>
				<h1 class="mb-2 text-3xl font-black tracking-tight text-white">Playtest Unavailable</h1>
				<p class="text-sm text-slate-400">
					This playtest link is missing or no longer active. Please request an updated playtest
					access key from the game developer.
				</p>
			</div>

			<div class="mt-8 text-center">
				<a
					href={resolve('/')}
					class="btn w-full rounded-xl border border-slate-800 bg-slate-900 py-3 font-bold text-slate-300 hover:text-white"
				>
					← Return to IsItFun Homepage
				</a>
			</div>
		{:else}
			<!-- Logomark -->
			<div class="mb-8 flex flex-col items-center">
				<div
					class="mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 text-3xl shadow-xl shadow-purple-500/25"
				>
					🔐
				</div>
				<h1 class="mb-1 text-3xl font-black tracking-tight text-white">Private Playtest</h1>
				<p class="text-center text-sm text-slate-400">
					This session for <span class="font-bold text-purple-400">{data.projectName}</span> is password-protected.
				</p>
			</div>

			<!-- Password Card -->
			<div
				class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl"
			>
				<!-- Top glow -->
				<div
					class="absolute top-0 right-0 left-0 h-[2px] bg-linear-to-r from-purple-500 to-indigo-500"
				></div>

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
					class="space-y-6"
				>
					<input type="hidden" name="projectId" value={data.projectId} />

					<div class="form-control">
						<label class="label mb-2" for="playtest-password">
							<span
								class="label-text block text-xs font-bold tracking-wider text-slate-300 uppercase"
								>Access Password</span
							>
						</label>
						<div class="relative">
							<input
								id="playtest-password"
								type="password"
								name="password"
								placeholder="Enter password..."
								class="border-slate-850 input w-full rounded-xl border bg-slate-950 py-6 pr-10 pl-4 text-center text-lg tracking-widest text-white placeholder-slate-700 transition-all focus:border-purple-500 focus:outline-none"
								required
							/>
							<div class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-600">🗝️</div>
						</div>

						{#if data.urlError || form?.error}
							<p
								id="error-message"
								class="mt-2 rounded-lg border border-rose-800/50 bg-rose-950/40 p-3 text-center text-xs font-bold text-rose-400"
							>
								⚠️ {data.urlError || form?.error}
							</p>
						{:else if form?.incorrect}
							<p
								id="error-message"
								class="mt-2 animate-pulse text-center text-xs font-bold text-rose-500"
							>
								⚠️ Incorrect password or access key! Please check with the developer.
							</p>
						{/if}
					</div>

					<button
						type="submit"
						class="btn w-full rounded-xl border-none bg-linear-to-r from-purple-600 to-indigo-600 py-4 font-bold text-white shadow-xl shadow-purple-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-purple-500 hover:to-indigo-500"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading mr-2 loading-sm loading-spinner"></span>
							Unlocking...
						{:else}
							Unlock & Play Game
						{/if}
					</button>
				</form>
			</div>

			<!-- Footer Link -->
			<div class="mt-8 text-center">
				<a
					href={resolve('/')}
					class="text-xs text-slate-500 transition-colors hover:text-slate-300"
				>
					← Back to IsItFun Homepage
				</a>
			</div>
		{/if}
	</div>
</main>
