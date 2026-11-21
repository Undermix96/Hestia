import { describe, expect, it } from 'vitest';
import { actionRuns, boxPct, runs } from '../../src/modules/clima/logic/runs';

describe('runs', () => {
  it('empty input', () => {
    expect(runs(0, () => 'a')).toEqual([]);
  });

  it('single run', () => {
    expect(runs(3, () => 'a')).toEqual([{ value: 'a', start: 0, end: 3 }]);
  });

  it('alternating values', () => {
    const v = ['a', 'b', 'a', 'a', 'b'];
    expect(runs(v.length, (i) => v[i])).toEqual([
      { value: 'a', start: 0, end: 1 },
      { value: 'b', start: 1, end: 2 },
      { value: 'a', start: 2, end: 4 },
      { value: 'b', start: 4, end: 5 },
    ]);
  });

  it('custom equality', () => {
    const v = [1, 1.01, 2];
    expect(runs(3, (i) => v[i]!, (a, b) => Math.abs(a - b) < 0.1).map((r) => [r.start, r.end])).toEqual([
      [0, 2],
      [2, 3],
    ]);
  });
});

describe('actionRuns', () => {
  it('splits at nowIndex even when the action does not change', () => {
    expect(actionRuns(['heat', 'heat', 'heat', 'idle', null], 2)).toEqual([
      { action: 'heat', start: 0, end: 2, forecast: false },
      { action: 'heat', start: 2, end: 3, forecast: true },
      { action: 'idle', start: 3, end: 4, forecast: true },
      { action: null, start: 4, end: 5, forecast: true },
    ]);
  });
});

describe('boxPct', () => {
  it('percent of the grid', () => {
    expect(boxPct(13, 26, 52)).toEqual({ left: 25, width: 25 });
  });
});
