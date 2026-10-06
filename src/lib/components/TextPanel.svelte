<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { fonts } from '$lib/services/fonts.svelte';
  import { rgbToHex } from '$lib/services/common';
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';
  import InputNumber from './InputNumber.svelte';
  import Select from './Select.svelte';

  import AlignLeft from '@lucide/svelte/icons/align-left';
  import AlignCenter from '@lucide/svelte/icons/align-center';
  import AlignRight from '@lucide/svelte/icons/align-right';
  import AlignJustify from '@lucide/svelte/icons/align-justify';

  let {
    element
  }: {
    element: SlideElement;
  } = $props();

  onMount(() => fonts.load());

  const style = $derived(element.style ?? {});

  // Локальные буферы для полей ввода
  let sizeInput = $state(24);
  let colorInput = $state('#e8e8f0');

  // Синхронизация при смене выбранного элемента
  let lastElementId = $state<string | null>(null);
  $effect(() => {
    if (element.id !== lastElementId) {
      lastElementId = element.id;
      sizeInput = Number(style.fontSize?.replace("px", "")) ?? 24;
      colorInput = String(style.color ? (rgbToHex(style.color) ?? '#e8e8f0') : '#e8e8f0');
    }
  });

  const currentFamily = $derived(String(style.fontFamily ?? ''));
  const currentStyleName = $derived(String(style.fontStyleName ?? 'Regular'));
  const currentAlign = $derived(String(style.textAlign ?? 'left'));

  const fontOptions = $derived([
    { value: '', label: t('text.defaultFont') },
    ...fonts.families.map(f => ({
      value: f.name,
      label: f.name,
      style: `font-family: '${f.name}', sans-serif`
    }))
  ]);

  const styleOptions = $derived.by(() => {
    const fam = fonts.families.find(f => f.name === currentFamily);
    const styles = fam?.styles ?? ['Regular'];
    return styles.map(s => ({ value: s, label: s }));
  });

  function updateStyle(patch: Record<string, unknown>) {
    presentation.updateElement(element.id, {
      style: { ...style, ...patch }
    });
  }

  function onFamilyChange(name: string) {
    const fam = fonts.families.find(f => f.name === name);
    const defaultStyle = fam?.styles[0] ?? 'Regular';
    const { weight, fontStyle } = styleToCss(defaultStyle);
    updateStyle({
      fontFamily: name,
      fontStyleName: defaultStyle,
      fontWeight: weight,
      fontStyle
    });
  }

  function onStyleChange(styleName: string) {
    const { weight, fontStyle } = styleToCss(styleName);
    updateStyle({
      fontStyleName: styleName,
      fontWeight: weight,
      fontStyle
    });
  }

  function styleToCss(styleName: string): { weight: string; fontStyle: string } {
    const lower = styleName.toLowerCase();
    let weight = '400';
    if (lower.includes('thin')) weight = '100';
    else if (lower.includes('extralight') || lower.includes('extra light')) weight = '200';
    else if (lower.includes('light')) weight = '300';
    else if (lower.includes('medium')) weight = '500';
    else if (lower.includes('semibold') || lower.includes('semi bold')) weight = '600';
    else if (lower.includes('extrabold') || lower.includes('extra bold')) weight = '800';
    else if (lower.includes('black')) weight = '900';
    else if (lower.includes('bold')) weight = '700';

    const fontStyle = lower.includes('italic') ? 'italic'
      : lower.includes('oblique') ? 'oblique'
      : 'normal';

    return { weight, fontStyle };
  }

  // ---------- Размер шрифта ----------
  const MIN_SIZE = 6;
  const MAX_SIZE = 400;

  // ---------- Цвет ----------
  function commitColor(value: string) {
    colorInput = value;
    updateStyle({ color: value });
  }

  // Backspace/Delete внутри input не должны доходить до глобального обработчика.
  // В Viewport.onKeyDown уже есть проверка inField, но добавим и здесь для надёжности.
  function stopPropagation(e: KeyboardEvent) {
    e.stopPropagation();
  }
</script>

<div class="text-style-panel">
  <div class="panel-row">
    <label class="panel-lbl" for="ts-font">{t('text.font')}</label>
    {#if fonts.loading}
      <span class="muted">{t('text.loadingFonts')}</span>
    {:else if fonts.error}
      <span class="err">{fonts.error}</span>
    {:else}
      <Select
        value={currentFamily as any}
        options={fontOptions}
        onchange={(v) => onFamilyChange(v)}
      />
    {/if}
  </div>

  <div class="panel-row">
    <label class="panel-lbl" for="ts-style">{t('text.style')}</label>
    <Select
      value={currentStyleName}
      options={styleOptions}
      onchange={(v) => onStyleChange(v)}
    />
  </div>

  <div class="panel-row">
    <label class="panel-lbl" for="ts-size">{t('text.size')}</label>
    <InputNumber
    bind:value={sizeInput}
    onchange={(val)=>updateStyle({ fontSize: `${val}px` })}
    min={MIN_SIZE}
    max={MAX_SIZE}
    suffix="px"
    />
  </div>

  <div class="panel-row">
    <label class="panel-lbl" for="ts-color">{t('text.color')}</label>
    <div class="color-control">
      <input
        id="ts-color"
        type="color"
        value={colorInput}
        oninput={(e) => commitColor((e.currentTarget as HTMLInputElement).value)}
        onkeydown={stopPropagation}
      />
      <input
        type="text"
        class="color-text"
        value={colorInput}
        oninput={(e) => commitColor((e.currentTarget as HTMLInputElement).value)}
        onkeydown={stopPropagation}
      />
    </div>
  </div>

  <div class="panel-row">
    <div class="panel-lbl">{t('text.align')}</div>
    <div class="align-group">
      {#each [
        { v: 'left',    Icon: AlignLeft,    title: 'text.alignLeft' },
        { v: 'center',  Icon: AlignCenter,  title: 'text.alignCenter' },
        { v: 'right',   Icon: AlignRight,   title: 'text.alignRight' },
        { v: 'justify', Icon: AlignJustify, title: 'text.alignJustify' }
      ] as opt (opt.v)}
        <button
          type="button"
          class:active={currentAlign === opt.v}
          onclick={() => updateStyle({ textAlign: opt.v })}
          title={t(opt.title)}
          aria-label={t(opt.title)}
        >
          <opt.Icon size={15} strokeWidth={1.75} />
        </button>
      {/each}
    </div>
  </div>

  <div class="panel-row preview">
    <span class="panel-lbl">{t('text.preview')}</span>
    <div
      class="preview-box"
      style:font-family={currentFamily ? `'${currentFamily}'` : 'inherit'}
      style:font-weight={String(style.fontWeight ?? '400')}
      style:font-style={String(style.fontStyle ?? 'normal')}
      style:font-size={`${sizeInput || 24}px`}
      style:text-align={currentAlign}
    >
      Abc 123
    </div>
  </div>
</div>

<style>
  .text-style-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .muted { font-size: 12px; color: var(--text-muted); }
  .err { font-size: 12px; color: var(--danger); }

  /* ---------- Цвет ---------- */
  .color-control {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 6px;
  }
  .color-control input[type="color"] {
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

  /* ---------- Выравнивание ---------- */
  .align-group {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .align-group button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    height: 34px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  }
  .align-group button:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
  .align-group button.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }

  /* ---------- Превью ---------- */
  .preview-box {
    padding: 10px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    min-height: 44px;
    overflow: hidden;
    line-height: 1.2;
    color: var(--text-primary);
  }
</style>
