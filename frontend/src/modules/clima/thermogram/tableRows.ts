// Rows of the accessible data table behind the thermogram.
import type { Action, RoomTimeline } from '../../../api/types';
import { cursorPhase, type CursorPhase } from '../logic/cursor';
import { sampleAt } from './samples';

export interface TableRow {
  index: number;
  iso: string;
  phase: CursorPhase;
  temperatureC: number | null;
  humidityPct: number | null;
  targetC: number | null;
  /** one per lane, lane order */
  actions: (Action | null)[];
}

/** Every sample in 24h; every 4th sample (2 h) plus nowIndex in 7d. */
export function tableRows(tl: RoomTimeline): TableRow[] {
  const { count, nowIndex, t, range } = tl.grid;
  const rows: TableRow[] = [];
  for (let i = 0; i < count; i += 1) {
    if (range === '7d' && i % 4 !== 0 && i !== nowIndex) continue;
    rows.push({
      index: i,
      iso: t[i]!,
      phase: cursorPhase(i, nowIndex),
      temperatureC: sampleAt(tl.climate.measuredC, tl.climate.forecastC, i),
      humidityPct: sampleAt(tl.climate.measuredHumidityPct, tl.climate.forecastHumidityPct, i),
      targetC: tl.target.targetC[i] ?? null,
      actions: tl.lanes.map((l) => l.action[i] ?? null),
    });
  }
  return rows;
}
