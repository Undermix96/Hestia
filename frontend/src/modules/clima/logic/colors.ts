// Colours computed in JS (the CSS side uses the tokens of styles/tokens.css, same values).
import type { Action } from '../../../api/types';

export const PALETTE = {
  bg: '#0E1215',
  panel: '#151A1E',
  panel2: '#1E252A',
  lane: '#1A2025',
  outBg: '#12171A',
  grid: '#1F262B',
  border: '#2A333A',
  border2: '#2E383F',
  text: '#EEF2F4',
  text2: '#C9D1D6',
  muted: '#98A3AB',
  heat: '#FF8A4C',
  target: '#FFB07A',
  cool: '#4FB3FF',
  hum: '#59D3B4',
  dry: '#59D3B4',
  out: '#8EA2FF',
  outHum: '#7FD8C8',
  acProg: '#2E4A66',
  radLo: '#3A5A8C',
  radHi: '#C2622E',
  idleA: '#46525B',
  idleB: '#2A333A',
  dotIdle: '#6A767F',
} as const;

export const IDLE_PATTERN = 'repeating-linear-gradient(135deg,#46525B 0 3px,#2A333A 3px 6px)';

function hexChannels(c: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

/** Port of the mockup's `mix(a, b, t)`: linear blend of two '#RRGGBB' colours, t clamped to [0, 1]. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pa = hexChannels(a);
  const pb = hexChannels(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i]! - v) * k)).join(',')})`;
}

/** Radiator program colour: 17 °C → radLo, 23 °C → radHi. */
export function radiatorColor(targetC: number): string {
  return mix(PALETTE.radLo, PALETTE.radHi, (targetC - 17) / 6);
}

/** Background of an action bar run. */
export function actionFill(a: Action | null): string {
  switch (a) {
    case 'heat':
      return PALETTE.heat;
    case 'cool':
      return PALETTE.cool;
    case 'dry':
      return PALETTE.dry;
    case 'idle':
      return IDLE_PATTERN;
    default:
      return 'transparent';
  }
}

/** Text colour of an action label (tooltips, readouts). */
export function actionTextColor(a: Action | null): string {
  switch (a) {
    case 'heat':
      return PALETTE.heat;
    case 'cool':
      return PALETTE.cool;
    case 'dry':
      return PALETTE.dry;
    default:
      return PALETTE.muted;
  }
}

/** Status dot colour. */
export function actionDotColor(a: Action | null): string {
  switch (a) {
    case 'heat':
      return PALETTE.heat;
    case 'cool':
      return PALETTE.cool;
    case 'dry':
      return PALETTE.dry;
    default:
      return PALETTE.dotIdle;
  }
}

/** True when the system is acting (the status dot pulses). */
export function isActive(a: Action | null): boolean {
  return a === 'heat' || a === 'cool' || a === 'dry';
}
