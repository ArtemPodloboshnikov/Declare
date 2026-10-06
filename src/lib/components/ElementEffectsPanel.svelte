<script lang="ts">
  import { t } from '$lib/i18n';
  import { presentation, type SlideElement, type ElementEffects, type ElementTransform } from '$lib/stores/presentation.svelte';
  import Slider from './Slider.svelte';
  import Select from './Select.svelte';
  import Checkbox from './Checkbox.svelte';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Move3d from '@lucide/svelte/icons/move-3d';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import FlipVertical from '@lucide/svelte/icons/flip-vertical-2';
  import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
  import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
  import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
  import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
  import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
  import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
  import { hexToRgba } from '$lib/services/common';
  import InputNumber from './InputNumber.svelte';
  import { CANVAS_H, CANVAS_W } from '$lib/stores/app.svelte';

  let { element }: { element: SlideElement } = $props();

  const effects = $derived(element.effects ?? {});
  const transform = $derived(element.transform ?? {});

  function updateEffects(patch: Partial<ElementEffects>) {
    presentation.updateElement(element.id, {
      effects: { ...effects, ...patch }
    }, true);
  }

  function updateTransform(patch: Partial<ElementTransform>) {
    presentation.updateElement(element.id, {
      transform: { ...transform, ...patch }
    }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  // ---------- Выравнивание ----------
  type AlignH = 'left' | 'center' | 'right';
  type AlignV = 'top' | 'middle' | 'bottom';

  function align(
    axis: 'h' | 'v',
    pos: AlignH | AlignV,
    otherElement: SlideElement | null = null
  ) {
    const el = element.position;
    let x = el.x;
    let y = el.y;

    // Опорный прямоугольник: канвас или другой элемент
    const ref = otherElement
      ? otherElement.position
      : { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H };

    if (axis === 'h') {
      if (pos === 'left') x = ref.x;
      else if (pos === 'center') x = ref.x + Math.round((ref.width - el.width) / 2);
      else if (pos === 'right') x = ref.x + ref.width - el.width;
    } else {
      if (pos === 'top') y = ref.y;
      else if (pos === 'middle') y = ref.y + Math.round((ref.height - el.height) / 2);
      else if (pos === 'bottom') y = ref.y + ref.height - el.height;
    }

    presentation.updateElement(element.id, {
      position: { ...el, x, y }
    });
    commit();
  }

  // ---------- Выравнивание относительно другого объекта ----------
  const otherElement = $derived.by<SlideElement | null>(() => {
    const slide = presentation.currentSlide;
    if (!slide) return null;
    const otherId = presentation.selectedElementIds.find(id => id !== element.id);
    if (!otherId) return null;
    return slide.elements.find(e => e.id === otherId) ?? null;
  });

  function hexOnly(color: string): string {
    if (color.startsWith('#')) return color.slice(0, 7);
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    const r = parseInt(m[1]).toString(16).padStart(2, '0');
    const g = parseInt(m[2]).toString(16).padStart(2, '0');
    const b = parseInt(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  /**
   * Извлекает alpha из строки цвета.
   * Поддерживает #rrggbbaa, rgba(...), hsla(...).
   */
  function alphaOf(color: string | undefined): number {
    if (!color) return 1;
    const v = color.trim();

    // #rrggbbaa
    if (v.startsWith('#') && v.length === 9) {
      const a = parseInt(v.slice(7, 9), 16);
      return isNaN(a) ? 1 : a / 255;
    }

    // rgba(...) / hsla(...)
    const m = v.match(/(?:rgba|hsla)\(\s*[\d.%]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+\s*,\s*([\d.]+)\s*\)/i);
    if (m) {
      const a = parseFloat(m[1]);
      return isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    }

    return 1;
  }
</script>

<div class="effects-panel">
  {#if element.type !== "audio" && element.type !== "video"}
  <!-- ========== Эффекты ========== -->
  <header class="panel-subheader">
    <Sparkles size={14} strokeWidth={1.75} />
    <span>{t('effects.title')}</span>
  </header>

  <!-- Внешняя тень -->
  <div class="block">
    <Checkbox
      checked={effects.dropShadow?.enabled ?? false}
      label={t('effects.dropShadow')}
      onchange={(v) => {
        updateEffects({
          dropShadow: {
            x: effects.dropShadow?.x ?? 0,
            y: effects.dropShadow?.y ?? 4,
            blur: effects.dropShadow?.blur ?? 12,
            spread: effects.dropShadow?.spread ?? 0,
            color: effects.dropShadow?.color ?? 'rgba(0,0,0,0.5)',
            enabled: v
          }
        });
        commit();
      }}
    />
    {#if effects.dropShadow?.enabled}
      {@const drop = effects.dropShadow}
      <div class="grid-2">
        <label class="mini">
          <span>X</span>
          <Slider
            value={effects.dropShadow.x}
            min={-50} max={50}
            oninput={(v) => updateEffects({ dropShadow: { ...effects.dropShadow!, x: v } })}
            onchange={commit}
          />
        </label>
        <label class="mini">
          <span>Y</span>
          <Slider
            value={effects.dropShadow.y}
            min={-50} max={50}
            oninput={(v) => updateEffects({ dropShadow: { ...effects.dropShadow!, y: v } })}
            onchange={commit}
          />
        </label>
        <label class="mini">
          <span>Blur</span>
          <Slider
            value={effects.dropShadow.blur}
            min={0} max={100}
            oninput={(v) => updateEffects({ dropShadow: { ...effects.dropShadow!, blur: v } })}
            onchange={commit}
          />
        </label>
        <label class="mini">
          <span>Spread</span>
          <Slider
            value={effects.dropShadow.spread}
            min={-50} max={50}
            oninput={(v) => updateEffects({ dropShadow: { ...effects.dropShadow!, spread: v } })}
            onchange={commit}
          />
        </label>
      </div>
      <input
        type="color"
        class="color-input"
        value={hexOnly(drop.color)}
        oninput={(e) => updateEffects({ dropShadow: { ...drop, color: (e.currentTarget as HTMLInputElement).value } })}
        onchange={commit}
      />
      <Slider
        value={alphaOf(drop.color)}
        min={0}
        max={1}
        step={0.05}
        oninput={(v) => {
          const hex = hexOnly(drop.color);
          updateEffects({
            dropShadow: { ...drop, color: hexToRgba(hex, v) }
          });
        }}
        onchange={commit}
      />
    {/if}
  </div>

  <!-- Внутренняя тень -->
  <div class="block">
    <Checkbox
      checked={effects.innerShadow?.enabled ?? false}
      label={t('effects.innerShadow')}
      onchange={(v) => {
        updateEffects({
          innerShadow: {
            x: effects.innerShadow?.x ?? 0,
            y: effects.innerShadow?.y ?? 4,
            blur: effects.innerShadow?.blur ?? 12,
            spread: effects.innerShadow?.spread ?? 0,
            color: effects.innerShadow?.color ?? 'rgba(0,0,0,0.5)',
            enabled: v
          }
        });
        commit();
      }}
    />
    {#if effects.innerShadow?.enabled}
      {@const inner = effects.innerShadow}
      <div class="grid-2">
        <label class="mini"><span>X</span>
          <Slider value={effects.innerShadow.x} min={-50} max={50}
            oninput={(v) => updateEffects({ innerShadow: { ...effects.innerShadow!, x: v } })}
            onchange={commit} />
        </label>
        <label class="mini"><span>Y</span>
          <Slider value={effects.innerShadow.y} min={-50} max={50}
            oninput={(v) => updateEffects({ innerShadow: { ...effects.innerShadow!, y: v } })}
            onchange={commit} />
        </label>
        <label class="mini"><span>Blur</span>
          <Slider value={effects.innerShadow.blur} min={0} max={100}
            oninput={(v) => updateEffects({ innerShadow: { ...effects.innerShadow!, blur: v } })}
            onchange={commit} />
        </label>
        <label class="mini"><span>Spread</span>
          <Slider value={effects.innerShadow.spread} min={-50} max={50}
            oninput={(v) => updateEffects({ innerShadow: { ...effects.innerShadow!, spread: v } })}
            onchange={commit} />
        </label>
      </div>
      <input
        type="color"
        class="color-input"
        value={hexOnly(inner.color)}
        oninput={(e) => updateEffects({
          innerShadow: { ...inner, color: (e.currentTarget as HTMLInputElement).value }
        })}
        onchange={commit}
      />
      <Slider
        value={alphaOf(inner.color)}
        min={0}
        max={1}
        step={0.05}
        oninput={(v) => {
          const hex = hexOnly(inner.color);
          updateEffects({
            innerShadow: { ...inner, color: hexToRgba(hex, v) }
          });
        }}
        onchange={commit}
      />
    {/if}
  </div>

  <!-- Размытие -->
  <div class="block">
    <Checkbox
      checked={effects.blur?.enabled ?? false}
      label={t('effects.blur')}
      onchange={(v) => {
        updateEffects({ blur: { radius: effects.blur?.radius ?? 5, enabled: v } });
        commit();
      }}
    />
    {#if effects.blur?.enabled}
      <Slider
        value={effects.blur.radius}
        min={0} max={50}
        oninput={(v) => updateEffects({ blur: { ...effects.blur!, radius: v } })}
        onchange={commit}
      />
    {/if}
  </div>

  <!-- Размытие фона -->
  <div class="block">
    <Checkbox
      checked={effects.backdropBlur?.enabled ?? false}
      label={t('effects.backdropBlur')}
      onchange={(v) => {
        updateEffects({ backdropBlur: { radius: effects.backdropBlur?.radius ?? 12, enabled: v } });
        commit();
      }}
    />
    {#if effects.backdropBlur?.enabled}
      <Slider
        value={effects.backdropBlur.radius}
        min={0} max={50}
        oninput={(v) => updateEffects({ backdropBlur: { ...effects.backdropBlur!, radius: v } })}
        onchange={commit}
      />
    {/if}
  </div>
  <!-- ========== Трансформации ========== -->
  <header class="panel-subheader">
    <Move3d size={14} strokeWidth={1.75} />
    <span>{t('transform.title')}</span>
  </header>

  <!-- Обводка -->
  <div class="row">
    <span class="panel-lbl">{t('transform.outline')}</span>
    <div class="outline-row">
      <input type="color"
        value={transform.outlineColor ?? '#7c6cf0'}
        oninput={(e) => updateTransform({ outlineColor: (e.currentTarget as HTMLInputElement).value })}
        onchange={commit} />
      <Slider
        value={transform.outlineWidth ?? 0}
        min={0} max={20} step={1} suffix="px"
        oninput={(v) => updateTransform({ outlineWidth: v })}
        onchange={commit}
      />
    </div>
  </div>

  <!-- Скругление -->
  <div class="row">
    <span class="panel-lbl">{t('transform.borderRadius')}</span>
    <Slider
      value={transform.borderRadius ?? 0}
      min={0} max={200} step={1} suffix="px"
      oninput={(v) => updateTransform({ borderRadius: v })}
      onchange={commit}
    />
  </div>

  <!-- Сглаживание углов (squircle) -->
  <div class="row">
    <span class="panel-lbl">{t('transform.cornerSmoothing')}</span>
    <Slider
      value={transform.cornerSmoothing ?? 0}
      min={0} max={100} step={1} suffix="%"
      oninput={(v) => updateTransform({ cornerSmoothing: v })}
      onchange={commit}
    />
    <p class="hint">{t('transform.cornerSmoothingHint')}</p>
  </div>

  <!-- Прозрачность -->
  <div class="row">
    <span class="panel-lbl">{t('transform.opacity')}</span>
    <Slider
      value={Math.round((transform.opacity ?? 1) * 100)}
      min={0} max={100} suffix="%"
      oninput={(v) => updateTransform({ opacity: v / 100 })}
      onchange={commit}
    />
  </div>

  <!-- Режим наложения -->
  <div class="row">
    <span class="panel-lbl">{t('transform.blendMode')}</span>
    <Select
      value={transform.blendMode ?? 'normal'}
      options={[
        { value: 'normal', label: t('blend.normal') },
        { value: 'multiply', label: t('blend.multiply') },
        { value: 'screen', label: t('blend.screen') },
        { value: 'overlay', label: t('blend.overlay') },
        { value: 'darken', label: t('blend.darken') },
        { value: 'lighten', label: t('blend.lighten') },
        { value: 'color-dodge', label: t('blend.colorDodge') },
        { value: 'color-burn', label: t('blend.colorBurn') },
        { value: 'hard-light', label: t('blend.hardLight') },
        { value: 'soft-light', label: t('blend.softLight') },
        { value: 'difference', label: t('blend.difference') },
        { value: 'exclusion', label: t('blend.exclusion') }
      ]}
      onchange={(v) => { updateTransform({ blendMode: v as any }); commit(); }}
    />
  </div>
  {/if}

  {#if element.type === "audio" || element.type === "video"}
      <header class="panel-subheader">
        <Move3d size={14} strokeWidth={1.75} />
        <span>{t('transform.title')}</span>
      </header>
  {/if}
  <!-- Вращение -->
  <div class="row">
    <span class="panel-lbl">{t('transform.rotation')}</span>
    <Slider
    value={transform.rotation ?? 0}
    min={-180} max={180} suffix="°"
    oninput={(v) => updateTransform({ rotation: v })}
    onchange={commit}
    />
    <InputNumber
    value={transform.rotation ?? 0}
    min={-180} max={180} suffix="°"
    onchange={(v) => { updateTransform({ rotation: v }); commit()}}
    />
  </div>

  <!-- Отражение -->
  <div class="row">
    <span class="panel-lbl">{t('transform.flip')}</span>
    <div class="flip-row">
      <button
        class:active={transform.flipX}
        onclick={() => { updateTransform({ flipX: !transform.flipX }); commit(); }}
        title={t('transform.flipH')}
      >
          <FlipVertical size={14} strokeWidth={1.75} />
      </button>
      <button
        class:active={transform.flipY}
        onclick={() => { updateTransform({ flipY: !transform.flipY }); commit(); }}
        title={t('transform.flipV')}
      >
        <FlipHorizontal size={14} strokeWidth={1.75} />
      </button>
    </div>
  </div>

  <!-- ========== Выравнивание ========== -->
  <header class="panel-subheader">
    <AlignCenterVertical size={14} strokeWidth={1.75} />
    <span>{t('align.title')}</span>
  </header>

    <div class="align-row">
      <button onclick={() => align('h', 'left', otherElement)} title={t('align.left')}><AlignStartVertical size={14} /></button>
      <button onclick={() => align('h', 'center', otherElement)} title={t('align.center')}><AlignCenterVertical size={14} /></button>
      <button onclick={() => align('h', 'right', otherElement)} title={t('align.right')}><AlignEndVertical size={14} /></button>
      <button onclick={() => align('v', 'top', otherElement)} title={t('align.top')}><AlignStartHorizontal size={14} /></button>
      <button onclick={() => align('v', 'middle', otherElement)} title={t('align.middle')}><AlignCenterHorizontal size={14} /></button>
      <button onclick={() => align('v', 'bottom', otherElement)} title={t('align.bottom')}><AlignEndHorizontal size={14} /></button>
    </div>
</div>

<style>
  .effects-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .row { display: flex; flex-direction: column; gap: 4px; }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .mini {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mini span {
    font-size: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .outline-row {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 6px;
    align-items: center;
  }
  .outline-row input[type="color"] {
    width: 40px;
    height: 28px;
    padding: 1px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
    cursor: pointer;
  }

  .flip-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .flip-row button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .flip-row button.active {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: #fff;
  }

  .align-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 3px;
  }
  .align-row button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .align-row button:hover {
    background: var(--bg-hover);
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }
</style>
