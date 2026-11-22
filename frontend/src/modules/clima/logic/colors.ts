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
  onFill: '#FFFFFF',
  onFillInk: '#000000',
} as const;

export const IDLE_PATTERN = 'repeating-linear-gradient(135deg,#46525B 0 3px,#2A333A 3px 6px)';

function hexChannels(c: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

/** Channels of a '#RRGGBB' or 'rgb(r,g,b)' colour; null for anything else (patterns, 'transparent'). */
function channels(c: string): [number, number, number] | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return hexChannels(c);
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio of two '#RRGGBB' / 'rgb()' colours (1 when either cannot be parsed). */
export function contrastRatio(a: string, b: string): number {
  const ca = channels(a);
  const cb = channels(b);
  if (!ca || !cb) return 1;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** AA minimum for the small program labels (WCAG 1.4.3). */
const LABEL_MIN_CONTRAST = 4.5;

/**
 * Text colour of a label drawn on a program fill. White as in the mockup, unless white falls below
 * the AA minimum on that fill (the hottest radiator colours, from about 22.5 °C): then the dark ink.
 * Fills that are not a plain colour (transparent, patterns) keep white: the label sits on the lane.
 */
export function onFillTextColor(fill: string): string {
  if (!channels(fill)) return PALETTE.onFill;
  return contrastRatio(PALETTE.onFill, fill) >= LABEL_MIN_CONTRAST ? PALETTE.onFill : PALETTE.onFillInk;
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
