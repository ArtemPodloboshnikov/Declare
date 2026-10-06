<script lang="ts">
  import type { SlideElement } from '$lib/stores/presentation.svelte';
  import { DEFAULT_VIDEO_SETTINGS } from '$lib/stores/presentation.svelte';
  import { parseEmbedUrl, embedAllow } from '$lib/services/video-embed';

  let {
    element
  }: {
    element: SlideElement;
  } = $props();

  const settings = $derived({ ...DEFAULT_VIDEO_SETTINGS, ...(element.video ?? {}) });

  const embedInfo = $derived(
    settings.embedUrl ? parseEmbedUrl(settings.embedUrl) : null
  );

  // Параметры для YouTube / Rutube / VK
  const params = $derived.by(() => {
    const list: string[] = [];
    if (settings.autoplay) list.push('autoplay=1');
    if (settings.muted) list.push('mute=1');
    if (settings.loop) {
      list.push('loop=1');
      if (embedInfo?.provider === 'youtube') {
        list.push(`playlist=${embedInfo.id}`);
      }
    }
    if (settings.controls === false && embedInfo?.provider === 'youtube') {
      list.push('controls=0');
    }
    if (settings.startTime > 0) list.push(`start=${Math.round(settings.startTime)}`);
    if (settings.endTime > 0) list.push(`end=${Math.round(settings.endTime)}`);
    return list.join('&');
  });

  const finalUrl = $derived.by(() => {
    if (!embedInfo) return '';
    const base = embedInfo.embedUrl;
    if (!params) return base;
    return base.includes('?') ? `${base}&${params}` : `${base}?${params}`;
  });
</script>

{#if !embedInfo}
  <div class="embed-error">
    Некорректная ссылка на видео
  </div>
{:else}
  <div class="embed-player" data-provider={embedInfo.provider}>
    <iframe
      src={finalUrl}
      title="Video player"
      frameborder="0"
      allow={embedAllow(embedInfo.provider)}
      allowfullscreen
      loading="lazy"
    ></iframe>
  </div>
{/if}

<style>
  .embed-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
    border-radius: inherit;
  }

  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    vertical-align: top;
  }

  .embed-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--danger);
    font-size: 12px;
    background: var(--bg-tertiary);
  }
</style>
