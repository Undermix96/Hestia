// Outdoor model of the mockup (Neng.js `setRange`), re-run for each range.
import type { OutdoorSeries } from '../../../types';
import type { MockGrid } from './grid';
import { rng } from './rng';

export interface OutdoorSim {
  T: number[];
  H: number[];
}

export function simulateOutdoor(grid: MockGrid, seed = 77): OutdoorSim {
  const g = rng(seed);
  const T: number[] = [];
  const H: number[] = [];
  const nowi = grid.nowIndex;
  for (let i = 0; i < grid.count; i += 1) {
    const h = grid.hourAt(i);
    const d = grid.dayOffsetAt(i);
    // Operand order kept exactly as in the mockup (bitwise parity with the oracle).
    const t = 6.5 + (d < 0 ? -d * 0.3 : 0) + 4.4 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (i < nowi ? (g() - 0.5) * 0.6 : 0);
    T.push(t);
    H.push(Math.min(97, 90 - (t - 3) * 2.3 + (i < nowi ? (g() - 0.5) * 4 : 0)));
  }
  return { T, H };
}

export function outdoorSeries(sim: OutdoorSim, nowIndex: number): OutdoorSeries {
  const past = <T>(v: T, i: number) => (i <= nowIndex ? v : null);
  const fut = <T>(v: T, i: number) => (i >= nowIndex ? v : null);
  return {
    measuredC: sim.T.map(past),
    forecastC: sim.T.map(fut),
    measuredHumidityPct: sim.H.map(past),
    forecastHumidityPct: sim.H.map(fut),
    nowC: sim.T[nowIndex] ?? null,
    nowHumidityPct: sim.H[nowIndex] ?? null,
  };
}
