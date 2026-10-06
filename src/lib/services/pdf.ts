import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { CancelledError, saveHtmlExport } from './save-html-export';
import type { Slide } from '$lib/stores/presentation.svelte';
import { convertFileSrc } from '@tauri-apps/api/core';

const PRINT_SCRIPT = `
<script>
  window.addEventListener('load', async () => {
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(r => setTimeout(r, 800));

      const style = document.createElement('style');
      style.textContent = '* { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);

      const nav = document.querySelector('.nav');
      if (nav) nav.style.display = 'none';

      window.print();
    } catch (e) {
      console.error('[pdf] print error', e);
    }
  });
</script>
`;

export async function exportToPdf(html: string, slides: Slide[], projectName: string): Promise<void> {
  // Вшиваем скрипт печати в HTML до сохранения
  const finalHtml = html.includes('</body>')
    ? html.replace('</body>', `${PRINT_SCRIPT}</body>`)
    : html + PRINT_SCRIPT;

  const saved = await saveHtmlExport(finalHtml, slides, projectName);
  if (!saved) {
    throw new CancelledError();
  }
  const htmlPath = saved.htmlPath;

  const url = convertFileSrc(htmlPath);
  const label = `pdf-${Date.now()}`;

  const webview = new WebviewWindow(label, {
    url,
    title: `${projectName} — сохранение PDF`,
    width: 1280,
    height: 720,
    center: true,
    focus: true
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      try { await webview.close(); } catch {}
      resolve();
    }, 5 * 60 * 1000);

    webview.once('tauri://created', () => {
      webview.once('tauri://close-requested', async () => {
        clearTimeout(timeout);
        try { await webview.close(); } catch {}
        resolve();
      });
    });

    webview.once('tauri://error', (e) => {
      clearTimeout(timeout);
      reject(new Error(`Ошибка окна PDF: ${e.payload}`));
    });
  });
}
