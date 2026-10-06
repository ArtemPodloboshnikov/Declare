export interface TransitionDef {
  id: string;
  labelKey: string;
}

export const TRANSITION_DURATION_MIN = 0.1;
export const TRANSITION_DURATION_MAX = 20;
export const TRANSITION_DURATION_DEFAULT = 4;
export const TRANSITION_DURATION_STEP = 0.1;

export const TRANSITIONS: TransitionDef[] = [
  { id: 'none', labelKey: 'transitions.none' },
  { id: 'fade', labelKey: 'transitions.fade' },
  { id: 'slide-up', labelKey: 'transitions.slideUp' },
  { id: 'slide-down', labelKey: 'transitions.slideDown' },
  { id: 'slide-left', labelKey: 'transitions.slideLeft' },
  { id: 'slide-right', labelKey: 'transitions.slideRight' },
  { id: 'zoom-in', labelKey: 'transitions.zoomIn' },
  { id: 'zoom-out', labelKey: 'transitions.zoomOut' },
  { id: 'rotate', labelKey: 'transitions.rotate' },
  { id: 'flip', labelKey: 'transitions.flip' },
];

export const DEFAULT_TRANSITION = 'fade';
