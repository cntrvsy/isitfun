<script lang="ts">
	import { createProject } from '../../../routes/(app)/portal/dashboard/dashboard.remote';
	import { X } from '@lucide/svelte';

	let { show = $bindable(false), organizationId = '' } = $props();
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
				<h3 class="text-lg font-bold tracking-tight text-slate-900">
					Create New Playtest
				</h3>
				<button
					onclick={() => (show = false)}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</header>

			<form
				{...createProject.enhance(async ({ submit, element }: any) => {
					try {
						if (await submit()) {
							show = false;
							element.reset();
						}
					} catch (e) {
						console.error(e);
					}
				})}
				class="space-y-5 p-6"
			>
				{#if organizationId}
					<input type="hidden" name="organizationId" value={organizationId} />
				{/if}
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="project-name">
						Project Name
					</label>
					<input
						id="project-name"
						placeholder="e.g. My Amazing Platformer"
						class="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-purple-600 focus:outline-none"
						required
						{...createProject.fields.name.as('text')}
					/>
				</div>

				<div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
					<label
						class="flex cursor-pointer items-center justify-between"
						for="password-toggle"
					>
						<div>
							<span class="block text-xs font-bold text-slate-900">Password Protection</span>
							<span class="mt-0.5 block text-[11px] text-slate-500">
								Require testers to enter a password to access the build
							</span>
						</div>
						<input
							id="password-toggle"
							class="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
							{...createProject.fields.passwordProtected.as('checkbox')}
						/>
					</label>

					{#if createProject.fields.passwordProtected.value()}
						<div class="mt-3 border-t border-slate-200 pt-3">
							<label class="mb-1 block text-xs font-semibold text-slate-700" for="playtest-password">
								Access Password
							</label>
							<input
								id="playtest-password"
								placeholder="••••••••"
								class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
								required={createProject.fields.passwordProtected.value()}
								{...createProject.fields.password.as('password')}
							/>
						</div>
					{/if}
				</div>

				<footer class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (show = false)}
						class="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
					>
						Create Project
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
