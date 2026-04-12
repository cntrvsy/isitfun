<script lang="ts">
	import Footer from "$lib/components/Footer.svelte";
  import { resolve } from "$app/paths";

</script>

<svelte:head>
  <title>Is It Fun? | Test Your Game Idea</title>
  <meta name="description" content="Test your game ideas with friends and family easily on the browser. Collect insights and find out if your game is worth pursuing." />
</svelte:head>

<div class="min-h-screen flex flex-col bg-base-100">
  <div class="hero grow bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-xl">
        <h1 class="text-5xl font-bold mb-8">Is It Fun?</h1>
        <p class="text-xl mb-8 leading-relaxed">
          simple web application to share prototypes with your community to gather information about whether your game will be fun to play.
        </p>
        <a href={resolve("/auth/login")} class="btn btn-primary btn-lg">Get Started</a>
      </div>
    </div>
  </div>
  <Footer />
</div>