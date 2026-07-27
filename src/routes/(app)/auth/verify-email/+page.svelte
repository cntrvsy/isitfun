<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let emailVal = $state('');
	let loading = $state(false);
	let resendError = $state<string | null>(null);
	let resendSuccess = $state<string | null>(null);

	async function handleResend(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		resendError = null;
		resendSuccess = null;

		try {
			const { data, error } = await authClient.sendVerificationEmail({
				email: emailVal,
				callbackURL: `${window.location.origin}/auth`
			});

			if (error) {
				resendError = error.message || 'Failed to send verification email.';
			} else {
				resendSuccess = 'Verification email sent! Check your inbox.';
				emailVal = '';
			}
		} catch (err: any) {
			resendError = err?.message || 'Failed to send verification email.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Verify Email | IsItFun</title>
	<meta name="description" content="Verify your email address for your IsItFun account." />
</svelte:head>

<div class="flex min-h-[85vh] items-center justify-center p-4">
	<div
		class="card w-full max-w-md overflow-hidden border border-base-200 bg-base-100/90 shadow-2xl backdrop-blur-md"
	>
		<div class="h-2 bg-linear-to-r from-primary via-secondary to-accent"></div>

		<div class="card-body gap-6 px-6 py-8 sm:px-8">
			<div class="space-y-2 text-center">
				<h1 class="text-3xl font-extrabold tracking-tight text-primary">Email Verification</h1>
				<p class="text-xs text-base-content/70">
					Verify your email address to ensure account security.
				</p>
			</div>

			{#if data.verified}
				<div class="space-y-4 py-4 text-center">
					<div class="alert py-3 text-xs alert-success shadow-md">
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
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Your email address has been successfully verified!</span>
					</div>

					<a href={resolve('/portal/dashboard')} class="btn btn-block shadow-md btn-primary">
						Go to Dashboard
					</a>
				</div>
			{:else}
				{#if data.error}
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
						<span>{data.error}</span>
					</div>
				{/if}

				<div class="space-y-4">
					<div class="text-center text-xs text-base-content/70">
						Need a new verification link? Enter your email address below to resend:
					</div>

					<form onsubmit={handleResend} class="space-y-3">
						{#if resendError}
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
								<span>{resendError}</span>
							</div>
						{/if}

						{#if resendSuccess}
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
								<span>{resendSuccess}</span>
							</div>
						{/if}

						<div class="form-control">
							<label class="label py-1" for="resend-email">
								<span class="label-text text-xs font-semibold">Email Address</span>
							</label>
							<input
								id="resend-email"
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
								Resending Link...
							{:else}
								Resend Verification Email
							{/if}
						</button>
					</form>
				</div>
			{/if}

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
