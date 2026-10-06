<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import Volume1 from '@lucide/svelte/icons/volume-1';
  import Repeat from '@lucide/svelte/icons/repeat';
  import type { SlideElement } from '$lib/stores/presentation.svelte';
  import { DEFAULT_AUDIO_SETTINGS } from '$lib/stores/presentation.svelte';

  let {
    element,
    mode = 'edit'
  }: {
    element: SlideElement;
    mode?: 'edit' | 'preview';
  } = $props();

  const settings = $derived({ ...DEFAULT_AUDIO_SETTINGS, ...(element.audio ?? {}) });

  let audioEl: HTMLAudioElement;
  let playing = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(settings.volume);
  let muted = $state(false);

  function formatTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (!audioEl) return;
    if (audioEl.paused) audioEl.play();
    else audioEl.pause();
  }

  function onPlay() { playing = true; }
  function onPause() { playing = false; }

  function onTimeUpdate() {
    if (!audioEl) return;
    currentTime = audioEl.currentTime;
    const end = settings.endTime > 0 ? settings.endTime : duration;
    if (end > 0 && audioEl.currentTime >= end) {
      if (settings.loop) {
        audioEl.currentTime = settings.startTime;
        audioEl.play();
      } else {
        audioEl.pause();
        audioEl.currentTime = settings.startTime;
      }
    }
  }

  function onLoadedMetadata() {
    if (!audioEl) return;
    duration = audioEl.duration;
    if (settings.startTime > 0) audioEl.currentTime = settings.startTime;
  }

  function seek(e: MouseEvent) {
    if (!audioEl || !duration) return;
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const end = settings.endTime > 0 ? settings.endTime : duration;
    const start = settings.startTime;
    audioEl.currentTime = start + pct * (end - start);
  }

  function changeVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    if (audioEl) audioEl.volume = volume;
  }

  function toggleMute() {
    if (!audioEl) return;
    muted = !muted;
    audioEl.muted = muted;
  }

  // Иконка громкости по уровню
  const VolumeIcon = $derived(
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  );

  const progressPercent = $derived.by(() => {
    const end = settings.endTime > 0 ? settings.endTime : duration;
    const span = end - settings.startTime;
    if (span <= 0) return 0;
    return ((currentTime - settings.startTime) / span) * 100;
  });

  onMount(() => {
    if (!audioEl) return;
    audioEl.volume = volume;
    if (mode === 'preview') {
      if (settings.autoplay) {
        // автоплей может быть заблокирован браузером до первого взаимодействия
        audioEl.play().catch(() => {
          // fallback: играть по первому клику по документу
          const once = () => {
            audioEl.play().catch(() => {});
            document.removeEventListener('click', once);
          };
          document.addEventListener('click', once, { once: true });
        });
      }
      // скрываем нативный controls, если hideControls
    }
  });

  onDestroy(() => {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
    }
  });

  export function play() { audioEl?.play(); }
  export function pause() { audioEl?.pause(); }
  export function stop() {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.currentTime = settings.startTime;
  }
</script>

<div
  class="audio-player"
  class:minimal={settings.playerStyle === 'minimal'}
  class:compact={settings.playerStyle === 'compact'}
  class:full={settings.playerStyle === 'full'}
>
  <audio
    bind:this={audioEl}
    src={element.content}
    onplay={onPlay}
    onpause={onPause}
    ontimeupdate={onTimeUpdate}
    onloadedmetadata={onLoadedMetadata}
    loop={settings.loop && settings.endTime === 0}
    preload="metadata"
  ></audio>

  {#if !settings.hideControls || mode === 'edit'}
    <button
      type="button"
      class="play-btn"
      onclick={togglePlay}
      aria-label={playing ? 'Pause' : 'Play'}
    >
      {#if playing}
        <Pause size={16} strokeWidth={2} />
      {:else}
        <Play size={16} strokeWidth={2} />
      {/if}
    </button>

    <div class="progress" onclick={seek} role="slider" tabindex="0" aria-valuenow={progressPercent}>
      <div class="progress-fill" style="width: {progressPercent}%"></div>
      <div class="progress-thumb" style="left: {progressPercent}%"></div>
    </div>

    <span class="time">
      {formatTime(currentTime - settings.startTime)} / {formatTime(
        (settings.endTime > 0 ? settings.endTime : duration) - settings.startTime
      )}
    </span>

    {#if settings.playerStyle === 'full'}
      <div class="volume-control">
        <button type="button" class="icon-btn" onclick={toggleMute} aria-label="Mute">
          <VolumeIcon size={14} strokeWidth={2} />
        </button>
        <input
          type="range"
          min="0" max="1" step="0.05"
          value={volume}
          oninput={(e) => changeVolume(Number((e.currentTarget as HTMLInputElement).value))}
        />
      </div>
    {/if}

    {#if settings.loop}
      <span class="loop-badge" title="Loop">
        <Repeat size={12} strokeWidth={2} />
      </span>
    {/if}
  {/if}
</div>

<style>
  .audio-player {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 6px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    user-select: none;
    box-sizing: border-box;
  }

  .audio-player.minimal {
    padding: 2px 6px;
    gap: 6px;
  }

  .play-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-primary);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .play-btn:hover { background: var(--accent-hover); transform: scale(1.05); }
  .play-btn:active { transform: scale(0.95); }

  .progress {
    position: relative;
    flex: 1;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    cursor: pointer;
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
  .progress-thumb {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: var(--accent-primary);
    border: 2px solid var(--bg-secondary);
    border-radius: 50%;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .progress:hover .progress-thumb { opacity: 1; }

  .time {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .volume-control {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 80px;
    flex-shrink: 0;
  }
  .volume-control input[type="range"] {
    width: 100%;
    height: 4px;
    accent-color: var(--accent-primary);
  }
  .icon-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .icon-btn:hover { color: var(--text-primary); }

  .loop-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  /* Минималистичный режим — только play и тонкая полоса */
  .minimal .time { display: none; }
  .minimal .loop-badge { display: none; }
</style>
