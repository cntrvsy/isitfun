<script lang="ts">
	import { Copy, Check, Shield, Clock } from '@lucide/svelte';

	interface Props {
		origin: string;
	}

	let { origin }: Props = $props();

	let activeGuideTab = $state<'js' | 'godot' | 'unity' | 'phaser'>('js');
	let copiedSnippet = $state(false);

	const snippets: Record<'js' | 'godot' | 'unity' | 'phaser', string> = {
		js: `// Native JS / HTML5 Canvas\nwindow.IsItFun?.log("level_complete", {\n  level_id: "world_1_1",\n  score: 12500,\n  coins: 42\n});`,
		godot: `# Godot 4 GDScript Web Bridge\nfunc log_event(event_name: String, data: Dictionary):\n    if OS.has_feature("web"):\n        var js_code = "window.IsItFun.log(%s, %s);" % [JSON.stringify(event_name), JSON.stringify(data)]\n        JavaScriptBridge.eval(js_code, true)`,
		unity: `// 1. Create Assets/Plugins/WebGL/IsItFunBridge.jslib:\n// mergeInto(LibraryManager.library, {\n//   IsItFunLog: function(evtPtr, jsonPtr) {\n//     var evt = UTF8ToString(evtPtr);\n//     var data = JSON.parse(UTF8ToString(jsonPtr));\n//     if (window.IsItFun) window.IsItFun.log(evt, data);\n//   }\n// });\n\n// 2. In Unity C# script:\n[DllImport("__Internal")]\nprivate static extern void IsItFunLog(string eventName, string jsonPayload);\n\npublic void LogEvent(string name, object data) {\n    #if !UNITY_EDITOR && UNITY_WEBGL\n    IsItFunLog(name, JsonUtility.ToJson(data));\n    #endif\n}`,
		phaser: `// Phaser 3 Scene Event Logging\nthis.events.on('score_changed', (newScore) => {\n    window.IsItFun?.log("score_update", { score: newScore });\n});`
	};

	async function copyCurrentSnippet() {
		try {
			await navigator.clipboard.writeText(snippets[activeGuideTab]);
			copiedSnippet = true;
			setTimeout(() => {
				copiedSnippet = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy code snippet:', err);
		}
	}
</script>

<div class="mt-14 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
	<h2 class="text-xl font-bold tracking-tight text-slate-900">
		Telemetry Integration Guide
	</h2>
	<p class="mt-1 text-sm text-slate-600">
		IsItFun exposes a window-level logging API. Embed the script and call our logging function from any HTML5 game engine.
	</p>

	<div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- Setup Snippet -->
		<div class="space-y-6 lg:col-span-2">
			<div>
				<h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
					1. Include Script (Auto-injected on hosted builds)
				</h3>
				<div class="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200">
					<pre><code>&lt;script src="{origin}/assets/overlay-widget.js" data-project="YOUR_PROJECT_ID"&gt;&lt;/script&gt;</code></pre>
				</div>
			</div>

			<div>
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						2. Call Log API from Game Engine
					</h3>
					<button
						onclick={copyCurrentSnippet}
						class="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
					>
						{#if copiedSnippet}
							<Check class="h-3.5 w-3.5 text-emerald-600" /> Copied
						{:else}
							<Copy class="h-3.5 w-3.5" /> Copy Snippet
						{/if}
					</button>
				</div>

				<!-- Tabs -->
				<div class="mt-3 flex border-b border-slate-200 text-xs font-semibold">
					<button
						onclick={() => (activeGuideTab = 'js')}
						class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'js'
							? 'border-purple-600 text-purple-700 font-bold'
							: 'border-transparent text-slate-500 hover:text-slate-900'}"
					>
						JavaScript
					</button>
					<button
						onclick={() => (activeGuideTab = 'godot')}
						class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'godot'
							? 'border-purple-600 text-purple-700 font-bold'
							: 'border-transparent text-slate-500 hover:text-slate-900'}"
					>
						Godot 4
					</button>
					<button
						onclick={() => (activeGuideTab = 'unity')}
						class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'unity'
							? 'border-purple-600 text-purple-700 font-bold'
							: 'border-transparent text-slate-500 hover:text-slate-900'}"
					>
						Unity WebGL
					</button>
					<button
						onclick={() => (activeGuideTab = 'phaser')}
						class="border-b-2 px-4 py-2 transition-all {activeGuideTab === 'phaser'
							? 'border-purple-600 text-purple-700 font-bold'
							: 'border-transparent text-slate-500 hover:text-slate-900'}"
					>
						Phaser
					</button>
				</div>

				<div class="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200">
					{#if activeGuideTab === 'js'}
						<pre><code>// Native JS / HTML5 Canvas
window.IsItFun?.log("level_complete", &#123;
  level_id: "world_1_1",
  score: 12500,
  coins: 42
&#125;);</code></pre>
					{:else if activeGuideTab === 'godot'}
						<pre><code># Godot 4 GDScript Web Bridge
func log_event(event_name: String, data: Dictionary):
    if OS.has_feature("web"):
        var js_code = "window.IsItFun.log(%s, %s);" % [JSON.stringify(event_name), JSON.stringify(data)]
        JavaScriptBridge.eval(js_code, true)</code></pre>
					{:else if activeGuideTab === 'unity'}
						<pre><code>// 1. Create Assets/Plugins/WebGL/IsItFunBridge.jslib:
// mergeInto(LibraryManager.library, &#123;
//   IsItFunLog: function(evtPtr, jsonPtr) &#123;
//     var evt = UTF8ToString(evtPtr);
//     var data = JSON.parse(UTF8ToString(jsonPtr));
//     if (window.IsItFun) window.IsItFun.log(evt, data);
//   &#125;
// &#125;);

// 2. In Unity C# script:
[DllImport("__Internal")]
private static extern void IsItFunLog(string eventName, string jsonPayload);

public void LogEvent(string name, object data) &#123;
    #if !UNITY_EDITOR && UNITY_WEBGL
    IsItFunLog(name, JsonUtility.ToJson(data));
    #endif
&#125;</code></pre>
					{:else if activeGuideTab === 'phaser'}
						<pre><code>// Phaser 3 Scene Event Logging
this.events.on('score_changed', (newScore) => &#123;
    window.IsItFun?.log("score_update", &#123; score: newScore &#125;);
&#125;);</code></pre>
					{/if}
				</div>
			</div>
		</div>

		<!-- Rate Limits & Retention -->
		<div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6">
			<h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
				Limits & Retention
			</h3>

			<div class="flex items-start gap-3">
				<Shield class="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
				<div>
					<h4 class="text-xs font-bold text-slate-900">Protective Rate Limits</h4>
					<p class="text-[11px] leading-relaxed text-slate-600">
						Projects are protected with a rate limit of 5,000 logs/day to guard against infinite game loops.
					</p>
				</div>
			</div>

			<div class="flex items-start gap-3">
				<Clock class="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
				<div>
					<h4 class="text-xs font-bold text-slate-900">7-Day Log Decay</h4>
					<p class="text-[11px] leading-relaxed text-slate-600">
						Free tier sessions decay after 7 days. Commercial projects retain lifetime historical logs.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
