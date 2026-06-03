<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Tasks Dashboard</h1>

	<!-- Create Form -->
	<div class="card mb-8 bg-base-200 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">New Task</h2>
			<form method="POST" action="?/create" use:enhance class="flex items-end gap-4">
				<div class="form-control w-full">
					<label class="label" for="title">
						<span class="label-text">Title</span>
					</label>
					<input
						id="title"
						type="text"
						name="title"
						placeholder="What needs to be done?"
						class="input-bordered input w-full"
						required
					/>
				</div>
				<div class="form-control w-32">
					<label class="label" for="priority">
						<span class="label-text">Priority</span>
					</label>
					<input
						id="priority"
						type="number"
						name="priority"
						value="1"
						class="input-bordered input w-full"
						required
					/>
				</div>
				<button class="btn btn-primary" type="submit">Add Task</button>
			</form>
			{#if form?.missing}
				<p class="mt-2 text-sm text-error">Title is required!</p>
			{/if}
		</div>
	</div>

	<!-- Tasks List -->
	<div class="space-y-4">
		{#each data.tasks as t (t.id)}
			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body p-4">
					<!-- Update Form -->
					<form method="POST" action="?/update" use:enhance class="flex items-center gap-4">
						<input type="hidden" name="id" value={t.id} />

						<input
							type="text"
							name="title"
							value={t.title}
							class="input input-sm w-full border-transparent hover:border-base-300 focus:border-primary"
							required
						/>

						<div class="flex items-center gap-2">
							<span class="text-xs font-semibold text-base-content/50 uppercase">Pri</span>
							<input
								type="number"
								name="priority"
								value={t.priority}
								class="input input-sm w-16 border-transparent hover:border-base-300 focus:border-primary"
								required
							/>
						</div>

						<button class="btn text-success btn-ghost btn-sm" type="submit">Save</button>

						<!-- Delete Button (separate form to not conflict with update) -->
						<button
							class="btn text-error btn-ghost btn-sm"
							formaction="?/delete"
							type="submit"
							aria-label="Delete"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					</form>
				</div>
			</div>
		{:else}
			<div
				class="text-center py-12 text-base-content/50 border-2 border-dashed border-base-300 rounded-box"
			>
				<p>No tasks yet. Create one above!</p>
			</div>
		{/each}
	</div>
</div>
