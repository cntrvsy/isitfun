<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { resolve } from '$app/paths';
	import { authClient } from '#lib/auth-client.js';
	import { goto } from '$app/navigation';

	let { form }: { form: ActionData } = $props();

	let activeTab = $state<'signin' | 'signup'>('signin');

	// Form states
	let signInEmailVal = $state('');
	let signInPasswordVal = $state('');
	let signInLoading = $state(false);
	let signInError = $state<string | null>(null);

	let signUpNameVal = $state('');
	let signUpEmailVal = $state('');
	let signUpPasswordVal = $state('');
	let signUpConfirmPasswordVal = $state('');
	let signUpLoading = $state(false);
	let signUpError = $state<string | null>(null);
	let signUpSuccess = $state<string | null>(null);

	async function handleSignIn(e: SubmitEvent) {
		e.preventDefault();
		signInLoading = true;
		signInError = null;

		try {
			const { error } = await authClient.signIn.email({
				email: signInEmailVal,
				password: signInPasswordVal,
				callbackURL: '/portal/dashboard'
			});

			if (error) {
				signInError = error.message || 'Invalid email or password';
			} else {
				goto(resolve('/(app)/portal/dashboard'));
			}
		} catch (err: unknown) {
			signInError = (err as Error)?.message || 'Invalid email or password';
		} finally {
			signInLoading = false;
		}
	}

	async function handleSignUp(e: SubmitEvent) {
		e.preventDefault();
		signUpLoading = true;
		signUpError = null;
		signUpSuccess = null;

		if (signUpPasswordVal !== signUpConfirmPasswordVal) {
			signUpError = 'Passwords do not match';
			signUpLoading = false;
			return;
		}

		try {
			const { error } = await authClient.signUp.email({
				name: signUpNameVal,
				email: signUpEmailVal,
				password: signUpPasswordVal,
				callbackURL: '/portal/dashboard'
			});

			if (error) {
				signUpError = error.message || 'Registration failed. Email may already be in use.';
			} else {
				signUpSuccess = 'Account created successfully! Redirecting...';
				setTimeout(() => {
					goto(resolve('/(app)/portal/dashboard'));
				}, 1200);
			}
		} catch (err: unknown) {
			signUpError = (err as Error)?.message || 'Registration failed. Email may already be in use.';
		} finally {
			signUpLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In & Register | IsItFun</title>
	<meta
		name="description"
		content="Sign in or create an account on IsItFun playtesting platform."
	/>
</svelte:head>

<div class="flex min-h-[85vh] items-center justify-center p-4">
	<div
		class="card w-full max-w-md overflow-hidden border border-base-200 bg-base-100/90 shadow-2xl backdrop-blur-md"
	>
		<!-- Card Top Visual Accent -->
		<div class="h-2.5 bg-linear-to-r from-primary via-secondary to-accent"></div>

		<div class="card-body gap-6 px-6 py-8 sm:px-8">
			<div class="space-y-2 text-center">
				<h1 class="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">IsItFun</h1>
				<p class="text-sm text-base-content/70 italic">
					Playtest games. Deliver feedback. Build better games.
				</p>
			</div>

			<!-- Navigation Tabs (DaisyUI Tabs) -->
			<div role="tablist" class="tabs-box tabs grid grid-cols-2 rounded-xl bg-base-200/70 p-1">
				<button
					role="tab"
					class="tab rounded-lg text-sm font-semibold transition-all {activeTab === 'signin'
						? 'tab-active bg-base-100 text-primary shadow-sm'
						: 'text-base-content/60 hover:text-base-content'}"
					onclick={() => (activeTab = 'signin')}
				>
					Sign In
				</button>
				<button
					role="tab"
					class="tab rounded-lg text-sm font-semibold transition-all {activeTab === 'signup'
						? 'tab-active bg-base-100 text-primary shadow-sm'
						: 'text-base-content/60 hover:text-base-content'}"
					onclick={() => (activeTab = 'signup')}
				>
					Create Account
				</button>
			</div>

			{#if activeTab === 'signin'}
				<!-- SIGN IN FORM -->
				<form onsubmit={handleSignIn} class="space-y-4">
					{#if signInError}
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
							<span>{signInError}</span>
						</div>
					{/if}

					<div class="form-control">
						<label class="label py-1" for="signin-email">
							<span class="label-text text-xs font-semibold">Email Address</span>
						</label>
						<input
							id="signin-email"
							type="email"
							placeholder="developer@example.com"
							class="input-bordered input input-sm w-full sm:input-md"
							bind:value={signInEmailVal}
							required
						/>
					</div>

					<div class="form-control">
						<div class="flex items-center justify-between py-1">
							<label class="label py-0" for="signin-password">
								<span class="label-text text-xs font-semibold">Password</span>
							</label>
							<a
								href={resolve('/(app)/auth/forgot-password')}
								class="link text-xs link-primary hover:underline"
							>
								Forgot Password?
							</a>
						</div>
						<input
							id="signin-password"
							type="password"
							placeholder="••••••••"
							class="input-bordered input input-sm w-full sm:input-md"
							bind:value={signInPasswordVal}
							required
						/>
					</div>

					<button
						type="submit"
						class="btn mt-2 btn-block shadow-md transition-transform btn-primary hover:scale-[1.01] active:scale-95"
						disabled={signInLoading}
					>
						{#if signInLoading}
							<span class="loading loading-sm loading-spinner"></span>
							Signing in...
						{:else}
							Sign In with Email
						{/if}
					</button>
				</form>
			{:else}
				<!-- CREATE ACCOUNT FORM -->
				<form onsubmit={handleSignUp} class="space-y-3">
					{#if signUpError}
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
							<span>{signUpError}</span>
						</div>
					{/if}

					{#if signUpSuccess}
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
							<span>{signUpSuccess}</span>
						</div>
					{/if}

					<div class="form-control">
						<label class="label py-1" for="signup-name">
							<span class="label-text text-xs font-semibold">Full Name</span>
						</label>
						<input
							id="signup-name"
							type="text"
							placeholder="Jane Doe"
							class="input-bordered input input-sm w-full"
							bind:value={signUpNameVal}
							required
						/>
					</div>

					<div class="form-control">
						<label class="label py-1" for="signup-email">
							<span class="label-text text-xs font-semibold">Email Address</span>
						</label>
						<input
							id="signup-email"
							type="email"
							placeholder="developer@example.com"
							class="input-bordered input input-sm w-full"
							bind:value={signUpEmailVal}
							required
						/>
					</div>

					<div class="form-control">
						<label class="label py-1" for="signup-password">
							<span class="label-text text-xs font-semibold">Password</span>
						</label>
						<input
							id="signup-password"
							type="password"
							placeholder="At least 8 characters"
							class="input-bordered input input-sm w-full"
							bind:value={signUpPasswordVal}
							minLength={8}
							required
						/>
					</div>

					<div class="form-control">
						<label class="label py-1" for="signup-confirm-password">
							<span class="label-text text-xs font-semibold">Confirm Password</span>
						</label>
						<input
							id="signup-confirm-password"
							type="password"
							placeholder="Confirm password"
							class="input-bordered input input-sm w-full"
							bind:value={signUpConfirmPasswordVal}
							minLength={8}
							required
						/>
					</div>

					<button
						type="submit"
						class="btn mt-2 btn-block shadow-md transition-transform btn-primary hover:scale-[1.01] active:scale-95"
						disabled={signUpLoading}
					>
						{#if signUpLoading}
							<span class="loading loading-sm loading-spinner"></span>
							Creating Account...
						{:else}
							Create Account
						{/if}
					</button>
				</form>
			{/if}

			<div class="divider my-2 text-xs font-semibold text-base-content/40 uppercase">
				Or Continue With
			</div>

			<!-- SOCIAL PROVIDERS -->
			<div class="grid grid-cols-2 gap-3">
				<!-- GitHub -->
				<form method="post" action="?/signInSocial" use:enhance>
					<input type="hidden" name="provider" value="github" />
					<input type="hidden" name="callbackURL" value={resolve('/(app)/auth')} />
					<button
						class="btn flex w-full items-center justify-center gap-2 shadow-sm transition-transform btn-sm btn-neutral hover:scale-[1.02] sm:btn-md"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path
								d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12"
							/>
						</svg>
						GitHub
					</button>
				</form>

				<!-- Google -->
				<form method="post" action="?/signInSocial" use:enhance>
					<input type="hidden" name="provider" value="google" />
					<input type="hidden" name="callbackURL" value={resolve('/(app)/auth')} />
					<button
						class="btn flex w-full items-center justify-center gap-2 border-base-300 shadow-xs transition-transform btn-outline btn-sm hover:scale-[1.02] sm:btn-md"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
							<path
								fill="#FFC107"
								d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
							/>
							<path
								fill="#FF3D00"
								d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
							/>
							<path
								fill="#4CAF50"
								d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
							/>
							<path
								fill="#1976D2"
								d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
							/>
						</svg>
						Google
					</button>
				</form>
			</div>

			{#if form?.message}
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
					<span>{form.message}</span>
				</div>
			{/if}

			<div class="mt-2 px-4 text-center text-xs text-base-content/60">
				By proceeding, you agree to our
				<a
					href={resolve('/(website)/terms')}
					class="link link-primary link-hover underline-offset-4">Terms of Service</a
				>
				and
				<a
					href={resolve('/(website)/privacy')}
					class="link link-primary link-hover underline-offset-4">Privacy Policy</a
				>.
			</div>
		</div>

		<!-- Card Footer -->
		<div class="border-t border-base-200 bg-base-200/50 py-3 text-center">
			<p class="text-xs text-base-content/50">Protected by Better Auth & Resend Email Delivery</p>
		</div>
	</div>
</div>
