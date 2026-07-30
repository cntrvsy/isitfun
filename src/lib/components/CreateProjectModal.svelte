<script lang="ts">
	import { createProject } from '../../routes/(app)/portal/dashboard/dashboard.remote';

	let { show = $bindable(false), organizationId = '' } = $props();
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-lg transition-all duration-300"
	>
		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl duration-200"
		>
			<header class="flex items-center justify-between border-b border-slate-800 p-8">
				<h3 class="text-2xl font-black tracking-tight text-white">Create New Playtest</h3>
				<button
					onclick={() => (show = false)}
					class="btn btn-circle text-slate-400 btn-ghost btn-sm hover:text-white">✕</button
				>
			</header>

			<form
				{...createProject.enhance(async ({ form, submit }) => {
					try {
						if (await submit()) {
							show = false;
							form.reset();
						}
					} catch (e) {
						console.error(e);
					}
				})}
				class="space-y-6 p-8"
			>
				{#if organizationId}
					<input type="hidden" name="organizationId" value={organizationId} />
				{/if}
				<div class="form-control">
					<label class="label mb-2" for="project-name">
						<span class="label-text text-xs font-bold tracking-wider text-slate-300 uppercase"
							>Game / Project Name</span
						>
					</label>
					<input
						id="project-name"
						placeholder="e.g. My Amazing Platformer"
						class="input w-full rounded-xl border border-slate-800 bg-slate-950 py-6 text-white placeholder-slate-600 transition-all focus:border-purple-500 focus:outline-none"
						required
						{...createProject.fields.name.as('text')}
					/>
				</div>

				<div class="form-control rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
					<label
						class="label flex cursor-pointer items-center justify-between"
						for="password-toggle"
					>
						<div>
							<span class="label-text block font-bold text-white">Password Protection</span>
							<span class="mt-1 block text-xs text-slate-500"
								>Force playtesters to enter a password to play</span
							>
						</div>
						<input
							id="password-toggle"
							class="checkbox checkbox-primary"
							{...createProject.fields.passwordProtected.as('checkbox')}
						/>
					</label>

					{#if createProject.fields.passwordProtected.value()}
						<div
							class="form-control animate-in fade-in mt-4 border-t border-slate-800/80 pt-4 duration-200"
						>
							<label class="label mb-1" for="playtest-password">
								<span class="label-text text-xs font-bold text-slate-400 uppercase"
									>Access Password</span
								>
							</label>
							<input
								id="playtest-password"
								placeholder="••••••••"
								class="input w-full rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-700 transition-all focus:border-purple-500 focus:outline-none"
								required={createProject.fields.passwordProtected.value()}
								{...createProject.fields.password.as('password')}
							/>
						</div>
					{/if}
				</div>

				<footer class="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
					<button
						type="button"
						onclick={() => (show = false)}
						class="btn rounded-xl text-slate-400 btn-ghost hover:bg-slate-800/50 hover:text-white"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn rounded-xl border-none bg-linear-to-r from-purple-600 to-indigo-600 px-6 font-bold text-white hover:from-purple-500 hover:to-indigo-500"
					>
						Create Project
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
