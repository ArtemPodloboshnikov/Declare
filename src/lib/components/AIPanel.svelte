<script lang="ts">
  import { t } from '$lib/i18n';
  import {
    ai,
    type ProviderId,
    generateAndInsertSlide,
    generateAndInsertPresentation,
    applyPastedHtml,
    buildPromptTemplate
  } from '$lib/services/ai.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { Copy, ClipboardPaste, Wand2, Check } from '@lucide/svelte';
  import Select from './Select.svelte';
  import InputNumber from './InputNumber.svelte';

  const providerOptions = $derived(
    ai.providerList.map(p => ({ value: p.id, label: p.name }))
  );

  let prompt = $state('');
  let slideCount = $state(3);
  let pastedHtml = $state('');
  let busy = $state(false);
  let copied = $state(false);

  async function generateOne() {
    if (!prompt.trim() || busy) return;
    busy = true;
    try {
      await generateAndInsertSlide(prompt);
      app.notify(t('ai.slideCreated'), 'success');
    } catch (e) {
      app.notify(t('ai.generationFailed', { error: String(e) }), 'error', 6000);
    } finally {
      busy = false;
    }
  }

  async function generateAll() {
    if (!prompt.trim() || busy) return;
    busy = true;
    try {
      await generateAndInsertPresentation(prompt, slideCount);
      app.notify(t('ai.presentationCreated', { count: slideCount }), 'success');
    } catch (e) {
      app.notify(t('ai.generationFailed', { error: String(e) }), 'error', 6000);
    } finally {
      busy = false;
    }
  }

  async function copyPrompt() {
    const template = buildPromptTemplate(slideCount, prompt);
    try {
      await navigator.clipboard.writeText(template);
    } catch {
      // Fallback для сред без clipboard API
      const ta = document.createElement('textarea');
      ta.value = template;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function applyPasted() {
    if (!pastedHtml.trim() || busy) return;
    busy = true;
    try {
      const count = await applyPastedHtml(pastedHtml);
      pastedHtml = '';
      app.notify(t('ai.slidesInserted', { count }), 'success');
    } catch (e) {
      app.notify(t('ai.parseFailed', { error: String(e) }), 'error', 6000);
    } finally {
      busy = false;
    }
  }
</script>

<div class="ai-panel">
  <header class="panel-subheader">
    <span>{t('ai.title')}</span>
  </header>

  <!-- Провайдер -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('ai.provider')}</span>
      <Select
        value={ai.providerId}
        options={providerOptions}
        onchange={(v) => { ai.providerId = v as ProviderId; }}
      />
    </div>

    <div class="row">
      <span class="panel-lbl">{t('ai.baseUrl')}</span>
      <input
        type="text"
        bind:value={ai.provider.baseUrl}
        placeholder="https://api.example.com/v1"
      />
    </div>

    <div class="row">
      <span class="panel-lbl">{t('ai.model')}</span>
      <input
        type="text"
        bind:value={ai.provider.model}
        placeholder="gpt-4o"
      />
    </div>

    <div class="row">
      <span class="panel-lbl">{t('ai.apiKey')}</span>
      <input
        type="password"
        bind:value={ai.provider.apiKey}
        placeholder={ai.provider.kind === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
      />
      {#if ai.provider.kind === 'anthropic'}
        <p class="hint">{t('ai.anthropicKeyHint')}</p>
      {/if}
    </div>
  </div>

  <!-- Генерация -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('ai.prompt')}</span>
      <textarea
        bind:value={prompt}
        rows="4"
        disabled={busy}
        placeholder={t('ai.promptPlaceholder')}
      ></textarea>
    </div>

    <div class="row">
      <span class="panel-lbl">{t('ai.slideCount')}</span>
      <InputNumber
        value={slideCount}
        min={1}
        max={20}
        step={1}
        onchange={(v) => (slideCount = v)}
      />
    </div>

    <div class="btn-row">
      <button class="primary" onclick={generateOne} disabled={busy || !prompt.trim()}>
        <Wand2 size={14} strokeWidth={1.75} />
        {t('ai.generateOne')}
      </button>
      <button class="primary" onclick={generateAll} disabled={busy || !prompt.trim()}>
        <Wand2 size={14} strokeWidth={1.75} />
        {t('ai.generateAll', { count: slideCount })}
      </button>
    </div>
  </div>

  <!-- Промпт-шаблон -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('ai.promptTemplate')}</span>
      <p class="hint">{t('ai.promptTemplateHint')}</p>
    </div>
    <button class="ghost full" onclick={copyPrompt}>
      {#if copied}
        <Check size={14} strokeWidth={1.75} />
        {t('ai.copied')}
      {:else}
        <Copy size={14} strokeWidth={1.75} />
        {t('ai.copyPrompt')}
      {/if}
    </button>
  </div>

  <!-- Вставка ответа -->
  <div class="block">
    <div class="row">
      <span class="panel-lbl">{t('ai.pasteResponse')}</span>
      <p class="hint">{t('ai.pasteResponseHint')}</p>
      <textarea
        bind:value={pastedHtml}
        rows="6"
        disabled={busy}
        placeholder='<div class="slide-inner">...</div>'
      ></textarea>
    </div>
    <button
      class="primary full"
      onclick={applyPasted}
      disabled={busy || !pastedHtml.trim()}
    >
      <ClipboardPaste size={14} strokeWidth={1.75} />
      {busy ? t('ai.applying') : t('ai.applyPasted')}
    </button>
  </div>
</div>

<style>
  .ai-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    overflow-y: auto;
  }

  .panel-subheader {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid var(--border-subtle);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  input[type="text"],
  input[type="password"],
  textarea {
    width: 100%;
    padding: 7px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }
  input[type="text"],
  input[type="password"] {
    height: 34px;
  }
  textarea {
    font-family: var(--font-mono);
    font-size: 12px;
    resize: vertical;
    min-height: 60px;
  }
  input:focus,
  textarea:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  .btn-row {
    display: flex;
    gap: 6px;
  }
  .btn-row button {
    flex: 1;
    justify-content: center;
  }

  .full {
    width: 100%;
    justify-content: center;
  }
</style>
