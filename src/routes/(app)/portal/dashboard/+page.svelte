<script lang="ts">
	import { unzip } from 'fflate';
	import { resolve } from '$app/paths';
	import { createProject, deleteProject, upgradeProject } from './dashboard.remote';

	let { data } = $props();

	// Svelte 5 Reactive States
	let showCreateModal = $state(false);
	let selectedProjectId = $state('');
	let showUploadModal = $state(false);

	// ZIP upload state tracking
	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let uploadedCount = $state(0);
	let totalFiles = $state(0);
	let currentUploadingFile = $state('');
	let uploadError = $state('');
	let isUploadSuccess = $state(false);

	// Create project state tracking
	let copyStatus = $state<Record<string, boolean>>({});

	// Handle browser zip unzip and chunked stream R2 upload
	async function handleZipUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isUploading = true;
		const activeProject = data.projects.find(p => p.id === selectedProjectId);
		if (activeProject?.tier === 'free' && file.size > 40 * 1024 * 1024) {
			uploadError = `Free Jammer Tier projects are limited to a maximum ZIP file size of 40 MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Please upgrade to a Project Pass to upload larger builds.`;
			isUploading = false;
			return;
		}
		uploadProgress = 0;
		uploadedCount = 0;
		totalFiles = 0;
		currentUploadingFile = 'Reading ZIP file...';
		uploadError = '';
		isUploadSuccess = false;

		const reader = new FileReader();
		reader.onload = async (e) => {
			const arrayBuffer = e.target?.result as ArrayBuffer;
			
			unzip(new Uint8Array(arrayBuffer), async (err, unzipped) => {
				if (err) {
					uploadError = 'Failed to decompress the ZIP archive.';
					isUploading = false;
					return;
				}

				// Filter out directories and meta files
				const files = Object.entries(unzipped).filter(([name]) => {
					return !name.endsWith('/') && !name.includes('__MACOSX') && !name.startsWith('.');
				});

				// Validate that index.html exists
				const hasIndexHtml = files.some(([name]) => name === 'index.html' || name.endsWith('/index.html'));
				if (!hasIndexHtml) {
					uploadError = 'Missing "index.html" in the root or directories of your ZIP package.';
					isUploading = false;
					return;
				}

				totalFiles = files.length;
				uploadedCount = 0;
				uploadProgress = 0;

				// Parallel chunked streaming with concurrency of 3 workers
				const concurrency = 3;
				let fileIndex = 0;
				let encounteredError = false;

				async function uploadWorker() {
					while (fileIndex < files.length && !encounteredError) {
						const currentIdx = fileIndex++;
						const [rawPath, dataBytes] = files[currentIdx];
						
						// If index.html is nested under a single folder, normalize its path
						// Wait, let's keep paths relative to what the ZIP had
						currentUploadingFile = rawPath;

						try {
							const response = await fetch(`/api/games/${selectedProjectId}/upload?path=${encodeURIComponent(rawPath)}`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/octet-stream'
								},
								body: dataBytes
							});

							if (!response.ok) {
								throw new Error(`Failed with status ${response.status}`);
							}

							uploadedCount++;
							uploadProgress = Math.round((uploadedCount / totalFiles) * 100);
						} catch (errorUpload) {
							console.error(errorUpload);
							const msg = errorUpload instanceof Error ? errorUpload.message : String(errorUpload);
							uploadError = `Failed uploading "${rawPath}": ${msg}`;
							encounteredError = true;
						}
					}
				}

				// Spawn workers
				const workers = [];
				for (let w = 0; w < Math.min(concurrency, files.length); w++) {
					workers.push(uploadWorker());
				}

				await Promise.all(workers);

				if (!encounteredError) {
					isUploadSuccess = true;
				}
				isUploading = false;
			});
		};

		reader.readAsArrayBuffer(file);
	}

	function triggerCopy(projectId: string) {
		const playUrl = `${window.location.origin}/play/${projectId}`;
		navigator.clipboard.writeText(playUrl).then(() => {
			copyStatus[projectId] = true;
			setTimeout(() => {
				copyStatus[projectId] = false;
			}, 2000);
		});
	}

	function openUpload(projectId: string) {
		selectedProjectId = projectId;
		showUploadModal = true;
		uploadProgress = 0;
		isUploading = false;
		isUploadSuccess = false;
		uploadError = '';
	}
</script>

<svelte:head>
	<title>Developer Portal | Is It Fun?</title>
	<meta name="description" content="Manage your playtests, upload game files, and review user satisfaction and telemetry." />
</svelte:head>

<main class="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 relative overflow-hidden">
	<!-- Decorative background glows -->
	<div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
	<div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>

	<!-- Premium Top Navigation Bar -->
	<nav class="sticky top-0 z-30 backdrop-blur-md bg-slate-900/60 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-linear-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/25">
				🎮
			</div>
			<div>
				<span class="font-extrabold text-lg tracking-tight bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">IsItFun</span>
				<span class="text-xs block text-slate-400 font-semibold uppercase tracking-wider">Developer Portal</span>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<a href={resolve('/portal/profile')} class="btn btn-ghost btn-sm text-slate-300 hover:text-white">Profile</a>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="btn btn-outline btn-error btn-sm rounded-lg">Sign Out</button>
			</form>
		</div>
	</nav>

	<!-- Dashboard Container -->
	<div class="max-w-6xl mx-auto px-6 mt-12 relative z-10">
		
		<!-- Welcome Header and Stats Overview -->
		<header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
			<div>
				<h1 id="main-title" class="text-4xl md:text-5xl font-black tracking-tight mb-2 bg-linear-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
					Game Dashboard
				</h1>
				<p class="text-slate-400 text-lg">Create, deploy, and monitor your browser playtests at the edge.</p>
			</div>
			<div>
				<button 
					id="create-project-btn"
					onclick={() => showCreateModal = true} 
					class="btn bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none text-white font-bold px-6 shadow-xl shadow-purple-500/20 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
					</svg>
					New Playtest Project
				</button>
			</div>
		</header>

		<!-- Statistics Ribbon -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
			<div class="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between hover:border-purple-500/30 transition-all">
				<div>
					<span class="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Active Projects</span>
					<span class="text-3xl font-black">{data.projects.length}</span>
				</div>
				<div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
					📦
				</div>
			</div>
			<div class="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between hover:border-indigo-500/30 transition-all">
				<div>
					<span class="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">D1 Analytics DB</span>
					<span class="text-3xl font-black text-emerald-400">Active</span>
				</div>
				<div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
					⚡
				</div>
			</div>
			<div class="backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between hover:border-blue-500/30 transition-all">
				<div>
					<span class="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">R2 Assets Storage</span>
					<span class="text-3xl font-black text-indigo-400">Online</span>
				</div>
				<div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
					☁️
				</div>
			</div>
		</div>

		<!-- Projects Section -->
		<section>
			<h2 class="text-xl font-bold tracking-tight text-slate-300 mb-6 flex items-center gap-2">
				<span>Your Playtests</span>
				<span class="badge badge-sm bg-slate-800 text-slate-400 border-none px-2 py-1">{data.projects.length}</span>
			</h2>

			{#if data.projects.length === 0}
				<div class="backdrop-blur-md bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl py-20 text-center px-6">
					<div class="w-20 h-20 bg-slate-900/60 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
						👾
					</div>
					<h3 class="text-xl font-bold text-slate-200 mb-2">No playtests found</h3>
					<p class="text-slate-500 max-w-md mx-auto mb-8">Ready to test if your game is actually fun? Create a new project to start streaming telemetry.</p>
					<button onclick={() => showCreateModal = true} class="btn btn-primary bg-purple-600 hover:bg-purple-500 border-none shadow-lg rounded-xl">
						Create First Project
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
					{#each data.projects as p (p.id)}
						{@const del = deleteProject.for(p.id)}
						{@const upgrade = upgradeProject.for(p.id)}
						<article class="relative group backdrop-blur-md bg-slate-900/30 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/5 hover:-translate-y-1">
							<!-- Glowing border effect -->
							<div class="absolute inset-0 bg-linear-to-r from-purple-500/0 to-indigo-500/0 group-hover:from-purple-500/5 group-hover:to-indigo-500/5 rounded-3xl transition-all pointer-events-none"></div>

							<div class="flex items-start justify-between mb-4 relative z-10">
								<div>
									<h3 class="text-2xl font-extrabold tracking-tight text-white mb-1 group-hover:text-purple-300 transition-colors">
										{p.name}
									</h3>
									<span class="text-xs font-medium text-slate-500">
										Created on {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
									</span>
								</div>
								<div class="flex items-center gap-2">
									{#if p.passwordProtected}
										<span class="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[10px] uppercase px-2 py-1 rounded-md">
											🔐 Private
										</span>
									{:else}
										<span class="badge bg-slate-800 text-slate-400 border-none text-[10px] uppercase px-2 py-1 rounded-md">
											🌐 Public
										</span>
									{/if}
									<span class="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-[10px] uppercase px-2 py-1 rounded-md">
										{p.tier}
									</span>
								</div>
							</div>

							<!-- Telemetry Stats mockup or link -->
							<div class="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 mb-6 relative z-10 flex justify-between text-center divide-x divide-slate-800/60">
								<div class="flex-1">
									<span class="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Telemetry ID</span>
									<code class="text-xs font-mono text-purple-400 font-bold">{p.id}</code>
								</div>
							</div>

							<!-- Action Buttons -->
							<div class="flex flex-wrap gap-3 items-center justify-between pt-4 border-t border-slate-800/60 relative z-10">
								<div class="flex gap-2">
									<button 
										onclick={() => openUpload(p.id)} 
										class="btn btn-sm bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/20 rounded-lg px-4 font-bold transition-all"
										aria-label="Upload game bundle"
									>
										☁️ Upload Game ZIP
									</button>
									<button 
										onclick={() => triggerCopy(p.id)} 
										class="btn btn-sm btn-ghost text-slate-300 hover:text-white rounded-lg px-3"
										aria-label="Copy play link"
									>
										{#if copyStatus[p.id]}
											✨ Copied!
										{:else}
											🔗 Copy Play Link
										{/if}
									</button>

									{#if p.tier === 'free'}
										<form {...upgrade.enhance(async ({ submit }) => {
											try {
												if (await submit()) {
													const res = upgrade.result;
													if (res && typeof res === 'object') {
														if ('redirectUrl' in res && res.redirectUrl) {
															window.location.href = String(res.redirectUrl);
														} else if ('success' in res && res.success) {
															alert('Simulated payment successful! Project upgraded to Project Pass.');
															window.location.reload();
														}
													}
												}
											} catch (e) {
												console.error(e);
											}
										})} class="inline">
											<input {...upgrade.fields.id.as('hidden', p.id)} />
											<button 
												type="submit" 
												class="btn btn-sm bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold rounded-lg px-4 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/25 border-none transition-all"
												aria-label="Upgrade project"
											>
												⚡ Upgrade (£15)
											</button>
										</form>
									{/if}
								</div>

								<!-- Delete Project (Remote Function) -->
								<form {...del}>
									<input {...del.fields.id.as('hidden', p.id)} />
									<button 
										type="submit" 
										class="btn btn-sm btn-circle btn-ghost text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
										aria-label="Delete project"
										onclick={(e) => { if (!confirm('Are you absolutely sure? This will purge all game assets and telemetry permanently.')) e.preventDefault(); }}
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</form>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<!-- High Fidelity GLASS Create Project Modal -->
	{#if showCreateModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-lg bg-slate-950/80 transition-all duration-300">
			<div class="backdrop-blur-xl bg-slate-900/90 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
				
				<header class="p-8 border-b border-slate-800 flex items-center justify-between">
					<h3 class="text-2xl font-black tracking-tight text-white">Create New Playtest</h3>
					<button onclick={() => showCreateModal = false} class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-white">✕</button>
				</header>

				<form {...createProject.enhance(async ({ form, submit }) => {
					try {
						if (await submit()) {
							showCreateModal = false;
							form.reset();
						}
					} catch (e) {
						console.error(e);
					}
				})} class="p-8 space-y-6">
					<div class="form-control">
						<label class="label mb-2" for="project-name">
							<span class="label-text text-slate-300 font-bold uppercase tracking-wider text-xs">Game / Project Name</span>
						</label>
						<input 
							id="project-name"
							placeholder="e.g. My Amazing Platformer" 
							class="input bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl w-full text-white placeholder-slate-600 focus:outline-none transition-all py-6" 
							required 
							{...createProject.fields.name.as('text')}
						/>
					</div>

					<div class="form-control bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
						<label class="label cursor-pointer flex items-center justify-between" for="password-toggle">
							<div>
								<span class="label-text text-white font-bold block">Password Protection</span>
								<span class="text-xs text-slate-500 block mt-1">Force playtesters to enter a password to play</span>
							</div>
							<input 
								id="password-toggle"
								class="checkbox checkbox-primary" 
								{...createProject.fields.passwordProtected.as('checkbox')}
							/>
						</label>

						{#if createProject.fields.passwordProtected.value()}
							<div class="mt-4 pt-4 border-t border-slate-800/80 form-control animate-in fade-in duration-200">
								<label class="label mb-1" for="playtest-password">
									<span class="label-text text-slate-400 text-xs uppercase font-bold">Access Password</span>
								</label>
								<input 
									id="playtest-password"
									placeholder="••••••••" 
									class="input bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl w-full text-white focus:outline-none placeholder-slate-700 transition-all" 
									required={createProject.fields.passwordProtected.value()} 
									{...createProject.fields.password.as('password')}
								/>
							</div>
						{/if}
					</div>

					<footer class="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
						<button type="button" onclick={() => showCreateModal = false} class="btn btn-ghost hover:bg-slate-800/50 rounded-xl text-slate-400 hover:text-white">
							Cancel
						</button>
						<button type="submit" class="btn bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none text-white font-bold rounded-xl px-6">
							Create Project
						</button>
					</footer>
				</form>
			</div>
		</div>
	{/if}

	<!-- Client ZIP upload & Decompression Progress Modal -->
	{#if showUploadModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-lg bg-slate-950/80 transition-all duration-300">
			<div class="backdrop-blur-xl bg-slate-900/95 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
				
				<header class="p-8 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h3 class="text-2xl font-black text-white">Upload HTML5 Export</h3>
						<span class="text-xs text-slate-500 mt-1 block">Parallel browser decompress & edge streaming</span>
					</div>
					{#if !isUploading}
						<button onclick={() => showUploadModal = false} class="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-white">✕</button>
					{/if}
				</header>

				<div class="p-8 space-y-6">
					{#if !isUploading && !isUploadSuccess && !uploadError}
						<!-- Dropzone -->
						<div class="border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-2xl py-12 px-6 text-center bg-slate-950/30 hover:bg-slate-950/50 transition-all relative group">
							<input 
								type="file" 
								accept=".zip" 
								onchange={handleZipUpload} 
								class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
								aria-label="Upload ZIP archive"
							/>
							<div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📦</div>
							<p class="text-sm font-bold text-slate-300 mb-1">Drag and drop your game ZIP archive here</p>
							<p class="text-xs text-slate-500">Contains index.html, JS, and asset binaries (max 100MB)</p>
						</div>
					{:else if isUploading}
						<!-- Upload Progress UI -->
						<div class="space-y-4 py-4">
							<div class="flex items-center justify-between text-sm font-bold">
								<span class="text-purple-400">Processing & Uploading Edge Assets...</span>
								<span class="text-slate-400">{uploadProgress}%</span>
							</div>
							
							<!-- Progress bar -->
							<div class="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800/80">
								<div 
									class="bg-linear-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all duration-300" 
									style="width: {uploadProgress}%"
								></div>
							</div>

							<div class="flex items-center justify-between text-xs text-slate-500 mt-2">
								<span class="truncate max-w-[320px] font-mono">
									📄 {currentUploadingFile}
								</span>
								<span class="font-bold shrink-0">
									{uploadedCount} / {totalFiles} Files
								</span>
							</div>

							<div class="animate-pulse bg-slate-950/50 border border-slate-800/50 rounded-xl p-4 text-xs font-mono text-slate-400 space-y-1">
								<div>$ client: unzip zipBytes</div>
								<div>$ stream: put R2 games/{selectedProjectId}/assets/...</div>
							</div>
						</div>
					{:else if isUploadSuccess}
						<!-- Upload Success Screen -->
						<div class="text-center py-8 space-y-4">
							<div class="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/5 animate-bounce">
								✓
							</div>
							<h4 class="text-xl font-bold text-emerald-400">Upload Complete!</h4>
							<p class="text-sm text-slate-400 max-w-sm mx-auto">Your game ZIP was successfully unzipped client-side and all {totalFiles} assets are loaded in the R2 edge storage bucket!</p>

							<div class="pt-6 border-t border-slate-800/80 flex justify-center gap-3">
								<button onclick={() => showUploadModal = false} class="btn bg-slate-800 hover:bg-slate-700 border-none text-white rounded-xl">
									Close
								</button>
								<button onclick={() => { triggerCopy(selectedProjectId); showUploadModal = false; }} class="btn bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none text-white rounded-xl px-6">
									Copy Play URL
								</button>
							</div>
						</div>
					{:else if uploadError}
						<!-- Error Screen -->
						<div class="text-center py-6 space-y-4">
							<div class="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center text-3xl mx-auto">
								⚠️
							</div>
							<h4 class="text-xl font-bold text-rose-400">Failed to Upload</h4>
							<p class="text-sm text-slate-400 max-w-md mx-auto">{uploadError}</p>

							<div class="pt-6 border-t border-slate-800/80">
								<button onclick={() => { uploadError = ''; isUploading = false; isUploadSuccess = false; }} class="btn bg-purple-600 hover:bg-purple-500 border-none text-white rounded-xl px-6">
									Try Again
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>