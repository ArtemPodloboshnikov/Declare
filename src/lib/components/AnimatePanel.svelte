<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    presentation,
    type SlideElement,
    type AnimationKind,
    type AnimationTrigger,
    type ElementAnimation
  } from '$lib/stores/presentation.svelte';
  import {
    ANIMATIONS,
    TRIGGERS,
    EASINGS,
    ANIM_DURATION_MIN,
    ANIM_DURATION_MAX,
    ANIM_DURATION_DEFAULT,
    ANIM_DURATION_STEP
  } from '$lib/services/animations';
  import Select from './Select.svelte';
  import InputNumber from './InputNumber.svelte';
  import Play from '@lucide/svelte/icons/play';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  let { element }: { element: SlideElement } = $props();

  const anim = $derived(element.animation);
  const enabled = $derived(Boolean(anim && anim.kind !== 'none'));

  function ensureAnimation(): ElementAnimation {
    return anim ?? {
      kind: 'fade',
      trigger: 'onClick',
      duration: ANIM_DURATION_DEFAULT,
      delay: 0,
      easing: 'ease-out'
    };
  }

  function update(patch: Partial<ElementAnimation>) {
    presentation.updateElement(element.id, {
      animation: { ...ensureAnimation(), ...patch }
    }, true);
  }

  function commit() {
    presentation.commitPendingHistory();
  }

  function enable() {
    update({ kind: 'fade' });
    commit();
  }

  function disable() {
    presentation.updateElement(element.id, { animation: undefined });
    commit();
  }

  function setKind(kind: AnimationKind) {
    update({ kind });
    commit();
  }

  function preview() {
    // Триггерим анимацию на элементе в Viewport через custom event
    window.dispatchEvent(new CustomEvent('preview-animation', {
      detail: { elementId: element.id }
    }));
  }
</script>

<div class="animate-panel">
  <header class="panel-subheader">
    <Sparkles size={14} strokeWidth={1.75} />
    <span>{t('anim.title')}</span>
  </header>

  {#if !enabled}
    <button class="add-anim-btn" onclick={enable}>
      + {t('anim.add')}
    </button>
  {:else}
    <div class="block">
      <!-- Тип анимации -->
      <div class="row">
        <span class="panel-lbl">{t('anim.kind')}</span>
        <Select
          value={anim!.kind}
          options={ANIMATIONS.map(a => ({
            value: a.kind,
            label: t(a.labelKey)
          }))}
          onchange={(v) => setKind(v as AnimationKind)}
        />
      </div>

      <!-- Триггер -->
      <div class="row">
        <span class="panel-lbl">{t('anim.trigger')}</span>
        <Select
          value={anim!.trigger}
          options={TRIGGERS.map(tr => ({
            value: tr.value,
            label: t(tr.labelKey)
          }))}
          onchange={(v) => { update({ trigger: v as AnimationTrigger }); commit(); }}
        />
      </div>

      <!-- Длительность -->
      <div class="row">
        <span class="panel-lbl">{t('anim.duration')}</span>
        <InputNumber
          value={anim!.duration}
          min={ANIM_DURATION_MIN}
          max={ANIM_DURATION_MAX}
          step={ANIM_DURATION_STEP}
          suffix="ms"
          onchange={(v) => { update({ duration: v }); commit(); }}
        />
      </div>

      <!-- Задержка -->
      <div class="row">
        <span class="panel-lbl">{t('anim.delay')}</span>
        <InputNumber
          value={anim!.delay}
          min={0}
          max={5000}
          step={50}
          suffix="ms"
          onchange={(v) => { update({ delay: v }); commit(); }}
        />
      </div>

      <!-- Easing -->
      <div class="row">
        <span class="panel-lbl">{t('anim.easing.title')}</span>
        <Select
          value={anim!.easing}
          options={EASINGS.map(e => ({
            value: e.value,
            label: t(e.labelKey)
          }))}
          onchange={(v) => { update({ easing: v as ElementAnimation['easing'] }); commit(); }}
        />
      </div>

      <div class="actions">
        <button class="ghost" onclick={preview} title={t('anim.preview')}>
          <Play size={14} strokeWidth={1.75} />
          {t('anim.preview')}
        </button>
        <button class="ghost danger" onclick={disable} title={t('anim.remove')}>
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .animate-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .add-anim-btn {
    width: 100%;
    justify-content: center;
    font-size: 12px;
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

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .actions button {
    flex: 1;
    justify-content: center;
    font-size: 12px;
  }

  .actions button:last-child {
    flex: 0 0 auto;
    padding: 6px 10px;
  }
</style>
