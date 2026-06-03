<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { resolve } from '$app/paths';

	let { form }: { form: ActionData } = $props();

	// const resolved = resolve(`/`);
</script>

<svelte:head>
	<title>Login | IsItFun</title>
	<meta name="description" content="Sign in to IsItFun to start testing games with friends." />
</svelte:head>

<div class="flex min-h-[85vh] items-center justify-center p-4">
	<div class="card w-full max-w-md overflow-hidden border border-base-200 bg-base-100 shadow-xl">
		<!-- Card Top Strip (Visual Flair) -->
		<div class="h-2 bg-linear-to-r from-primary via-secondary to-accent"></div>

		<div class="card-body gap-8 py-10">
			<div class="space-y-2 text-center">
				<h1 class="text-4xl font-extrabold tracking-tight text-primary">Welcome Back</h1>
				<p class="text-base-content/70 italic">Sign in to start playtesting games</p>
			</div>

			<div class="space-y-4">
				<!-- GitHub Login -->
				<form method="post" action="?/signInSocial" use:enhance>
					<input type="hidden" name="provider" value="github" />
					<input type="hidden" name="callbackURL" value={resolve('/auth')} />
					<button
						class="btn flex btn-block items-center justify-center gap-3 shadow-md transition-transform btn-neutral hover:scale-[1.02] active:scale-95"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path
								d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12"
							/>
						</svg>
						Sign in with GitHub
					</button>
				</form>

				<!-- Google Login -->
				<form method="post" action="?/signInSocial" use:enhance>
					<input type="hidden" name="provider" value="google" />
					<input type="hidden" name="callbackURL" value={resolve('/auth')} />
					<button
						class="btn flex btn-block items-center justify-center gap-3 border-base-300 shadow-sm transition-transform btn-outline hover:scale-[1.02] active:scale-95"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 48 48">
							<path
								fill="#FFC107"
								d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
							/><path
								fill="#FF3D00"
								d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
							/><path
								fill="#4CAF50"
								d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
							/><path
								fill="#1976D2"
								d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
							/>
						</svg>
						Sign in with Google
					</button>
				</form>
			</div>

			{#if form?.message}
				<div class="alert py-3 text-sm alert-error shadow-lg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					<span>{form.message}</span>
				</div>
			{/if}

			<div class="divider mt-6 text-xs font-semibold text-base-content/40 uppercase">
				Secure Access
			</div>

			<div class="px-4 text-center text-xs text-base-content/60">
				By signing in, you agree to our
				<a href={resolve('/terms')} class="link link-primary link-hover underline-offset-4"
					>Terms of Service</a
				>
				and
				<a href={resolve('/privacy')} class="link link-primary link-hover underline-offset-4"
					>Privacy Policy</a
				>.
			</div>
		</div>

		<!-- Footer Visual Detail -->
		<div class="bg-base-200/50 py-4 text-center">
			<p class="text-xs text-base-content/40">Secure authentication powered by Better Auth</p>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-image:
			radial-gradient(at 0% 0%, oklch(var(--p) / 0.1) 0px, transparent 50%),
			radial-gradient(at 100% 100%, oklch(var(--s) / 0.1) 0px, transparent 50%);
		background-attachment: fixed;
	}
</style>
