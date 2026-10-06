<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import Maximize from '@lucide/svelte/icons/maximize';
  import type { SlideElement } from '$lib/stores/presentation.svelte';
  import { DEFAULT_VIDEO_SETTINGS } from '$lib/stores/presentation.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n';

  let {
    element,
    mode = 'edit'
  }: {
    element: SlideElement;
    mode?: 'edit' | 'preview';
  } = $props();

  const settings = $derived({ ...DEFAULT_VIDEO_SETTINGS, ...(element.video ?? {}) });
  const playerStyle = $derived(settings.playerStyle ?? 'compact');

  let videoEl: HTMLVideoElement;
  let containerEl: HTMLDivElement;
  let playing = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(settings.volume);
  let muted = $state(settings.muted);

  const warned = new Set<string>();

  function notifyOnce(key: string, message: string) {
    if (warned.has(key)) return;
    warned.add(key);
    app.notify(message, 'error', 5000);
    setTimeout(() => warned.delete(key), 10_000);
  }

  function fileNameFromSrc(src: string): string {
    try {
      const last = src.split('/').pop()?.split('?')[0] ?? '';
      const decoded = decodeURIComponent(last);
      return decoded.split('\\').pop() ?? decoded;
    } catch {
      return src;
    }
  }

  function togglePlay() {
    if (!videoEl) return;
    if (videoEl.paused) videoEl.play();
    else videoEl.pause();
  }

  function onTimeUpdate() {
    if (!videoEl) return;
    currentTime = videoEl.currentTime;
    const end = settings.endTime > 0 ? settings.endTime : duration;
    if (end > 0 && videoEl.currentTime >= end) {
      if (settings.loop) {
        videoEl.currentTime = settings.startTime;
        videoEl.play();
      } else {
        videoEl.pause();
        videoEl.currentTime = settings.startTime;
      }
    }
  }

  function onLoadedMetadata() {
    if (!videoEl) return;
    duration = videoEl.duration;
    if (settings.startTime > 0) videoEl.currentTime = settings.startTime;
  }

  function onCanPlay() {
    if (!videoEl) return;
    if (mode !== 'edit') return;

    if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      const name = fileNameFromSrc(element.content);
      notifyOnce(
        `codec:${element.id}`,
        t('toast.videoCodecUnsupported', { name })
      );
    }
  }

  function onVideoError() {
    const el = videoEl;
    if (!el) return;
    if (mode !== 'edit') return;

    const err = el.error;
    const name = fileNameFromSrc(element.content);

    if (err && err.code === 4) {
      notifyOnce(
        `src:${element.id}`,
        t('toast.videoUnsupported', { name })
      );
    } else if (err) {
      notifyOnce(
        `err:${element.id}`,
        t('toast.videoError', { name, code: String(err.code) })
      );
    }
  }

  function seek(e: MouseEvent) {
    if (!videoEl || !duration) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const end = settings.endTime > 0 ? settings.endTime : duration;
    videoEl.currentTime = settings.startTime + pct * (end - settings.startTime);
  }

  function changeVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    if (videoEl) videoEl.volume = volume;
  }

  function toggleMute() {
    muted = !muted;
    if (videoEl) videoEl.muted = muted;
  }

  async function requestFullscreen() {
    if (!containerEl) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerEl.requestFullscreen();
    }
  }

  function formatTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const progressPercent = $derived.by(() => {
    const end = settings.endTime > 0 ? settings.endTime : duration;
    const span = end - settings.startTime;
    if (span <= 0) return 0;
    return ((currentTime - settings.startTime) / span) * 100;
  });

  // Показывать ли overlay вообще (только в edit или при controls)
  const showOverlay = $derived(mode === 'edit' || !settings.controls);

  onMount(() => {
    if (!videoEl) return;
    videoEl.volume = volume;
    videoEl.muted = muted;
    videoEl.loop = settings.loop && settings.endTime === 0;
  });

  onDestroy(() => {
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  });

  export function play() { videoEl?.play(); }
  export function pause() { videoEl?.pause(); }
  export function stop() {
    if (!videoEl) return;
    videoEl.pause();
    videoEl.currentTime = settings.startTime;
  }
</script>

<div
  class="video-player"
  class:style-minimal={playerStyle === 'minimal'}
  class:style-compact={playerStyle === 'compact'}
  class:style-full={playerStyle === 'full'}
  bind:this={containerEl}
>
  <video
    bind:this={videoEl}
    src={element.content}
    onplay={() => (playing = true)}
    onpause={() => (playing = false)}
    ontimeupdate={onTimeUpdate}
    onloadedmetadata={onLoadedMetadata}
    oncanplay={onCanPlay}
    onerror={onVideoError}
    playsinline
  ></video>

  {#if showOverlay}
    <div class="overlay">
      <button class="play-btn" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
        {#if playing}
          <Pause size={22} strokeWidth={2} />
        {:else}
          <Play size={22} strokeWidth={2} />
        {/if}
      </button>

      <div class="progress" onclick={seek} role="slider" tabindex="0">
        <div class="progress-fill" style="width: {progressPercent}%"></div>
      </div>

      {#if playerStyle !== 'minimal'}
        <span class="time">
          {formatTime(currentTime - settings.startTime)} / {formatTime(
            (settings.endTime > 0 ? settings.endTime : duration) - settings.startTime
          )}
        </span>
      {/if}

      {#if playerStyle === 'full'}
        <button class="icon-btn" onclick={toggleMute} aria-label="Mute">
          {#if muted || volume === 0}
            <VolumeX size={16} strokeWidth={2} />
          {:else}
            <Volume2 size={16} strokeWidth={2} />
          {/if}
        </button>

        <button class="icon-btn" onclick={requestFullscreen} aria-label="Fullscreen">
          <Maximize size={16} strokeWidth={2} />
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .video-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
    border-radius: inherit;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
    color: #fff;
    transition: opacity 0.2s ease;
  }

  /* ---------- minimal: панель видна всегда, play + прогресс ---------- */
  .video-player.style-minimal .overlay {
    padding: 6px 10px;
    gap: 8px;
    opacity: 1;
  }

  /* ---------- compact: панель появляется при ховере ---------- */
  .video-player.style-compact .overlay {
    opacity: 0;
    pointer-events: none;
  }
  .video-player.style-compact:hover .overlay {
    opacity: 1;
    pointer-events: all;
  }

  /* ---------- full: панель видна всегда, все контролы ---------- */
  .video-player.style-full .overlay {
    opacity: 1;
  }

  .play-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .play-btn:hover { background: rgba(255, 255, 255, 0.25); transform: scale(1.05); }

  .progress {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    min-width: 0;
  }

  .progress-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--accent-primary);
    border-radius: 2px;
    pointer-events: none;
  }

  .time {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity var(--transition-fast);
  }
  .icon-btn:hover { opacity: 0.75; }
</style>
