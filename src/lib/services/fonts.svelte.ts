import { invoke } from '@tauri-apps/api/core';

export interface FontFamily {
  name: string;
  styles: string[];
}

export interface FontFileData {
  family: string;
  style: string;
  mime: string;
  dataBase64: string;
  fileName: string;
}

function createFontsStore() {
  let families = $state<FontFamily[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let loaded = $state(false);

  // кэш уже прочитанных файлов шрифтов: `${family}|${style}` → data
  const fileCache = new Map<string, FontFileData>();

  async function load() {
    if (loaded || loading) return;
    loading = true;
    error = null;
    try {
      families = await invoke<FontFamily[]>('list_system_fonts');
      loaded = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function readFont(family: string, style: string): Promise<FontFileData> {
    const key = `${family}|${style}`;
    const cached = fileCache.get(key);
    if (cached) return cached;
    const data = await invoke<FontFileData>('read_font_file', { family, style });
    fileCache.set(key, data);
    return data;
  }

  return {
    get families() { return families; },
    get loading() { return loading; },
    get error() { return error; },
    get loaded() { return loaded; },
    load,
    readFont
  };
}

export const fonts = createFontsStore();
