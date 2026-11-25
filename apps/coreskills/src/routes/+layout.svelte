<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  });
</script>

<svelte:head>
  <link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

{@render children()}
