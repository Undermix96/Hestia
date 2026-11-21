// Run-length helpers (port of the mockup's `runs()`), used by lanes and strips.
import type { Action } from '../../../api/types';

/** Half-open run [start, end) of equal keys. */
export interface Run<V> {
  value: V;
  start: number;
  end: number;
}

/** Port of `runs(n, key)`: maximal runs of equal keys over [0, n). */
export function runs<V>(n: number, key: (i: number) => V, eq: (a: V, b: V) => boolean = Object.is): Run<V>[] {
  const out: Run<V>[] = [];
  if (n <= 0) return out;
  let cur = key(0);
  let s0 = 0;
  for (let i = 1; i < n; i += 1) {
    const v = key(i);
    if (!eq(v, cur)) {
      out.push({ value: cur, start: s0, end: i });
      cur = v;
      s0 = i;
    }
  }
  out.push({ value: cur, start: s0, end: n });
  return out;
}

export interface ActionRun {
  action: Action | null;
  start: number;
  end: number;
  /** true when the run starts at or after now (drawn at half opacity) */
  forecast: boolean;
}

/** Runs keyed by (action, i < nowIndex): split at nowIndex like the mockup. */
export function actionRuns(actions: readonly (Action | null)[], nowIndex: number): ActionRun[] {
  return runs(actions.length, (i) => `${actions[i] ?? 'null'}|${i < nowIndex ? 'p' : 'f'}`).map((r) => ({
    action: actions[r.start] ?? null,
    start: r.start,
    end: r.end,
    forecast: r.start >= nowIndex,
  }));
}

/** Position of [start, end) on a grid of `count` samples, in percent. */
export function boxPct(start: number, end: number, count: number): { left: number; width: number } {
  return { left: (start / count) * 100, width: ((end - start) / count) * 100 };
}
