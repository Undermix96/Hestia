// Time-axis ticks (port of the mockup's `xl` loop). The UI formats the text from `iso` with Intl.
import type { TimeGrid } from '../../../api/types';
import { localParts } from '../../../lib/time';
import { nowPct } from './scales';

export interface AxisTick {
  index: number;
  iso: string;
  leftPct: number;
  kind: 'now' | 'hour' | 'day';
}

/** Ticks closer than this (percent) to the "now" label are omitted. */
export const AXIS_NOW_GAP_PCT = 5;

export function axisTicks(grid: TimeGrid, timeZone: string): AxisTick[] {
  const n = grid.count;
  const now = nowPct(grid.nowIndex, n);
  const nowRounded = Number(now.toFixed(2));
  const ticks: AxisTick[] = [{ kind: 'now', index: grid.nowIndex, iso: grid.t[grid.nowIndex] ?? '', leftPct: now }];
  for (let k = 0; k < n; k += 1) {
    const pos = ((k + 0.5) / n) * 100;
    if (Math.abs(pos - nowRounded) < AXIS_NOW_GAP_PCT) continue;
    const iso = grid.t[k]!;
    const p = localParts(Date.parse(iso), timeZone);
    if (grid.range === '7d') {
      if (p.hour === 0 && p.minute === 0) ticks.push({ kind: 'day', index: k, iso, leftPct: (k / n) * 100 });
    } else if (p.minute === 0 && p.hour % 4 === 0) {
      ticks.push({ kind: 'hour', index: k, iso, leftPct: pos });
    }
  }
  return ticks;
}
