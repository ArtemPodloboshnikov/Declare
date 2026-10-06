import type { TableSettings } from '$lib/stores/presentation.svelte';
import { DEFAULT_TABLE_SETTINGS } from '$lib/stores/presentation.svelte';

export interface TablePreset {
  id: string;
  /** i18n-ключ названия */
  labelKey: string;
  /** Мини-превью: цвета для рендера иконки */
  preview: {
    headerBg: string;
    headerColor: string;
    cellColor: string;
    borderColor: string;
    stripeColor?: string;
    striped?: boolean;
  };
  settings: TableSettings;
}

export const TABLE_PRESETS: TablePreset[] = [
  {
    id: 'default',
    labelKey: 'table.preset.default',
    preview: {
      headerBg: '#1e1e28',
      headerColor: '#e8e8f0',
      cellColor: '#e8e8f0',
      borderColor: '#2a2a38',
      stripeColor: 'rgba(255,255,255,0.02)',
      striped: true
    },
    settings: { ...DEFAULT_TABLE_SETTINGS }
  },
  {
    id: 'minimal',
    labelKey: 'table.preset.minimal',
    preview: {
      headerBg: 'transparent',
      headerColor: '#e8e8f0',
      cellColor: '#e8e8f0',
      borderColor: '#3a3a4d',
      striped: false
    },
    settings: {
      ...DEFAULT_TABLE_SETTINGS,
      headerBg: 'transparent',
      headerColor: '#e8e8f0',
      cellColor: '#e8e8f0',
      borderColor: '#3a3a4d',
      borderWidth: 1,
      striped: false,
      paddingX: 12,
      paddingY: 8
    }
  },
  {
    id: 'striped',
    labelKey: 'table.preset.striped',
    preview: {
      headerBg: '#262633',
      headerColor: '#ffffff',
      cellColor: '#e8e8f0',
      borderColor: '#2a2a38',
      stripeColor: 'rgba(124,108,240,0.08)',
      striped: true
    },
    settings: {
      ...DEFAULT_TABLE_SETTINGS,
      headerBg: '#262633',
      headerColor: '#ffffff',
      stripeColor: 'rgba(124,108,240,0.08)',
      striped: true
    }
  },
  {
    id: 'bordered',
    labelKey: 'table.preset.bordered',
    preview: {
      headerBg: '#1e1e28',
      headerColor: '#e8e8f0',
      cellColor: '#e8e8f0',
      borderColor: '#7c6cf0',
      striped: false
    },
    settings: {
      ...DEFAULT_TABLE_SETTINGS,
      headerBg: '#1e1e28',
      borderColor: '#7c6cf0',
      borderWidth: 2,
      striped: false
    }
  },
  {
    id: 'accent',
    labelKey: 'table.preset.accent',
    preview: {
      headerBg: '#7c6cf0',
      headerColor: '#ffffff',
      cellColor: '#e8e8f0',
      borderColor: '#7c6cf0',
      stripeColor: 'rgba(124,108,240,0.1)',
      striped: true
    },
    settings: {
      ...DEFAULT_TABLE_SETTINGS,
      headerBg: '#7c6cf0',
      headerColor: '#ffffff',
      borderColor: '#7c6cf0',
      borderWidth: 1,
      stripeColor: 'rgba(124,108,240,0.1)',
      striped: true
    }
  },
  {
    id: 'light',
    labelKey: 'table.preset.light',
    preview: {
      headerBg: '#f4f4f8',
      headerColor: '#1e1e28',
      cellColor: '#1e1e28',
      borderColor: '#d0d0dc',
      stripeColor: 'rgba(0,0,0,0.03)',
      striped: true
    },
    settings: {
      ...DEFAULT_TABLE_SETTINGS,
      headerBg: '#f4f4f8',
      headerColor: '#1e1e28',
      cellColor: '#1e1e28',
      borderColor: '#d0d0dc',
      stripeColor: 'rgba(0,0,0,0.03)',
      striped: true
    }
  }
];
