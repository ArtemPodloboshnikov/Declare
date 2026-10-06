<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '$lib/i18n';
  import {
    presentation,
    type SlideElement,
    type AudioSettings,
    DEFAULT_AUDIO_SETTINGS
  } from '$lib/stores/presentation.svelte';
  import Checkbox from './Checkbox.svelte';
  import Select from './Select.svelte';
  import Slider from './Slider.svelte';
  import RangeSlider from './RangeSlider.svelte';
  import InputNumber from './InputNumber.svelte';

  import Music from '@lucide/svelte/icons/music';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

  let { element }: { element: SlideElement } = $props();

  const settings = $derived({ ...DEFAULT_AUDIO_SETTINGS, ...(element.audio ?? {}) });

  let duration = $state(0);
  let currentTime = $state(0);
  let playing = $state(false);
  let previewEl: HTMLAudioElement | null = null;
  let scrubbing = $state(false);

  // Эффект 1: создание Audio при смене файла
  $effect(() => {
    const src = element.content;

    untrack(() => {
      if (!src) {
        duration = 0;
        return;
      }

      // остановить предыдущий
      if (previewEl) {
        previewEl.pause();
        previewEl.src = '';
        previewEl = null;
      }
      playing = false;
      currentTime = 0;

      const a = new Audio(src);
      a.preload = 'metadata';
      a.onloadedmetadata = () => {
        duration = Number.isFinite(a.duration) ? a.duration : 0;
      };
      a.onerror = () => { duration = 0; };
      a.ontimeupdate = () => {
        if (!scrubbing) currentTime = a.currentTime;
      };
      a.onplay = () => { playing = true; };
      a.onpause = () => { playing = false; };

      previewEl = a;
    });

    return () => {
      untrack(() => {
        if (previewEl) {
          previewEl.pause();
          previewEl.src = '';
          previewEl = null;
        }
      });
    };
  });

  // Эффект 2: обновление громкости и loop БЕЗ пересоздания
  $effect(() => {
    const vol = settings.volume;
    const lp = settings.loop;

    untrack(() => {
      const a = previewEl;
      if (!a) return;
      a.volume = Math.max(0, Math.min(1, vol));
      a.loop = lp;
    });
  });

  function update(patch: Partial<AudioSettings>) {
    const current = element.audio ?? DEFAULT_AUDIO_SETTINGS;
    const next = { ...current, ...patch };

    // не дёргаем стор, если ничего не изменилось
    let changed = false;
    for (const k of Object.keys(patch) as (keyof AudioSettings)[]) {
      if (current[k] !== next[k]) { changed = true; break; }
    }
    if (!changed) return;

    presentation.updateElement(element.id, { audio: next }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  function reset() {
    stopPreview();
    presentation.updateElement(element.id, { audio: undefined });
    commit();
  }

  function formatDuration(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---------- Предпросмотр ----------
  function togglePreview() {
    if (!previewEl) return;
    if (playing) {
      previewEl.pause();
    } else {
      // Начинаем с startTime, если currentTime вне диапазона
      const start = settings.startTime;
      const end = settings.endTime > 0 ? settings.endTime : duration;
      if (previewEl.currentTime < start || previewEl.currentTime >= end) {
        previewEl.currentTime = start;
      }
      previewEl.play().catch(() => {});
    }
  }

  function stopPreview() {
    if (previewEl) {
      previewEl.pause();
      previewEl.currentTime = 0;
    }
    playing = false;
    currentTime = 0;
  }

  function seekTo(sec: number) {
    if (!previewEl) return;
    const clamped = Math.max(0, Math.min(sec, duration));
    previewEl.currentTime = clamped;
    currentTime = clamped;
  }

  function onScrubInput(v: number) {
    scrubbing = true;
    seekTo(v);
  }

  function onScrubChange(v: number) {
    scrubbing = false;
    seekTo(v);
  }

  // ---------- Диапазон start/end ----------
  const rangeValue = $derived<[number, number]>([
    settings.startTime,
    settings.endTime > 0 ? settings.endTime : duration
  ]);

  function onRangeChange([start, end]: [number, number]) {
    // Если end равен duration — считаем, что end не задан (0)
    const endValue = end >= duration - 0.05 ? 0 : end;
    update({ startTime: start, endTime: endValue });
    commit();
  }
</script>

<div class="audio-panel">
  <header class="panel-subheader">
    <Music size={14} strokeWidth={1.75} />
    <span>{t('audio.title')}</span>
  </header>

  <!-- Файл -->
  <div class="block">
    <div class="file-info">
      <Music size={12} strokeWidth={1.75} />
      <span class="file-name" title={element.content}>
        {element.content.split('/').pop()?.split('?')[0] ?? 'audio'}
      </span>
      {#if duration > 0}
        <span class="duration">{formatDuration(duration)}</span>
      {/if}
    </div>
  </div>

  <!-- Предпросмотр: кнопка play/pause + шкала -->
  <div class="block preview-block">
    <button
      type="button"
      class="preview-play"
      class:playing
      onclick={togglePreview}
      disabled={!element.content}
    >
      {#if playing}
        <Pause size={16} strokeWidth={2} />
      {:else}
        <Play size={16} strokeWidth={2} />
      {/if}
    </button>

    <div class="preview-time">
      {formatDuration(currentTime)} / {formatDuration(duration)}
    </div>

    <div class="preview-scrub">
      <Slider
        value={Math.round(currentTime * 10) / 10}
        min={0}
        max={Math.max(duration, 1)}
        step={0.1}
        oninput={onScrubInput}
        onchange={onScrubChange}
      />
    </div>
  </div>

  <!-- Флаги -->
  <div class="block">
    <Checkbox
      checked={settings.autoplay}
      label={t('audio.autoplay')}
      onchange={(v) => { update({ autoplay: v }); commit(); }}
    />
    <Checkbox
      checked={settings.playOnClick}
      label={t('audio.playOnClick')}
      onchange={(v) => { update({ playOnClick: v }); commit(); }}
    />
    <Checkbox
      checked={settings.loop}
      label={t('audio.loop')}
      onchange={(v) => { update({ loop: v }); commit(); }}
    />
    <Checkbox
      checked={settings.hideControls}
      label={t('audio.hideControls')}
      onchange={(v) => { update({ hideControls: v }); commit(); }}
    />
    <Checkbox
      checked={settings.stopOnSlideLeave}
      label={t('audio.stopOnSlideLeave')}
      onchange={(v) => { update({ stopOnSlideLeave: v }); commit(); }}
    />
  </div>

  <!-- Диапазон воспроизведения -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('audio.range')}</span>
      <RangeSlider
        value={rangeValue}
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        formatValue={(v) => formatDuration(v)}
        onchange={onRangeChange}
      />
      <p class="hint">{t('audio.rangeHint')}</p>
    </div>
  </div>

  <!-- Точные значения (InputNumber как раньше) -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('audio.startTime')}</span>
      <InputNumber
        value={Math.round(settings.startTime * 10) / 10}
        min={0}
        max={Math.max(duration, 0)}
        step={0.1}
        precision={1}
        suffix="с"
        onchange={(v) => { update({ startTime: v }); commit(); }}
      />
    </div>

    <div class="row">
      <span class="panel-lbl">{t('audio.endTime')}</span>
      <InputNumber
        value={Math.round(settings.endTime * 10) / 10}
        min={0}
        max={Math.max(duration, 0)}
        step={0.1}
        precision={1}
        suffix="с"
        onchange={(v) => { update({ endTime: v }); commit(); }}
      />
      <p class="hint">{t('audio.endTimeHint')}</p>
    </div>

    <div class="row">
      <span class="panel-lbl">{t('audio.volume')}</span>
      <Slider
        value={Math.round(settings.volume * 100)}
        min={0} max={100}
        suffix="%"
        oninput={(v) => update({ volume: v / 100 })}
        onchange={commit}
      />
    </div>
  </div>

  <!-- Вид плеера -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('audio.playerStyle')}</span>
      <Select
        value={settings.playerStyle}
        options={[
          { value: 'minimal', label: t('audio.style.minimal') },
          { value: 'compact', label: t('audio.style.compact') },
          { value: 'full',    label: t('audio.style.full') }
        ]}
        onchange={(v) => { update({ playerStyle: v as AudioSettings['playerStyle'] }); commit(); }}
      />
    </div>
  </div>

  <div class="actions">
    <button class="ghost" onclick={reset} title={t('common.reset')}>
      <RotateCcw size={14} strokeWidth={1.75} />
      {t('common.reset')}
    </button>
  </div>
</div>

<style>
  .audio-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 0;
  }
  .file-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .duration {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  /* ---------- Предпросмотр ---------- */
  .preview-block {
    display: grid;
    grid-template-columns: 34px auto 1fr;
    align-items: center;
    gap: 10px;
  }

  .preview-play {
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-primary);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);
  }
  .preview-play:hover:not(:disabled) { background: var(--accent-hover); transform: scale(1.05); }
  .preview-play:active:not(:disabled) { transform: scale(0.95); }
  .preview-play:disabled { opacity: 0.5; cursor: not-allowed; }

  .preview-time {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .preview-scrub {
    min-width: 0;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .actions {
    display: flex;
    gap: 6px;
  }
  .actions button {
    flex: 1;
    justify-content: center;
    font-size: 12px;
  }
</style>
