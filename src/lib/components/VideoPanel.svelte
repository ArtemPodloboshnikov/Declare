<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    presentation,
    type SlideElement,
    type VideoSettings,
    DEFAULT_VIDEO_SETTINGS
  } from '$lib/stores/presentation.svelte';
  import { parseEmbedUrl } from '$lib/services/video-embed';
  import Checkbox from './Checkbox.svelte';
  import Select from './Select.svelte';
  import Slider from './Slider.svelte';
  import RangeSlider from './RangeSlider.svelte';
  import InputNumber from './InputNumber.svelte';

  import Video from '@lucide/svelte/icons/video';
  import Link from '@lucide/svelte/icons/link';
  import Upload from '@lucide/svelte/icons/upload';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { fileNameFromAssetUrl } from '$lib/services/common';

  let { element }: { element: SlideElement } = $props();

  const settings = $derived({ ...DEFAULT_VIDEO_SETTINGS, ...(element.video ?? {}) });

  let duration = $state(0);
  let embedUrlInput = $state(settings.embedUrl ?? '');
  let embedError = $state<string | null>(null);
  let lastSrc: string | null = null;

  // Длительность известна только для локальных файлов
  $effect(() => {
    const src = element.content;
    const sourceType = settings.sourceType;

    if (!src || sourceType !== 'file') {
      duration = 0;
      lastSrc = null;
      return;
    }

    if (src === lastSrc) return;
    lastSrc = src;

    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      duration = Number.isFinite(v.duration) ? v.duration : 0;
    };
    v.onerror = () => { duration = 0; };
    v.src = src;

    return () => {
      v.onloadedmetadata = null;
      v.onerror = null;
      v.src = '';
      // если src сменился — сбросим duration, чтобы не показывать старое значение
      if (lastSrc !== src) duration = 0;
    };
  });

  function update(patch: Partial<VideoSettings>) {
    presentation.updateElement(element.id, {
      video: { ...settings, ...patch }
    }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  function reset() {
    presentation.updateElement(element.id, { video: undefined });
    commit();
  }

  function applyEmbedUrl() {
    const trimmed = embedUrlInput.trim();
    if (!trimmed) {
      embedError = t('video.embedEmpty');
      return;
    }
    const info = parseEmbedUrl(trimmed);
    if (!info) {
      embedError = t('video.embedInvalid');
      return;
    }
    embedError = null;
    update({
      sourceType: 'embed',
      embedProvider: info.provider,
      embedUrl: info.embedUrl
    });
    commit();
  }

  function switchToFile() {
    update({ sourceType: 'file', embedUrl: undefined, embedProvider: undefined });
    commit();
  }

  async function pickLocalVideo() {
    // Используй существующий pickFile из file-import
    const { pickFile, MEDIA_ACCEPT } = await import('$lib/services/file-import');
    const file = await pickFile(MEDIA_ACCEPT.video);
    if (!file) return;
    update({ sourceType: 'file' });
    presentation.updateElement(element.id, { content: file.blobUrl });
    commit();
  }

  function formatDuration(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const rangeValue = $derived<[number, number]>([
    settings.startTime,
    settings.endTime > 0 ? settings.endTime : Math.max(duration, 0.1)
  ]);

  function onRangeChange([start, end]: [number, number]) {
    const endValue = end >= duration - 0.05 ? 0 : end;
    update({ startTime: start, endTime: endValue });
    commit();
  }
</script>

<div class="video-panel">
  <header class="panel-subheader">
    <Video size={14} strokeWidth={1.75} />
    <span>{t('video.title')}</span>
  </header>

  <!-- Источник -->
  <div class="block">
    <div class="source-tabs">
      <button
        type="button"
        class:active={settings.sourceType === 'file'}
        onclick={switchToFile}
      >
        <Upload size={12} strokeWidth={1.75} />
        {t('video.sourceFile')}
      </button>
      <button
        type="button"
        class:active={settings.sourceType === 'embed'}
        onclick={() => update({ sourceType: 'embed' })}
      >
        <Link size={12} strokeWidth={1.75} />
        {t('video.sourceEmbed')}
      </button>
    </div>

    {#if settings.sourceType === 'file'}
      <button class="pick-btn" onclick={pickLocalVideo}>
        <Upload size={14} strokeWidth={1.75} />
        {t('video.pickFile')}
      </button>
      {#if element.content}
        <div class="file-info">
          <Video size={12} strokeWidth={1.75} />
          <span class="file-name">{fileNameFromAssetUrl(element.content)}</span>
          {#if duration > 0}
            <span class="duration">{formatDuration(duration)}</span>
          {/if}
        </div>
      {/if}
      {:else}
        <div class="row">
          <span class="panel-lbl">{t('video.embedUrl')}</span>
          <input
            type="text"
            bind:value={embedUrlInput}
            placeholder="https://www.youtube.com/embed/..."
            onkeydown={(e) => e.key === 'Enter' && applyEmbedUrl()}
          />
          <p class="hint">{t('video.embedHint')}</p>
          <div class="embed-actions">
            <button class="ghost" onclick={applyEmbedUrl}>
              {t('common.apply')}
            </button>
          </div>
          {#if embedError}
            <p class="err">{embedError}</p>
          {/if}
          {#if settings.embedProvider}
            <p class="hint">
              {t('video.providerDetected')}: <strong>{settings.embedProvider}</strong>
            </p>
          {/if}
        </div>
      {/if}
  </div>

  <!-- Флаги воспроизведения -->
  <div class="block">
    <Checkbox
      checked={settings.autoplay}
      label={t('video.autoplay')}
      onchange={(v) => { update({ autoplay: v }); commit(); }}
    />
    <Checkbox
      checked={settings.loop}
      label={t('video.loop')}
      onchange={(v) => { update({ loop: v }); commit(); }}
    />
    <Checkbox
      checked={settings.muted}
      label={t('video.muted')}
      onchange={(v) => { update({ muted: v }); commit(); }}
    />
    <Checkbox
      checked={settings.controls}
      label={t('video.controls')}
      onchange={(v) => { update({ controls: v }); commit(); }}
    />
    <Checkbox
      checked={settings.playOnClick}
      label={t('video.playOnClick')}
      onchange={(v) => { update({ playOnClick: v }); commit(); }}
    />
    <Checkbox
      checked={settings.stopOnSlideLeave}
      label={t('video.stopOnSlideLeave')}
      onchange={(v) => { update({ stopOnSlideLeave: v }); commit(); }}
    />
  </div>

  <!-- Громкость -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('video.volume')}</span>
      <Slider
        value={Math.round(settings.volume * 100)}
        min={0} max={100}
        suffix="%"
        oninput={(v) => update({ volume: v / 100 })}
        onchange={commit}
      />
    </div>
  </div>

  <!-- Диапазон (только для локальных файлов) -->
  {#if settings.sourceType === 'file' && duration > 0}
    <div class="block">
      <div class="row">
        <span class="panel-lbl">{t('video.range')}</span>
        <RangeSlider
          value={rangeValue}
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.1}
          formatValue={(v) => formatDuration(v)}
          onchange={onRangeChange}
        />
      </div>
      <div class="row">
        <span class="panel-lbl">{t('video.startTime')}</span>
        <InputNumber
          value={Math.round(settings.startTime * 10) / 10}
          min={0} max={Math.max(duration, 0)}
          step={0.1} precision={1} suffix="с"
          onchange={(v) => { update({ startTime: v }); commit(); }}
        />
      </div>
      <div class="row">
        <span class="panel-lbl">{t('video.endTime')}</span>
        <InputNumber
          value={Math.round(settings.endTime * 10) / 10}
          min={0} max={Math.max(duration, 0)}
          step={0.1} precision={1} suffix="с"
          onchange={(v) => { update({ endTime: v }); commit(); }}
        />
      </div>
    </div>
  {/if}

  <!-- Вид плеера (только для локальных файлов) -->
  {#if settings.sourceType === 'file'}
    <div class="block">
      <div class="row">
        <span class="panel-lbl">{t('video.playerStyle')}</span>
        <Select
          value={settings.playerStyle}
          options={[
            { value: 'minimal', label: t('video.style.minimal') },
            { value: 'compact', label: t('video.style.compact') },
            { value: 'full',    label: t('video.style.full') }
          ]}
          onchange={(v) => { update({ playerStyle: v as VideoSettings['playerStyle'] }); commit(); }}
        />
      </div>
    </div>
  {/if}

  <div class="actions">
    <button class="ghost" onclick={reset}>
      <RotateCcw size={14} strokeWidth={1.75} />
      {t('common.reset')}
    </button>
  </div>
</div>

<style>
  .video-panel {
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

  .source-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .source-tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    font-size: 12px;
    background: transparent;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .source-tabs button.active {
    background: var(--accent-primary);
    color: #fff;
  }

  .pick-btn {
    width: 100%;
    justify-content: center;
    font-size: 12px;
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

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .err {
    font-size: 11px;
    color: var(--danger);
    margin: 0;
  }

  .embed-actions {
    display: flex;
    gap: 6px;
  }

  .embed-actions button {
    flex: 1;
    justify-content: center;
    font-size: 12px;
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
