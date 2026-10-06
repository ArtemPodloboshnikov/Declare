<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { app } from '$lib/stores/app.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();

  onMount(() => {
    void app.hydrate();
  });

  onMount(() => {
    const resetHtmlScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
    };
    window.addEventListener('scroll', resetHtmlScroll, { passive: true });
    document.documentElement.addEventListener('scroll', resetHtmlScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', resetHtmlScroll);
      document.documentElement.removeEventListener('scroll', resetHtmlScroll);
    };
  });

  // Синхронизация темы с <html data-theme>
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = app.theme;
  });

  // Синхронизация языка с <html lang>
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = app.language;
  });
</script>

{#if app.hydrated}
  <Toast />
  {@render children()}
{:else}
  <div class="boot-screen">
    <div class="spinner"></div>
  </div>
{/if}

<style>
  .boot-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
  }
</style>
