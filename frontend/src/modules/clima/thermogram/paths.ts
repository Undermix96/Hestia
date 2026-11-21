// SVG path builders, ports of the string building in NS.js / T.js. Numbers use toFixed(1) and commands are
// concatenated exactly like the mockup, so paths are byte-identical to the oracle.
import type { OutdoorSeries, RoomClimateSeries, TargetSeries } from '../../../api/types';
import { ROOM_H, OUT_H, xCenter, xEdge, yMiniT, yOutH, yOutT, yRoomH, yRoomT, yTutteOutH, yTutteOutT } from './scales';

type Values = readonly (number | null)[];
type Scale = (v: number) => number;

/** Line through sample centres for i in [from, to]; a null value breaks the line (the next point starts with M). */
export function polyline(values: Values, y: Scale, from: number, to: number): string {
  const n = values.length;
  let d = '';
  let open = false;
  for (let i = Math.max(0, from); i <= to && i < n; i += 1) {
    const v = values[i];
    if (v == null) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${xCenter(i, n).toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  }
  return d;
}

/** Closes a line down to `baseY` (written as given, e.g. the integer 260). */
export function areaUnder(line: string, lastIndex: number, firstIndex: number, n: number, baseY: number): string {
  if (!line) return '';
  return `${line}L${xCenter(lastIndex, n).toFixed(1)} ${baseY}L${xCenter(firstIndex, n).toFixed(1)} ${baseY}Z`;
}

/** Step line of the target: one horizontal stroke per sample, across the whole sample width. */
export function stepPath(values: Values, y: Scale): string {
  const n = values.length;
  let d = '';
  let open = false;
  for (let q = 0; q < n; q += 1) {
    const v = values[q];
    if (v != null) {
      const yy = y(v).toFixed(1);
      d += `${open ? 'L' : 'M'}${xEdge(q, n).toFixed(1)} ${yy}L${xEdge(q + 1, n).toFixed(1)} ${yy}`;
      open = true;
    } else open = false;
  }
  return d;
}

/** Comfort band: for each run of non-null samples, top edge over `hi`, bottom edge over `lo` reversed, then Z. */
export function bandPath(lo: Values, hi: Values, y: Scale): string {
  const n = hi.length;
  let d = '';
  let run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    let top = '';
    let bottom = '';
    run.forEach((k, ii) => {
      const yy = y(hi[k]!).toFixed(1);
      top += `${ii ? 'L' : 'M'}${xEdge(k, n).toFixed(1)} ${yy}L${xEdge(k + 1, n).toFixed(1)} ${yy}`;
    });
    for (let z = run.length - 1; z >= 0; z -= 1) {
      const k = run[z]!;
      const yy = y(lo[k]!).toFixed(1);
      bottom += `L${xEdge(k + 1, n).toFixed(1)} ${yy}L${xEdge(k, n).toFixed(1)} ${yy}`;
    }
    d += `${top}${bottom}Z`;
    run = [];
  };
  for (let q = 0; q < n; q += 1) {
    if (hi[q] != null && lo[q] != null) run.push(q);
    else flush();
  }
  flush();
  return d;
}

/** a[i] ?? b[i] */
export function combine(a: Values, b: Values): (number | null)[] {
  const n = Math.max(a.length, b.length);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i += 1) out.push(a[i] ?? b[i] ?? null);
  return out;
}

export interface RoomChartPaths {
  past: string;
  forecast: string;
  humidityLine: string;
  humidityArea: string;
  target: string;
  band: string;
}

export function roomChartPaths(climate: RoomClimateSeries, target: TargetSeries, nowIndex: number): RoomChartPaths {
  const n = climate.measuredC.length;
  const humidityLine = polyline(combine(climate.measuredHumidityPct, climate.forecastHumidityPct), yRoomH, 0, n - 1);
  return {
    past: polyline(climate.measuredC, yRoomT, 0, nowIndex),
    forecast: polyline(climate.forecastC, yRoomT, nowIndex, n - 1),
    humidityLine,
    humidityArea: areaUnder(humidityLine, n - 1, 0, n, ROOM_H),
    target: stepPath(target.targetC, yRoomT),
    band: bandPath(target.comfortLowC, target.comfortHighC, yRoomT),
  };
}

export interface OutdoorChartPaths {
  temperature: string;
  humidity: string;
  humidityArea: string;
}

export function outdoorChartPaths(outdoor: OutdoorSeries, variant: 'stanza' | 'tutte'): OutdoorChartPaths {
  const n = outdoor.measuredC.length;
  const t = combine(outdoor.measuredC, outdoor.forecastC);
  const h = combine(outdoor.measuredHumidityPct, outdoor.forecastHumidityPct);
  if (variant === 'tutte') {
    return { temperature: polyline(t, yTutteOutT, 0, n - 1), humidity: polyline(h, yTutteOutH, 0, n - 1), humidityArea: '' };
  }
  const humidity = polyline(h, yOutH, 0, n - 1);
  return { temperature: polyline(t, yOutT, 0, n - 1), humidity, humidityArea: areaUnder(humidity, n - 1, 0, n, OUT_H) };
}

export interface MiniChartPaths {
  past: string;
  forecast: string;
  target: string;
  band: string;
}

/** Row chart of Tutte le stanze. */
export function miniChartPaths(climate: RoomClimateSeries, target: TargetSeries, nowIndex: number): MiniChartPaths {
  const n = climate.measuredC.length;
  return {
    past: polyline(climate.measuredC, yMiniT, 0, nowIndex),
    forecast: polyline(climate.forecastC, yMiniT, nowIndex, n - 1),
    target: stepPath(target.targetC, yMiniT),
    band: bandPath(target.comfortLowC, target.comfortHighC, yMiniT),
  };
}
