import { LazyStore } from '@tauri-apps/plugin-store';

export type AppLanguage = 'ru' | 'en';
export type Theme = 'dark' | 'light';

const STORE_PATH = 'settings.json';
const KEY = 'app';
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

interface PersistedAppState {
  language: AppLanguage;
  theme: Theme;
  lastProjectPath: string | null;
  exportRootDir: string | null;
}

interface StatusMessage {
  text: string;
  kind: 'info' | 'error' | 'success' | 'confirm';
  /** Для kind === 'confirm' — колбэк с ответом пользователя */
  resolve?: (value: boolean) => void;
  /** Метка действия (подтвердить) — опционально для i18n */
  confirmLabel?: string;
  cancelLabel?: string;
}

const DEFAULTS: PersistedAppState = {
  language: 'ru',
  theme: 'dark',
  lastProjectPath: null,
  exportRootDir: null
};

// LazyStore подгружает файл при первом обращении — это быстрее, чем Store.load на старте.
const store = new LazyStore(STORE_PATH);

function createAppStore() {
  // Стартовые значения — дефолты. Реальные подтянутся асинхронно.
  let language = $state<AppLanguage>(DEFAULTS.language);
  let theme = $state<Theme>(DEFAULTS.theme);
  let lastProjectPath = $state<string | null>(DEFAULTS.lastProjectPath);
  let exportRootDir = $state<string | null>(DEFAULTS.exportRootDir);
  let hydrated = $state(false);

  let sidebarCollapsed = $state(false);
  let rightPanel = $state<'tools' | 'ai'>('tools');
  let showHtmlEditor = $state(false);
  let showSettings = $state(false);
  let showPluginManager = $state(false);
  let statusMessage = $state<StatusMessage | null>(null);

  let isRussian = $derived(language === 'ru');
  let statusTimer: ReturnType<typeof setTimeout> | null = null;

  // Защита от гонок: если два persist() идут подряд, второй дождётся первого.
  let persistChain: Promise<void> = Promise.resolve();

  /**
   * Читает сохранённое состояние из Store и мержит с дефолтами.
   * Вызывается один раз при инициализации приложения.
   */
  async function hydrate(): Promise<void> {
    if (hydrated) return;
    try {
      const saved = await store.get<Partial<PersistedAppState>>(KEY);
      if (saved) {
        if (saved.language === 'ru' || saved.language === 'en') language = saved.language;
        if (saved.theme === 'dark' || saved.theme === 'light') theme = saved.theme;
        if (typeof saved.lastProjectPath === 'string' || saved.lastProjectPath === null) {
          lastProjectPath = saved.lastProjectPath ?? null;
        }
        if (typeof saved.exportRootDir === 'string' || saved.exportRootDir === null) {
          exportRootDir = saved.exportRootDir ?? null;
        }
      }
    } catch {
    } finally {
      hydrated = true;
    }
  }

  /**
   * Асинхронно пишет текущее состояние в Store.
   * Не блокирует UI, ошибки глотает (с записью в консоль).
   */
  function persist(): Promise<void> {
    const snapshot: PersistedAppState = {
      language,
      theme,
      lastProjectPath,
      exportRootDir
    };
    persistChain = persistChain
      .then(() => store.set(KEY, snapshot))
      .then(() => store.save());
    return persistChain;
  }

  return {
    // Состояние загрузки — полезно, чтобы UI не мигал дефолтами
    get hydrated() { return hydrated; },
    hydrate,

    // язык
    get language() { return language; },
    set language(v: AppLanguage) { language = v; void persist(); },
    get isRussian() { return isRussian; },
    toggleLanguage() { language = language === 'ru' ? 'en' : 'ru'; void persist(); },
    setLanguage(lang: AppLanguage) { language = lang; void persist(); },

    // тема
    get theme() { return theme; },
    set theme(v: Theme) { theme = v; void persist(); },
    toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; void persist(); },
    setTheme(t: Theme) { theme = t; void persist(); },

    // правая панель
    get rightPanel() { return rightPanel; },
    set rightPanel(v: 'tools' | 'ai') { rightPanel = v; },
    setRightPanel(p: 'tools' | 'ai') { rightPanel = p; },

    // сайдбар
    get sidebarCollapsed() { return sidebarCollapsed; },
    set sidebarCollapsed(v: boolean) { sidebarCollapsed = v; },
    toggleSidebar() { sidebarCollapsed = !sidebarCollapsed; },

    // модалки
    get showHtmlEditor() { return showHtmlEditor; },
    set showHtmlEditor(v: boolean) { showHtmlEditor = v; },
    openHtmlEditor() { showHtmlEditor = true; },
    closeHtmlEditor() { showHtmlEditor = false; },

    get showSettings() { return showSettings; },
    set showSettings(v: boolean) { showSettings = v; },
    openSettings() { showSettings = true; },
    closeSettings() { showSettings = false; },

    get showPluginManager() { return showPluginManager; },
    set showPluginManager(v: boolean) { showPluginManager = v; },
    openPluginManager() { showPluginManager = true; },
    closePluginManager() { showPluginManager = false; },

    // уведомления
    get statusMessage() { return statusMessage; },
    notify(text: string, kind: 'info' | 'error' | 'success' = 'info', duration = 3000) {
      if (statusMessage?.kind === 'confirm' && statusMessage.resolve) {
        statusMessage.resolve(false);
      }

      statusMessage = { text, kind };
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        statusMessage = null;
        statusTimer = null;
      }, duration);
    },

    clearNotification() {
      if (statusMessage?.kind === 'confirm' && statusMessage.resolve) {
        statusMessage.resolve(false);
      }
      statusMessage = null;
      if (statusTimer) {
        clearTimeout(statusTimer);
        statusTimer = null;
      }
    },

    confirm(
      text: string,
      options: { confirmLabel?: string; cancelLabel?: string } = {}
    ): Promise<boolean> {
      // Если уже висит подтверждение — резолвим предыдущее как false
      if (statusMessage?.kind === 'confirm' && statusMessage.resolve) {
        statusMessage.resolve(false);
      }

      return new Promise<boolean>((resolve) => {
        if (statusTimer) {
          clearTimeout(statusTimer);
          statusTimer = null;
        }

        statusMessage = {
          text,
          kind: 'confirm',
          resolve,
          confirmLabel: options.confirmLabel,
          cancelLabel: options.cancelLabel
        };
      });
    },

    resolveConfirm(value: boolean) {
      if (statusMessage?.kind !== 'confirm') return;
      statusMessage.resolve?.(value);
      statusMessage = null;
      if (statusTimer) {
        clearTimeout(statusTimer);
        statusTimer = null;
      }
    },

    // путь последнего проекта
    get lastProjectPath() { return lastProjectPath; },
    set lastProjectPath(v: string | null) { lastProjectPath = v; void persist(); },
    setLastProjectPath(p: string | null) { lastProjectPath = p; void persist(); },

    // папка экспорта
    get exportRootDir() { return exportRootDir; },
    set exportRootDir(v: string | null) { exportRootDir = v; void persist(); },
    setExportRootDir(v: string | null) { exportRootDir = v; void persist(); }
  };
}

export const app = createAppStore();
export type AppStore = ReturnType<typeof createAppStore>;
