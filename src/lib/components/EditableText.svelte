<script lang="ts">
  import { t } from '$lib/i18n';
  import { presentation, type SlideElement } from '$lib/stores/presentation.svelte';

  let {
    element,
    onSelect
  }: {
    element: SlideElement;
    onSelect: (id: string) => void;
  } = $props();

  let editing = $state(false);
  let rootEl: HTMLDivElement;

  // Синхронизация content при выходе из редактирования
  function startEdit(e: MouseEvent) {
    if (editing) return;
    e.stopPropagation();
    onSelect(element.id);
    editing = true;
    // фокус ставим в следующем тике, когда contenteditable уже включён
    queueMicrotask(() => {
      rootEl?.focus();
      // ставим каретку в конец
      const range = document.createRange();
      range.selectNodeContents(rootEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }

  function commit() {
    if (!editing) return;
    editing = false;
    // content уже синхронизирован через input
  }

  function onInput() {
    if (!rootEl) return;
    // сохраняем HTML как есть (включая <br>, <b>, <i> и т.п.)
    presentation.updateElement(element.id, { content: rootEl.innerHTML });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!editing) return;

    // Enter — завершить редактирование
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      commit();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      commit();
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      document.execCommand('insertLineBreak');
      onInput();
      return;
    }

    // Backspace и Delete во время редактирования — не должны
    // доходить до глобального обработчика в Viewport.
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.stopPropagation();
      // не preventDefault — пусть contenteditable сам обработает удаление
    }
  }

  // Клик вне компонента завершает редактирование
  function onDocPointerDown(e: PointerEvent) {
    if (!editing) return;
    const target = e.target as Node;
    if (rootEl && !rootEl.contains(target)) {
      commit();
    }
  }

  $effect(() => {
    if (editing) {
      document.addEventListener('pointerdown', onDocPointerDown, true);
      return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
    }
  });

  $effect(() => {
    if (editing && rootEl) {
      // Защита от перезаписи во время ввода
      if (rootEl.innerHTML !== element.content) {
        rootEl.innerHTML = element.content;
      }
    }
  });

  const styleString = $derived.by(() => {
    const s = element.style ?? {};
    const parts: string[] = [];
    if (s.fontFamily) parts.push(`font-family: '${s.fontFamily}', sans-serif`);
    if (s.fontWeight) parts.push(`font-weight: ${s.fontWeight}`);
    if (s.fontStyle) parts.push(`font-style: ${s.fontStyle}`);
    if (s.fontSize) parts.push(`font-size: ${s.fontSize}`);
    if (s.color) parts.push(`color: ${s.color}`);
    if (s.textAlign) parts.push(`text-align: ${s.textAlign}`);
    return parts.join('; ');
  });
</script>

<div
  class="editable-text"
  class:editing
  bind:this={rootEl}
  contenteditable={editing}
  role="textbox"
  tabindex={editing ? 0 : -1}
  style={styleString}
  ondblclick={startEdit}
  oninput={onInput}
  onkeydown={onKeyDown}
  onblur={commit}
>
  {#if element.content}
    {@html element.content}
  {:else}
    <span class="placeholder">{t('text.placeholder')}</span>
  {/if}
</div>

<style>
  .editable-text {
    width: 100%;
    height: 100%;
    padding: 6px 10px;
    overflow: hidden;
    word-break: break-word;
    color: var(--text-primary);
    filter: var(--element-filter, none);
    box-shadow: var(--inner-shadow, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
    cursor: default;
    white-space: pre-wrap;
  }

  .editable-text.editing {
    cursor: text;
    overflow: auto;
  }

  .editable-text.editing::after {
    /* визуальный индикатор редактирования */
    content: '';
    position: absolute;
    inset: -2px;
    border: 1px dashed var(--accent-primary);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }

  .placeholder {
    color: var(--text-muted);
    font-style: italic;
  }
</style>
