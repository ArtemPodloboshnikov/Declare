<script lang="ts">
  import { t } from '$lib/i18n';
  import { presentation, type SlideBackgroundType } from '$lib/stores/presentation.svelte';
  import { BACKGROUND_PRESETS } from '$lib/services/slide-backgrounds';
  import { pickFile, MEDIA_ACCEPT } from '$lib/services/file-import';
  import Image from '@lucide/svelte/icons/image';
  import Palette from '@lucide/svelte/icons/palette';
  import Layers from '@lucide/svelte/icons/layers';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Upload from '@lucide/svelte/icons/upload';

  const bg = $derived(presentation.currentSlide?.background);

  function setType(type: SlideBackgroundType) {
    const slide = presentation.currentSlide;
    if (!slide) return;

    if (type === 'preset') {
      slide.background = {
        type: 'preset',
        presetId: bg?.presetId ?? 'dark-solid'
      };
    } else if (type === 'color') {
      slide.background = {
        type: 'color',
        color: bg?.color ?? '#0f0f14'
      };
    } else if (type === 'image') {
      slide.background = {
        type: 'image',
        imageUrl: bg?.imageUrl,
        imageFit: bg?.imageFit ?? 'cover'
      };
    }
  }

  function selectPreset(presetId: string) {
    const slide = presentation.currentSlide;
    if (!slide) return;
    slide.background = { type: 'preset', presetId };
  }

  function setColor(color: string) {
    const slide = presentation.currentSlide;
    if (!slide) return;
    slide.background = { type: 'color', color };
  }

  function setFit(fit: 'cover' | 'contain' | 'repeat') {
    const slide = presentation.currentSlide;
    if (!slide || slide.background?.type !== 'image') return;
    slide.background = { ...slide.background, imageFit: fit };
  }

  async function pickImage() {
    const file = await pickFile(MEDIA_ACCEPT.image);
    if (!file) return;
    const slide = presentation.currentSlide;
    if (!slide) return;
    slide.background = {
      type: 'image',
      imageUrl: file.blobUrl,
      imageFit: 'cover'
    };
  }

  function clearImage() {
    const slide = presentation.currentSlide;
    if (!slide) return;
    slide.background = { type: 'preset', presetId: 'dark-solid' };
  }
</script>

<div class="bg-panel">
  <header class="panel-subheader">
    <Layers size={14} strokeWidth={1.75} />
    <span>{t('bg.title')}</span>
  </header>

  <div class="type-tabs">
    <button
      class:active={bg?.type === 'preset'}
      onclick={() => setType('preset')}
    >
      <Palette size={12} strokeWidth={1.75} />
      {t('bg.preset')}
    </button>
    <button
      class:active={bg?.type === 'color'}
      onclick={() => setType('color')}
    >
      <span class="color-dot" style="background: {bg?.type === 'color' ? bg.color : '#888'}"></span>
      {t('bg.color')}
    </button>
    <button
      class:active={bg?.type === 'image'}
      onclick={() => setType('image')}
    >
      <Image size={12} strokeWidth={1.75} />
      {t('bg.image')}
    </button>
  </div>

  {#if bg?.type === 'preset'}
    <div class="preset-grid">
      {#each BACKGROUND_PRESETS as p (p.id)}
        <button
          type="button"
          class="preset-btn"
          class:active={bg.presetId === p.id}
          style="background: {p.css}; background-size: cover;"
          onclick={() => selectPreset(p.id)}
          title={t(p.labelKey)}
          aria-label={t(p.labelKey)}
        ></button>
      {/each}
    </div>
  {/if}

  {#if bg?.type === 'color'}
    <div class="color-row">
      <input
        type="color"
        class="color-input"
        value={bg.color ?? '#0f0f14'}
        oninput={(e) => setColor((e.currentTarget as HTMLInputElement).value)}
      />
      <input
        type="text"
        class="color-text"
        value={bg.color ?? '#0f0f14'}
        oninput={(e) => setColor((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  {/if}

  {#if bg?.type === 'image'}
    {#if bg.imageUrl}
      <div class="image-preview" style="background-image: url('{bg.imageUrl}')">
        <button
          class="icon-btn clear"
          onclick={clearImage}
          title={t('bg.removeImage')}
          aria-label={t('bg.removeImage')}
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div class="row">
        <span class="panel-lbl">{t('bg.imageFit')}</span>
        <div class="fit-row">
          {#each [
            { value: 'cover', labelKey: 'bg.fitCover' },
            { value: 'contain', labelKey: 'bg.fitContain' },
            { value: 'repeat', labelKey: 'bg.fitRepeat' }
          ] as opt (opt.value)}
            <button
              type="button"
              class:active={bg.imageFit === opt.value}
              onclick={() => setFit(opt.value as 'cover' | 'contain' | 'repeat')}
            >{t(opt.labelKey)}</button>
          {/each}
        </div>
      </div>
    {:else}
      <button class="primary upload-btn" onclick={pickImage}>
        <Upload size={14} strokeWidth={1.75} />
        {t('bg.pickImage')}
      </button>
    {/if}
  {/if}
</div>

<style>
  .bg-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .type-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .type-tabs button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    font-size: 11px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: calc(var(--radius-md) - 2px);
    cursor: pointer;
  }
  .type-tabs button.active {
    background: var(--accent-primary);
    color: #fff;
  }

  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: inline-block;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .preset-btn {
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border-subtle);
    cursor: pointer;
    padding: 0;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .preset-btn:hover {
    border-color: var(--border-strong);
    transform: scale(1.05);
  }
  .preset-btn.active {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }

  .color-row {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 6px;
  }
  .color-input {
    width: 40px;
    height: 34px;
    padding: 2px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    cursor: pointer;
  }
  .color-text {
    height: 34px;
    padding: 7px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
  }

  .image-preview {
    width: 100%;
    aspect-ratio: 16 / 9;
    background-size: cover;
    background-position: center;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    position: relative;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    cursor: pointer;
  }
  .clear {
    position: absolute;
    top: 6px;
    right: 6px;
  }
  .clear:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fit-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .fit-row button {
    padding: 6px 4px;
    font-size: 11px;
    justify-content: center;
  }
  .fit-row button.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }

  .upload-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
  }
</style>
