<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';

	let emailVal = $state('');
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		errorMsg = null;
		successMsg = null;

		try {
			const { data, error } = await (authClient as any).forgetPassword({
				email: emailVal,
				redirectTo: `${window.location.origin}/auth/reset-password`
			});

			if (error) {
				errorMsg = error.message || 'Failed to request password reset. Please try again.';
			} else {
				successMsg =
					'If an account exists with this email, a password reset link has been sent to your inbox.';
				emailVal = '';
			}
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to request password reset. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password | IsItFun</title>
	<meta name="description" content="Request a password reset link for your IsItFun account." />
</svelte:head>

<div class="flex min-h-[85vh] items-center justify-center p-4">
	<div
		class="card w-full max-w-md overflow-hidden border border-base-200 bg-base-100/90 shadow-2xl backdrop-blur-md"
	>
		<div class="h-2 bg-linear-to-r from-primary via-secondary to-accent"></div>

		<div class="card-body gap-6 px-6 py-8 sm:px-8">
			<div class="space-y-2 text-center">
				<h1 class="text-3xl font-extrabold tracking-tight text-primary">Forgot Password</h1>
				<p class="text-xs text-base-content/70">
					Enter your email address below and we'll send you a link to reset your password.
				</p>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				{#if errorMsg}
					<div class="alert py-2.5 text-xs alert-error shadow-md">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0 stroke-current"
							fill="none"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{errorMsg}</span>
					</div>
				{/if}

				{#if successMsg}
					<div class="alert py-2.5 text-xs alert-success shadow-md">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0 stroke-current"
							fill="none"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{successMsg}</span>
					</div>
				{/if}

				<div class="form-control">
					<label class="label py-1" for="forgot-email">
						<span class="label-text text-xs font-semibold">Email Address</span>
					</label>
					<input
						id="forgot-email"
						type="email"
						placeholder="developer@example.com"
						class="input-bordered input input-md w-full"
						bind:value={emailVal}
						required
					/>
				</div>

				<button
					type="submit"
					class="btn btn-block shadow-md transition-transform btn-primary hover:scale-[1.01] active:scale-95"
					disabled={loading}
				>
					{#if loading}
						<span class="loading loading-sm loading-spinner"></span>
						Sending Reset Link...
					{:else}
						Send Reset Link
					{/if}
				</button>
			</form>

			<div class="pt-2 text-center">
				<a
					href={resolve('/auth')}
					class="inline-flex link items-center gap-1 text-xs font-semibold link-primary hover:underline"
				>
					&larr; Back to Sign In
				</a>
			</div>
		</div>
	</div>
</div>
