<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	const token = $derived(page.url.searchParams.get('token') || '');

	let newPasswordVal = $state('');
	let confirmPasswordVal = $state('');
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let successMsg = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		errorMsg = null;
		successMsg = null;

		if (!token) {
			errorMsg = 'Reset token is missing from the link. Please request a new password reset link.';
			loading = false;
			return;
		}

		if (newPasswordVal !== confirmPasswordVal) {
			errorMsg = 'Passwords do not match';
			loading = false;
			return;
		}

		try {
			const { data, error } = await authClient.resetPassword({
				newPassword: newPasswordVal,
				token
			});

			if (error) {
				errorMsg = error.message || 'Failed to reset password. The link may have expired.';
			} else {
				successMsg = 'Password reset successfully! Redirecting to sign in...';
				setTimeout(() => {
					goto('/auth');
				}, 1500);
			}
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to reset password. The link may have expired.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password | IsItFun</title>
	<meta name="description" content="Set a new password for your IsItFun account." />
</svelte:head>

<div class="flex min-h-[85vh] items-center justify-center p-4">
	<div
		class="card w-full max-w-md overflow-hidden border border-base-200 bg-base-100/90 shadow-2xl backdrop-blur-md"
	>
		<div class="h-2 bg-linear-to-r from-primary via-secondary to-accent"></div>

		<div class="card-body gap-6 px-6 py-8 sm:px-8">
			<div class="space-y-2 text-center">
				<h1 class="text-3xl font-extrabold tracking-tight text-primary">Set New Password</h1>
				<p class="text-xs text-base-content/70">Enter your new account password below.</p>
			</div>

			{#if !token}
				<div class="alert py-3 text-xs alert-warning shadow-md">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span>Missing token. Please use the password reset link sent to your email.</span>
				</div>
			{/if}

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
					<label class="label py-1" for="new-password">
						<span class="label-text text-xs font-semibold">New Password</span>
					</label>
					<input
						id="new-password"
						type="password"
						placeholder="At least 8 characters"
						class="input-bordered input input-md w-full"
						bind:value={newPasswordVal}
						minLength={8}
						required
						disabled={!token}
					/>
				</div>

				<div class="form-control">
					<label class="label py-1" for="confirm-password">
						<span class="label-text text-xs font-semibold">Confirm New Password</span>
					</label>
					<input
						id="confirm-password"
						type="password"
						placeholder="Confirm new password"
						class="input-bordered input input-md w-full"
						bind:value={confirmPasswordVal}
						minLength={8}
						required
						disabled={!token}
					/>
				</div>

				<button
					type="submit"
					class="btn btn-block shadow-md transition-transform btn-primary hover:scale-[1.01] active:scale-95"
					disabled={loading || !token}
				>
					{#if loading}
						<span class="loading loading-sm loading-spinner"></span>
						Updating Password...
					{:else}
						Update Password
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
