<script lang="ts">
	import { UploadManager } from '$lib/client/uploader';

	let {
		show = $bindable(false),
		projectId,
		isFree
	} = $props<{
		show: boolean;
		projectId: string;
		isFree: boolean;
	}>();

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let uploadedCount = $state(0);
	let totalFiles = $state(0);
	let currentUploadingFile = $state('');
	let uploadError = $state('');
	let isUploadSuccess = $state(false);
	let isCopied = $state(false);

	async function handleZipUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isUploading = true;
		uploadProgress = 0;
		uploadedCount = 0;
		totalFiles = 0;
		currentUploadingFile = 'Reading ZIP file...';
		uploadError = '';
		isUploadSuccess = false;

		const uploader = new UploadManager({
			projectId,
			isFree,
			onProgress: (progress, count, total, currentFile) => {
				uploadProgress = progress;
				uploadedCount = count;
				totalFiles = total;
				currentUploadingFile = currentFile;
			},
			onSuccess: (total) => {
				totalFiles = total;
				isUploadSuccess = true;
				isUploading = false;
			},
			onError: (err) => {
				uploadError = err;
				isUploading = false;
			}
		});

		try {
			await uploader.uploadZip(file);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : String(err);
			isUploading = false;
		}
	}

	function handleCopy() {
		const playUrl = `${window.location.origin}/play/${projectId}`;
		navigator.clipboard.writeText(playUrl).then(() => {
			isCopied = true;
			setTimeout(() => {
				isCopied = false;
			}, 2000);
		});
	}

	function handleClose() {
		show = false;
		// Reset state
		isUploading = false;
		uploadProgress = 0;
		uploadedCount = 0;
		totalFiles = 0;
		currentUploadingFile = '';
		uploadError = '';
		isUploadSuccess = false;
		isCopied = false;
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-lg transition-all duration-300"
	>
		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl duration-200"
		>
			<header class="flex items-center justify-between border-b border-slate-800 p-8">
				<div>
					<h3 class="text-2xl font-black text-white">Upload HTML5 Export</h3>
					<span class="mt-1 block text-xs text-slate-500"
						>Parallel browser decompress & edge streaming</span
					>
				</div>
				{#if !isUploading}
					<button
						onclick={handleClose}
						class="btn btn-circle text-slate-400 btn-ghost btn-sm hover:text-white">✕</button
					>
				{/if}
			</header>

			<div class="space-y-6 p-8">
				{#if !isUploading && !isUploadSuccess && !uploadError}
					<!-- Dropzone -->
					<div
						class="group relative rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/30 px-6 py-12 text-center transition-all hover:border-purple-500/50 hover:bg-slate-950/50"
					>
						<input
							type="file"
							accept=".zip"
							onchange={handleZipUpload}
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
							aria-label="Upload ZIP archive"
						/>
						<div class="mb-4 text-4xl transition-transform group-hover:scale-110">📦</div>
						<p class="mb-1 text-sm font-bold text-slate-300">
							Drag and drop your game ZIP archive here
						</p>
						<p class="text-xs text-slate-500">
							Contains index.html, JS, and asset binaries (max 100MB)
						</p>
					</div>
				{:else if isUploading}
					<!-- Upload Progress UI -->
					<div class="space-y-4 py-4">
						<div class="flex items-center justify-between text-sm font-bold">
							<span class="text-purple-400">Processing & Uploading Edge Assets...</span>
							<span class="text-slate-400">{uploadProgress}%</span>
						</div>

						<!-- Progress bar -->
						<div
							class="h-3 w-full overflow-hidden rounded-full border border-slate-800/80 bg-slate-950"
						>
							<div
								class="h-full rounded-full bg-linear-to-r from-purple-600 to-indigo-600 transition-all duration-300"
								style="width: {uploadProgress}%"
							></div>
						</div>

						<div class="mt-2 flex items-center justify-between text-xs text-slate-500">
							<span class="max-w-[320px] truncate font-mono">
								📄 {currentUploadingFile}
							</span>
							<span class="shrink-0 font-bold">
								{uploadedCount} / {totalFiles} Files
							</span>
						</div>

						<div
							class="animate-pulse space-y-1 rounded-xl border border-slate-800/50 bg-slate-950/50 p-4 font-mono text-xs text-slate-400"
						>
							<div>$ client: unzip zipBytes</div>
							<div>$ stream: put R2 games/{projectId}/assets/...</div>
						</div>
					</div>
				{:else if isUploadSuccess}
					<!-- Upload Success Screen -->
					<div class="space-y-4 py-8 text-center">
						<div
							class="mx-auto flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-emerald-500/10 text-3xl text-emerald-400 shadow-lg shadow-emerald-500/5"
						>
							✓
						</div>
						<h4 class="text-xl font-bold text-emerald-400">Upload Complete!</h4>
						<p class="mx-auto max-w-sm text-sm text-slate-400">
							Your game ZIP was successfully unzipped client-side and all {totalFiles} assets are loaded
							in the R2 edge storage bucket!
						</p>

						<div class="flex justify-center gap-3 border-t border-slate-800/80 pt-6">
							<button
								onclick={handleClose}
								class="btn rounded-xl border-none bg-slate-800 text-white hover:bg-slate-700"
							>
								Close
							</button>
							<button
								onclick={handleCopy}
								class="btn rounded-xl border-none bg-linear-to-r from-purple-600 to-indigo-600 px-6 text-white hover:from-purple-500 hover:to-indigo-500"
							>
								{#if isCopied}
									✨ Copied!
								{:else}
									Copy Play URL
								{/if}
							</button>
						</div>
					</div>
				{:else if uploadError}
					<!-- Error Screen -->
					<div class="space-y-4 py-6 text-center">
						<div
							class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-3xl text-rose-400"
						>
							⚠️
						</div>
						<h4 class="text-xl font-bold text-rose-400">Failed to Upload</h4>
						<p class="mx-auto max-w-md text-sm text-slate-400">{uploadError}</p>

						<div class="border-t border-slate-800/80 pt-6">
							<button
								onclick={() => {
									uploadError = '';
									isUploading = false;
									isUploadSuccess = false;
								}}
								class="btn rounded-xl border-none bg-purple-600 px-6 text-white hover:bg-purple-500"
							>
								Try Again
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
