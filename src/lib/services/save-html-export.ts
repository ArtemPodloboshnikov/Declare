import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { app } from '$lib/stores/app.svelte';
import type { Slide } from '$lib/stores/presentation.svelte';
import { buildExport } from './export';

export interface SaveHtmlExportOptions {
  /** Перезаписывать index.html вместо <projectName>.html */
  indexHtml?: boolean;
  startSlideIndex?: number;
}

export interface SaveHtmlExportResult {
  outputDir: string;
  htmlPath: string;
  assetCount: number;
}

/**
 * Собирает HTML и ассеты, сохраняет их в папку экспорта.
 * Если папка не задана — открывает диалог выбора.
 */
export async function saveHtmlExport(
  html: string | null,
  slides: Slide[],
  projectName: string,
  options: SaveHtmlExportOptions = {}
): Promise<SaveHtmlExportResult> {
  // 1. Папка экспорта
  let rootDir = app.exportRootDir;
  if (!rootDir) {
    const picked = await open({
      directory: true,
      multiple: false,
      title: 'Выберите папку для экспорта'
    });
    if (!picked || Array.isArray(picked)) {
      throw new CancelledError();
    }
    rootDir = picked;
    app.setExportRootDir(picked);
  }

  // 2. Сборка (если html не передан — собираем сами)
  let htmlContent = html;
  let assetsPayload: { relativePath: string; dataBase64: string }[] = [];

  if (!htmlContent) {
    const built = await buildExport(slides, projectName, { startSlideIndex: options.startSlideIndex });
    htmlContent = built.html;
    assetsPayload = await Promise.all(
      built.assets.map(async (a) => ({
        relativePath: a.relativePath,
        dataBase64: await blobToBase64(a.blob)
      }))
    );
  } else {
    // HTML передан — но ассеты всё равно надо собрать из слайдов
    const built = await buildExport(slides, projectName);
    assetsPayload = await Promise.all(
      built.assets.map(async (a) => ({
        relativePath: a.relativePath,
        dataBase64: await blobToBase64(a.blob)
      }))
    );
    // если html передан, но есть blob-URL — их надо было заменить; это ответственность вызывающего
  }

  // 3. Запись через Rust
  const result = await invoke<SaveHtmlExportResult>('save_presentation', {
    args: {
      rootDir,
      projectName,
      html: htmlContent,
      assets: assetsPayload,
      indexHtml: options.indexHtml ?? false
    }
  });

  return result;
}

// ---------- Утилиты ----------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class CancelledError extends Error {
  readonly cancelled = true;

  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

export function isCancelledError(e: unknown): e is CancelledError {
  return e instanceof CancelledError;
}
