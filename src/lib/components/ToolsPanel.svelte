<script lang="ts">
  import { t } from '$lib/i18n';
  import { app } from '$lib/stores/app.svelte';
  import { presentation, type ShapeKind, type SlideElement, type SlideElementType } from '$lib/stores/presentation.svelte';
  import { pickFile, MEDIA_ACCEPT } from '$lib/services/file-import';
  import { getShapePath } from '$lib/services/shapes';
  import TableEditorModal from './TableEditorModal.svelte';
  import ChartEditorModal from './ChartEditorModal.svelte';
  import TextPanel from './TextPanel.svelte';
  import ExportSettings from './ExportSettings.svelte';
  import {
    TRANSITION_DURATION_MAX,
    TRANSITION_DURATION_MIN,
    TRANSITION_DURATION_STEP,
    TRANSITIONS
  } from '$lib/services/transitions';
  import Select from './Select.svelte';
  import InputNumber from './InputNumber.svelte';
  import ShapePickerModal from './ShapePickerModal.svelte';
  import ShapePanel from './ShapePanel.svelte';
  import ChartPanel from './ChartPanel.svelte';
  import ElementEffectsPanel from './ElementEffectsPanel.svelte';
  import SlideBackgroundPanel from './SlideBackgroundPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import AnimatePanel from './AnimatePanel.svelte';
  import AudioPanel from './AudioPanel.svelte';
  import TablePanel from './TablePanel.svelte';
  import VideoPanel from './VideoPanel.svelte';

  import Type from '@lucide/svelte/icons/type';
  import Image from '@lucide/svelte/icons/image';
  import Music from '@lucide/svelte/icons/music';
  import Video from '@lucide/svelte/icons/video';
  import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
  import Table2 from '@lucide/svelte/icons/table-2';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import Shapes from '@lucide/svelte/icons/shapes';
  import SquaresUnite from '@lucide/svelte/icons/squares-unite';
  import SquaresSubtract from '@lucide/svelte/icons/squares-subtract';
  import SquaresIntersect from '@lucide/svelte/icons/squares-intersect';
  import SquaresExclude from '@lucide/svelte/icons/squares-exclude';
  import Scissors from '@lucide/svelte/icons/scissors';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import * as pc from 'polygon-clipping';
  import { pathWithTransformToRings, ringsToPath } from '$lib/services/path-utils';


  const tools = [
    { type: 'text',  Icon: Type,        labelKey: 'tools.text' },
    { type: 'image', Icon: Image,       labelKey: 'tools.image' },
    { type: 'audio', Icon: Music,       labelKey: 'tools.audio' },
    { type: 'video', Icon: Video,       labelKey: 'tools.video' },
    { type: 'chart', Icon: BarChart3,   labelKey: 'tools.chart' },
    { type: 'table', Icon: Table2,      labelKey: 'tools.table' },
    { type: 'shape', Icon: Shapes,    labelKey: 'tools.shape' }
  ] as const;

  type ToolType = typeof tools[number]['type'];
  type FindElement = SlideElement | null;

  let showTable = $state(false);
  let showChart = $state(false);
  let showShape = $state(false);
  const selectedShapes = $derived.by(() => {
    const slide = presentation.currentSlide;
    if (!slide) return [];
    return slide.elements.filter(
      e => e.type === 'shape' && presentation.selectedElementIds.includes(e.id)
    );
  });
  const canBool = $derived(selectedShapes.length === 2);
  const maskTarget = $derived.by<SlideElement | null>(() => {
    const slide = presentation.currentSlide;
    if (!slide) return null;

    const targets = slide.elements.filter(
      e =>
        (e.type === 'image' || e.type === 'video') &&
        presentation.selectedElementIds.includes(e.id)
    );
    return targets.length === 1 ? targets[0] : null;
  });

  const canMask = $derived(
    selectedShapes.length === 1 && maskTarget !== null
  );

  const selectedShapeEl = $derived(
    presentation.currentSlide?.elements.find(
      e => e.id === presentation.selectedElementId && e.type === 'shape'
    ) ?? null
  );

  const getSlideAndElementId = () => {
    const slide = presentation.currentSlide;
    if (!slide) return null;
    const id = presentation.selectedElementId;
    if (!id) return null;
    return { slide, id }
  }

  const findElement = () => {
    const res = getSlideAndElementId()
    if (!res) return res;
    const { slide, id } = res;
    return slide.elements.find(e => e.id === id) ?? null;
  }

  const getElement = (type: SlideElementType) => {
    const el = findElement()
    if (el) {
      return el && el.type === type ? el : null;
    }
    return null
  }

  function baseElement(type: SlideElement['type']): SlideElement {
    return {
      id: crypto.randomUUID(),
      type,
      content: '',
      style: {},
      position: { x: 100, y: 100, width: 400, height: 240 }
    };
  }

  async function addElement(type: ToolType) {
    const el = baseElement(type);

    switch (type) {
      case 'text': {
        el.content = t('tools.textInputDefaultText');
        el.style = { color: '#e8e8f0', fontSize: '24px' };
        el.position = { x: 80, y: 80, width: 500, height: 100 };
        presentation.addElement(el);
        break;
      }

      case 'image': {
        const file = await pickFile(MEDIA_ACCEPT.image);
        if (!file) return;
        el.content = file.blobUrl;
        el.position = { x: 200, y: 140, width: 480, height: 320 };
        presentation.addElement(el);
        app.notify(t('toast.mediaAdded', { name: file.name }), 'success');
        break;
      }

      case 'audio': {
        const file = await pickFile(MEDIA_ACCEPT.audio);
        if (!file) return;
        el.content = file.blobUrl;
        el.position = { x: 200, y: 320, width: 480, height: 60 };
        presentation.addElement(el);
        app.notify(t('toast.mediaAdded', { name: file.name }), 'success');
        break;
      }

      case 'video': {
        const file = await pickFile(MEDIA_ACCEPT.video);
        if (!file) return;
        el.content = file.blobUrl;
        el.position = { x: 200, y: 120, width: 560, height: 340 };
        presentation.addElement(el);
        app.notify(t('toast.mediaAdded', { name: file.name }), 'success');
        break;
      }

      case 'table': {
        showTable = true;
        break;
      }

      case 'chart': {
        showChart = true;
        break;
      }

      case 'shape': {
        showShape = true;
        break;
      }
    }
  }

  function onTableSubmit(data: { headers: string[]; rows: string[][]; hasHeader: boolean }) {
    showTable = false;
    const el = baseElement('table');
    el.position = { x: 160, y: 120, width: 640, height: 320 };
    el.content = JSON.stringify({ headers: data.headers, rows: data.rows });
    presentation.addElement(el);
    app.notify(t('toast.tableAdded'), 'success');
  }

  function onChartSubmit(data: {
    kind: 'bar' | 'line' | 'pie' | 'doughnut';
    labels: string[];
    values: number[];
    datasetLabel: string;
  }) {
    showChart = false;
    const el = baseElement('chart');
    el.position = { x: 160, y: 120, width: 600, height: 360 };
    el.content = JSON.stringify(data);
    presentation.addElement(el);
    app.notify(t('toast.chartAdded'), 'success');
  }

  const selectedTextElement = $derived.by<SlideElement | null>(() => {
    const res = getSlideAndElementId()
    if (!res) return res;
    const { slide, id } = res;
    const el = slide.elements.find(e => e.id === id);
    return el && el.type === 'text' ? el : null;
  });

  const currentTransition = $derived(
    presentation.currentSlide?.transition ?? 'fade'
  );

  function setTransition(id: string) {
    const slide = presentation.currentSlide;
    if (slide) slide.transition = id;
  }

  const currentDuration = $derived(
    presentation.currentSlide?.transitionDuration / 1000
  );

  function setDuration(seconds: number) {
    const slide = presentation.currentSlide;
    if (!slide) return;
    slide.transitionDuration = Math.round(seconds * 1000);
  }

  function onShapePick(kind: ShapeKind) {
    showShape = false;
    const el = baseElement('shape');
    el.position = { x: 440, y: 260, width: 320, height: 320 };
    el.shape = { kind };
    el.style = { fill: '#7c6cf0', stroke: 'none', strokeWidth: 0 };
    presentation.addElement(el);
    if (kind === "line") {
      presentation.updateElement(el.id, {
        transform: { outlineWidth: 1, outlineColor: '#7c6cf0' }
      }, true);
    }
    app.notify(t('toast.shapeAdded'), 'success');
  }

  function applyBoolean(op: 'unite' | 'subtract' | 'intersect' | 'exclude') {
    if (selectedShapes.length !== 2) return;
    const [a, b] = selectedShapes;

    const localPathA = a.shape?.customPath ?? getShapePath(a.shape?.kind ?? 'rect');
    const localPathB = b.shape?.customPath ?? getShapePath(b.shape?.kind ?? 'rect');

    // Аппроксимируем ОБА пути в пиксели канваса — БЕЗ bakeTransform
    // Просто передаём путь + position, и аппроксимация сразу в canvas-координатах
    const ringsA = pathWithTransformToRings(localPathA, a.position);
    const ringsB = pathWithTransformToRings(localPathB, b.position);

    if (!ringsA.length || !ringsB.length) {
      app.notify(t('shapes.emptyResult'), 'error');
      return;
    }

    let result: [number, number][][][];
    try {
      switch (op) {
        case 'unite':     result = pc.union(ringsA, ringsB); break;
        case 'subtract':  result = pc.difference(ringsA, ringsB); break;
        case 'intersect': result = pc.intersection(ringsA, ringsB); break;
        case 'exclude':   result = pc.xor(ringsA, ringsB); break;
      }
    } catch (e) {
      app.notify(t('shapes.emptyResult'), 'error');
      return;
    }

    if (!result || result.length === 0) {
      app.notify(t('shapes.emptyResult'), 'error');
      return;
    }

    // Считаем bbox всего результата
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const polygon of result) {
      for (const ring of polygon) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) {
      app.notify(t('shapes.emptyResult'), 'error');
      return;
    }

    const kx = 100 / w;
    const ky = 100 / h;

    // Нормализация + сериализация
    const normalizedPath = ringsToPath(
      result.map(polygon =>
        polygon.map(ring =>
          ring.map(([x, y]) => [(x - minX) * kx, (y - minY) * ky] as [number, number])
        )
      )
    );

    const merged: SlideElement = {
      id: crypto.randomUUID(),
      type: 'shape',
      content: '',
      shape: { kind: 'rect', customPath: normalizedPath },
      style: { ...a.style },
      position: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(w),
        height: Math.round(h)
      }
    };

    presentation.replaceShapes([a.id, b.id], merged);
    app.notify(t('toast.shapeMerged'), 'success');
  }

  function applyMask() {
    if (selectedShapes.length !== 1 || !maskTarget) {
      app.notify(t('shapes.selectOneShapeAndTarget'), 'error');
      return;
    }
    const shape = selectedShapes[0];
    const target = maskTarget;

    presentation.updateElement(shape.id, {
      shape: { ...(shape.shape ?? { kind: 'rect' }), maskTargetId: target.id },
      position: { ...target.position }
    });

    presentation.moveElementToEnd(shape.id);
    app.notify(t('toast.maskApplied'), 'success');
  }

  function removeMask() {
    const shape = selectedShapeEl;
    if (!shape?.shape?.maskTargetId) return;
    const { maskTargetId, ...rest } = shape.shape;
    shape.shape = rest;
    app.notify(t('toast.maskRemoved'), 'info');
  }

  const selectedShapeElement = $derived.by<FindElement>(() => {
    return getElement("shape");
  });

  const selectedChartElement = $derived.by<FindElement>(() => {
    return getElement("chart");
  });

  const selectedElement = $derived.by<FindElement>(() => {
    return findElement();
  });

  const selectedAudioElement = $derived.by<FindElement>(() => {
    return getElement("audio");
  });

  const selectedVideoElement = $derived.by<SlideElement | null>(() => {
    return getElement("video");
  });

  const selectedTableElement = $derived.by<FindElement>(() => {
    return getElement("table");
  });
</script>

<div class="tools-panel">
  <header class="panel-header">
    <h3>{t('tools.title')}</h3>
  </header>

  <div class="tools-list">
    {#each tools as tool (tool.type)}
      <button
        class="tool-btn"
        onclick={() => addElement(tool.type)}
        title={t(tool.labelKey)}
      >
        <span class="icon">
          <tool.Icon size={16} strokeWidth={1.75} />
        </span>
        <span class="label">{t(tool.labelKey)}</span>
      </button>
    {/each}
  </div>

  <LayersPanel />

  {#if selectedTextElement}
    <TextPanel element={selectedTextElement} />
  {/if}

  {#if selectedChartElement}
    <ChartPanel element={selectedChartElement} />
  {/if}

  {#if selectedTableElement}
    <TablePanel element={selectedTableElement} />
  {/if}

  {#if canBool}
    <section class="section">
      <div class="panel-lbl">{t('shapes.operations')}</div>
      <div class="bool-grid">
        <button onclick={() => applyBoolean('unite')} title={t('shapes.union')}>
          <SquaresUnite size={14} strokeWidth={1.75} />
          <span>{t('shapes.union')}</span>
        </button>
        <button onclick={() => applyBoolean('subtract')} title={t('shapes.subtract')}>
          <SquaresSubtract size={14} strokeWidth={1.75} />
          <span>{t('shapes.subtract')}</span>
        </button>
        <button onclick={() => applyBoolean('intersect')} title={t('shapes.intersect')}>
          <SquaresIntersect size={14} strokeWidth={1.75} />
          <span>{t('shapes.intersect')}</span>
        </button>
        <button onclick={() => applyBoolean('exclude')} title={t('shapes.exclude')}>
          <SquaresExclude size={14} strokeWidth={1.75} />
          <span>{t('shapes.exclude')}</span>
        </button>
      </div>
    </section>
  {/if}

  {#if selectedShapeEl}
    <section class="section">
      <div class="panel-lbl">{t('shapes.mask')}</div>
      {#if selectedShapeEl.shape?.maskTargetId}
        <button class="ghost" onclick={removeMask}>
          <Scissors size={14} strokeWidth={1.75} />
          {t('shapes.removeMask')}
        </button>
      {:else}
        <button
          onclick={applyMask}
          disabled={!canMask}
          title={!canMask ? t('shapes.maskHint') : undefined}
        >
          <Scissors size={14} strokeWidth={1.75} />
          {t('shapes.applyMask')}
        </button>
      {/if}
    </section>
  {/if}

  {#if selectedShapeElement}
    <ShapePanel element={selectedShapeElement} />
  {/if}

  {#if selectedElement && selectedElement.type !== "audio"}
    <AnimatePanel element={selectedElement} />
  {/if}

  {#if selectedVideoElement}
    <VideoPanel element={selectedVideoElement} />
  {/if}

  {#if selectedElement}
    <ElementEffectsPanel element={selectedElement} />
  {/if}

  {#if selectedAudioElement}
    <AudioPanel element={selectedAudioElement} />
  {/if}

  <section class="section">
    <header class="panel-subheader">
        <SkipForward size={14} strokeWidth={1.75} />
        <div class="panel-lbl">{t('tools.transition')}</div>
    </header>
    <Select
      value={currentTransition}
      options={TRANSITIONS.map(td => ({ value: td.id, label: t(td.labelKey) }))}
      onchange={setTransition}
    />

    <div class="panel-lbl duration-label">{t('tools.transitionDuration')}</div>
    <InputNumber
      value={currentDuration}
      min={TRANSITION_DURATION_MIN}
      max={TRANSITION_DURATION_MAX}
      step={TRANSITION_DURATION_STEP}
      precision={1}
      onchange={setDuration}
    />
  </section>

  <SlideBackgroundPanel />

  <ExportSettings />

  <section class="tips">
    <div class="tips-title">
      <Lightbulb size={12} strokeWidth={1.75} />
      {t('tools.tips')}
    </div>
    <ul class="tips-list">
      <li><kbd>F5</kbd> — {t('shortcuts.preview')}</li>
      <li><kbd>Shift</kbd> + <kbd>F5</kbd> — {t('shortcuts.previewCurrent')}</li>
      <li><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> — {t('shortcuts.nudge')}</li>
      <li><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> — {t('shortcuts.nudgeFast')}</li>
      <li><kbd>Shift</kbd> + <kbd>{t('shortcuts.drag')}</kbd> — {t('shortcuts.dragAxis')}</li>
      <li><kbd>Shift</kbd> + <kbd> {t('shortcuts.resize')}</kbd> — {t('shortcuts.resizeProportional')}</li>
      <li><kbd>Shift</kbd> + <kbd>{t('shortcuts.rotate')}</kbd> — {t('shortcuts.rotateSnap')}</li>
      <li><kbd>Delete</kbd> — {t('shortcuts.delete')}</li>
      <li><kbd>Escape</kbd> — {t('shortcuts.deselect')}</li>
      <li><kbd>Space</kbd> + <kbd>{t('shortcuts.drag')}</kbd> — {t('shortcuts.pan')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>{t('shortcuts.wheel')}</kbd> — {t('shortcuts.zoom')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> — {t('shortcuts.undo')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> — {t('shortcuts.redo')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>S</kbd> — {t('shortcuts.exportHtml')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> — {t('shortcuts.exportPdf')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>O</kbd> — {t('shortcuts.open')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>C</kbd> — {t('shortcuts.copy')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>X</kbd> — {t('shortcuts.cut')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>V</kbd> — {t('shortcuts.paste')}</li>
      <li><kbd>Ctrl</kbd> + <kbd>D</kbd> — {t('shortcuts.duplicate')}</li>
    </ul>
  </section>
</div>

{#if showTable}
  <TableEditorModal onClose={() => (showTable = false)} onSubmit={onTableSubmit} />
{/if}

{#if showChart}
  <ChartEditorModal onClose={() => (showChart = false)} onSubmit={onChartSubmit} />
{/if}

{#if showShape}
  <ShapePickerModal onClose={() => (showShape = false)} onPick={onShapePick} />
{/if}

<style>
  .tools-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    overflow-y: auto;
  }

  .panel-header {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .panel-header h3 {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .tools-list {
    display: grid;
    gap: 6px;
    padding: 10px;
    grid-template-columns: 1fr;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    text-align: left;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    width: 100%;
    color: var(--text-primary);
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }
  .tool-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-primary);
  }
  .tool-btn .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: color var(--transition-fast);
  }
  .tool-btn:hover .icon {
    color: var(--accent-primary);
  }
  .tool-btn .label {
    font-size: 13px;
  }

  .tips {
    margin-top: auto;
    padding: 12px 14px;
    border-top: 1px solid var(--border-subtle);
    font-size: 11px;
    color: var(--text-muted);
  }
  .tips-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }
  .tips-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .tips-list li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px;
    line-height: 1.4;
  }

  kbd {
    display: inline-block;
    padding: 1px 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--border-strong);
    white-space: nowrap;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .duration-label {
    margin-top: 6px;
  }

  .bool-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .bool-grid button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
</style>
