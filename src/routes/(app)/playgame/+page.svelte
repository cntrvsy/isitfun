<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Private Playtest Access | Is It Fun?</title>
	<meta name="description" content="Enter the security code to access this private game playtest session." />
</svelte:head>

<main class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
	<!-- Decorative space glows -->
	<div class="absolute top-[20%] left-[20%] w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>
	<div class="absolute bottom-[20%] right-[20%] w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

	<div class="w-full max-w-md relative z-10">
		<!-- Logomark -->
		<div class="flex flex-col items-center mb-8">
			<div class="w-16 h-16 rounded-2xl bg-linear-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow-xl shadow-purple-500/25 mb-4 animate-bounce">
				🔐
			</div>
			<h1 class="text-3xl font-black tracking-tight text-white mb-1">
				Private Playtest
			</h1>
			<p class="text-slate-400 text-sm text-center">
				This session for <span class="text-purple-400 font-bold">{data.projectName}</span> is password-protected.
			</p>
		</div>

		<!-- Password Card -->
		<div class="backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
			<!-- Top glow -->
			<div class="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-purple-500 to-indigo-500"></div>

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
						<span class="label-text text-slate-300 font-bold uppercase tracking-wider text-xs block">Access Password</span>
					</label>
					<div class="relative">
						<input 
							id="playtest-password"
							type="password" 
							name="password" 
							placeholder="Enter password..." 
							class="input bg-slate-950 border border-slate-850 focus:border-purple-500 rounded-xl w-full text-white placeholder-slate-700 focus:outline-none transition-all py-6 pl-4 pr-10 text-center text-lg tracking-widest" 
							required 
						/>
						<div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
							🗝️
						</div>
					</div>

					{#if form?.incorrect}
						<p id="error-message" class="text-rose-500 text-xs font-bold mt-2 text-center animate-pulse">
							⚠️ Incorrect password! Please check with the developer.
						</p>
					{/if}
				</div>

				<button 
					type="submit" 
					class="btn w-full bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none text-white font-bold py-4 rounded-xl shadow-xl shadow-purple-500/20 transition-all duration-300 hover:-translate-y-0.5"
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Unlocking...
					{:else}
						Unlock & Play Game
					{/if}
				</button>
			</form>
		</div>

		<!-- Footer Link -->
		<div class="text-center mt-8">
			<a href={resolve('/')} class="text-slate-500 hover:text-slate-300 text-xs transition-colors">
				← Back to IsItFun Homepage
			</a>
		</div>
	</div>
</main>