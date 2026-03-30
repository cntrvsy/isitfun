<script lang="ts">
</script>

<svelte:head>
  <title>Is It Fun? | Test Your Game Idea</title>
  <meta name="description" content="Test your game ideas with friends and family easily on the browser. Collect insights and find out if your game is worth pursuing." />
</svelte:head>

<div class="min-h-screen bg-base-100 text-base-content font-sans">
  
  <!-- Hero Section -->
  <div class="hero min-h-screen bg-base-200">
    <div class="hero-content text-center max-w-3xl">
      <div class="space-y-6">
        <div class="badge badge-primary badge-outline mb-4">Beta Available Now</div>
        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight">
          Is your game <span class="text-primary italic">actually</span> fun?
        </h1>
        <p class="py-6 text-xl md:text-2xl opacity-80 leading-relaxed">
          Stop guessing. Share your browser-based game with friends, family, and playtesters in one click. Collect actionable feedback before you spend years building.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button class="btn btn-primary btn-lg shadow-lg shadow-primary/20">
             Start Testing Free
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
               <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
             </svg>
          </button>
          <button class="btn btn-outline btn-lg">
             View Example Report
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="py-24 bg-base-100">
    <div class="max-w-7xl mx-auto px-6">
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-5xl font-bold mb-4">Everything you need to validate your idea</h2>
        <p class="text-lg opacity-70">Focus on making a great game, we'll handle the feedback loop.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Feature 1 -->
        <div class="card bg-base-200 shadow-xl border border-base-300 hover:-translate-y-2 transition-transform duration-300">
          <div class="card-body">
            <div class="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 class="card-title text-2xl mb-2">Instant Browser Play</h3>
            <p class="opacity-80">No downloads, no installations. Testers just click your link and start playing immediately in their browser.</p>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="card bg-base-200 shadow-xl border border-base-300 hover:-translate-y-2 transition-transform duration-300">
          <div class="card-body">
            <div class="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 class="card-title text-2xl mb-2">Automated Insights</h3>
            <p class="opacity-80">We ask the right questions at the right time. Get structured data on fun, frustration, and polish instead of vague comments.</p>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="card bg-base-200 shadow-xl border border-base-300 hover:-translate-y-2 transition-transform duration-300">
          <div class="card-body">
            <div class="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="card-title text-2xl mb-2">Save Months of Dev Time</h3>
            <p class="opacity-80">Find out if the core loop is actually engaging before you spend hundreds of hours on art, sound, and extra levels.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- How it works -->
  <div class="py-24 bg-base-200">
    <div class="max-w-5xl mx-auto px-6">
      <h2 class="text-3xl md:text-5xl font-bold text-center mb-16">How it works</h2>
      
      <ul class="steps steps-vertical lg:steps-horizontal w-full font-medium">
        <li class="step step-primary" data-content="1">Upload WebGL/HTML5 Build</li>
        <li class="step step-primary" data-content="2">Share Private Link</li>
        <li class="step step-primary" data-content="3">Friends Play & Review</li>
        <li class="step step-primary" data-content="4">Read The Report</li>
      </ul>
    </div>
  </div>

  <!-- CTA Section -->
  <div class="py-24 bg-primary text-primary-content">
    <div class="max-w-4xl mx-auto text-center px-6">
      <h2 class="text-4xl md:text-5xl font-bold mb-6">Ready to find out if it's fun?</h2>
      <p class="text-xl mb-10 opacity-90 leading-relaxed text-primary-content/80">
        Join hundreds of indie devs who are validating their game ideas early. 
        Create your first playtest project today.
      </p>
      <button class="btn btn-base-100 border-none text-primary hover:bg-neutral hover:text-neutral-content btn-lg px-10 rounded-full font-bold shadow-xl">
        Get Started Now
      </button>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer items-center p-8 bg-neutral text-neutral-content">
    <aside class="items-center grid-flow-col gap-4">
      <span class="text-2xl font-black italic tracking-tighter">isitfun?</span>
      <p>Copyright © {new Date().getFullYear()} - All right reserved.</p>
    </aside> 
    <nav class="grid-flow-col gap-4 md:place-self-center md:justify-self-end">
      <a href="/" class="link link-hover">Twitter</a>
      <a href="/" class="link link-hover">Discord</a>
      <a href="/" class="link link-hover">Terms</a>
      <a href="/" class="link link-hover">Privacy</a>
    </nav>
  </footer>
</div>