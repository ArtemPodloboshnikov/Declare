import type { EmbedProvider } from '$lib/stores/presentation.svelte';

export interface EmbedInfo {
  provider: EmbedProvider;
  /** ID видео (для YouTube, Rutube, VK) — если удаётся извлечь */
  id: string;
  /** Готовая embed-ссылка для iframe */
  embedUrl: string;
}

/**
 * Разбирает URL и возвращает информацию для встраивания.
 *
 * ВАЖНО: функция больше НЕ строит embed-URL из обычных ссылок.
 * Пользователь должен вставлять готовую embed-ссылку (iframe src),
 * полученную через «Поделиться» → «Встроить» на сайте провайдера.
 *
 * Поддерживаются:
 *   - YouTube:  https://www.youtube.com/embed/VIDEO_ID
 *   - Rutube:   https://rutube.ru/play/embed/VIDEO_ID
 *   - VK Video: https://vk.com/video_ext.php?oid=...&id=...&hash=...
 *               https://vkvideo.ru/video_ext.php?oid=...&id=...&hash=...
 *   - Dzen:     https://dzen.ru/embed/...
 *   - Custom:   любая другая embed-ссылка (используется как есть)
 */
export function parseEmbedUrl(raw: string): EmbedInfo | null {
  let url = raw.trim();
  if (!url) return null;

  const iframeMatch = url.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    url = iframeMatch[1];
  }

  // YouTube embed
  const yt = url.match(
    /(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/
  );
  if (yt) {
    return {
      provider: 'youtube',
      id: yt[1],
      embedUrl: url
    };
  }

  // Rutube embed
  const rt = url.match(/rutube\.ru\/play\/embed\/([a-f0-9]{32})/i);
  if (rt) {
    return {
      provider: 'rutube',
      id: rt[1],
      embedUrl: url
    };
  }

  // VK Video embed (video_ext.php)
  if (/(?:vk\.com|vkvideo\.ru)\/video_ext\.php/.test(url)) {
    const params = new URL(url, 'https://vk.com').searchParams;
    const oid = params.get('oid') ?? '';
    const id = params.get('id') ?? '';
    const hash = params.get('hash') ?? '';
    return {
      provider: 'vk',
      id: oid && id ? `${oid}_${id}` : url,
      embedUrl: url
    };
  }

  // Dzen embed
  const dzen = url.match(/dzen\.ru\/embed\/([\w-]+)/);
  if (dzen) {
    return {
      provider: 'dzen',
      id: dzen[1],
      embedUrl: url
    };
  }

  // Любая другая ссылка — считаем custom и используем как есть
  return {
    provider: 'custom',
    id: url,
    embedUrl: url
  };
}

/**
 * Возвращает атрибут allow для iframe в зависимости от провайдера.
 */
export function embedAllow(provider: EmbedProvider): string {
  switch (provider) {
    case 'youtube':
      return 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    case 'rutube':
    case 'vk':
      return 'autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock';
    default:
      return 'autoplay; encrypted-media; fullscreen';
  }
}
