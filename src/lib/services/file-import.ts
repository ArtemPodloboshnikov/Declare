import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface ImportedFile {
  name: string;
  mime: string;
  size: number;
  blobUrl: string;
  file: File;
  path: string;      // абсолютный путь на диске
  src: string;       // asset:// URL для <img>/<video>/<audio>
}

export const MEDIA_ACCEPT: Record<string, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
};

export type DropKind = 'image' | 'audio' | 'video' | 'table' | null;

export function detectDropKind(file: File): DropKind {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';

  // Excel и CSV
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return 'table';
  }

  return null;
}

/**
 * Маппинг accept-строки (как в <input type="file">) в фильтры Tauri-диалога.
 * Поддерживает: "image/*", "video/*", "audio/*", ".png", ".mp4,.webm", "image/png".
 */
function acceptToFilters(accept: string): { name: string; extensions: string[] }[] {
  if (!accept || accept === '*/*') return [];

  const filters: { name: string; extensions: string[] }[] = [];
  const parts = accept.split(',').map(p => p.trim()).filter(Boolean);

  const byGroup: Record<string, string[]> = {};

  for (const part of parts) {
    // .png, .mp4, .webm
    if (part.startsWith('.')) {
      const ext = part.slice(1).toLowerCase();
      (byGroup['Files'] ??= []).push(ext);
      continue;
    }

    // image/*, video/*, audio/*
    if (part.endsWith('/*')) {
      const group = part.slice(0, -2).toLowerCase();
      const label =
        group === 'image' ? 'Images' :
        group === 'video' ? 'Video' :
        group === 'audio' ? 'Audio' :
        group;
      const exts =
        group === 'image' ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] :
        group === 'video' ? ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv'] :
        group === 'audio' ? ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'] :
        [];
      if (exts.length) byGroup[label] = exts;
      continue;
    }

    // image/png, video/mp4
    const slash = part.indexOf('/');
    if (slash > 0) {
      const group = part.slice(0, slash).toLowerCase();
      const ext = part.slice(slash + 1).toLowerCase();
      const label =
        group === 'image' ? 'Images' :
        group === 'video' ? 'Video' :
        group === 'audio' ? 'Audio' :
        group;
      (byGroup[label] ??= []).push(ext);
    }
  }

  for (const [name, extensions] of Object.entries(byGroup)) {
    filters.push({ name, extensions });
  }
  return filters;
}

/**
 * Открывает системный диалог выбора файла через Tauri и возвращает
 * метаданные + asset:// URL, пригодный для <img>/<video>/<audio> в WebView.
 *
 * В отличие от <input type="file">, Tauri-диалог даёт абсолютный путь,
 * что позволяет использовать convertFileSrc — это единственный надёжный
 * способ проигрывать локальное видео в Tauri (особенно на Linux/WebKitGTK).
 */
export async function pickFile(accept: string): Promise<ImportedFile | null> {
  const filters = acceptToFilters(accept);
  const selected = await open({
    multiple: false,
    directory: false,
    filters: filters.length ? filters : undefined
  });

  if (!selected) return null;

  const path = Array.isArray(selected) ? selected[0] : selected;

  // ВАЖНО: имя берём из СЫРОГО пути, до convertFileSrc
  const name = path.split(/[\\/]/).pop() ?? path;

  // MIME и ext — тоже из сырого name
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mime =
    ['png','jpg','jpeg','gif','webp','svg','bmp','avif'].includes(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}` :
    ['mp4','m4v','mov'].includes(ext) ? 'video/mp4' :
    ['webm'].includes(ext) ? 'video/webm' :
    ['ogg','ogv'].includes(ext) ? 'video/ogg' :
    ['mp3'].includes(ext) ? 'audio/mpeg' :
    ['wav'].includes(ext) ? 'audio/wav' :
    ['m4a','aac'].includes(ext) ? 'audio/aac' :
    ['flac'].includes(ext) ? 'audio/flac' :
    'application/octet-stream';

  const src = convertFileSrc(path);

  return {
    name,                            // ← нормальное "видео.mp4"
    mime,
    size: 0,
    blobUrl: src,
    file: null as unknown as File,
    path,
    src
  };
}

/** Читает текстовый файл (CSV) как строку. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Читает .xlsx через SheetJS (динамический импорт, чтобы не тянуть бандл). */
export async function readXlsx(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  return rows;
}

/** Универсальный парсер CSV в двумерный массив. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch === '\r') {
        // skip
      } else {
        cur += ch;
      }
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
