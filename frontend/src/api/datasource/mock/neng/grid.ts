// Sample grid of the mock (port of Neng.js `setRange`), with real local time per sample.
import type { TimeGrid, TimeRange, Weekday } from '../../../types';
import { hourOfDay, isoWithOffset, localDayIndex, localParts, minuteOfDay, type LocalParts } from '../../../../lib/time';

export const STEP_MINUTES = 30;
export const WARMUP = 96;
const STEP_MS = STEP_MINUTES * 60_000;

export interface MockGrid {
  range: TimeRange;
  count: number;
  nowIndex: number;
  stepMinutes: 30;
  /** epoch ms of sample 0 */
  startMs: number;
  /** epoch ms of clock.now (start of sample nowIndex) */
  nowMs: number;
  /** samples simulated before sample 0 */
  warmup: 96;
  timeZone: string;
  /** epoch ms of sample k, k in [-96, count) */
  msAt(k: number): number;
  /** local parts of sample k */
  partsAt(k: number): LocalParts;
  /** local hour + minute / 60 (the mockup's `hAt`) */
  hourAt(k: number): number;
  minuteOfDayAt(k: number): number;
  weekdayAt(k: number): Weekday;
  /** local calendar days between sample k and the local date of now (the mockup's `dAt`) */
  dayOffsetAt(k: number): number;
}

const SHAPE: Record<TimeRange, { past: number; future: number }> = {
  '24h': { past: 48, future: 4 },
  '7d': { past: 336, future: 24 },
};

export function buildGrid(range: TimeRange, nowIso: string, timeZone: string): MockGrid {
  const { past, future } = SHAPE[range];
  const count = past + future;
  const nowIndex = past;
  const nowMs = Date.parse(nowIso);
  const msAt = (k: number) => nowMs + (k - nowIndex) * STEP_MS;
  const parts: LocalParts[] = [];
  for (let k = -WARMUP; k < count; k += 1) parts.push(localParts(msAt(k), timeZone));
  const nowDay = localDayIndex(localParts(nowMs, timeZone));
  const partsAt = (k: number): LocalParts => {
    const p = parts[k + WARMUP];
    if (!p) throw new RangeError(`Sample ${k} outside the grid`);
    return p;
  };
  return {
    range,
    count,
    nowIndex,
    stepMinutes: STEP_MINUTES,
    startMs: msAt(0),
    nowMs,
    warmup: WARMUP,
    timeZone,
    msAt,
    partsAt,
    hourAt: (k) => hourOfDay(partsAt(k)),
    minuteOfDayAt: (k) => minuteOfDay(partsAt(k)),
    weekdayAt: (k) => partsAt(k).weekday,
    dayOffsetAt: (k) => localDayIndex(partsAt(k)) - nowDay,
  };
}

/** Contract view of the grid: every sample carries its ISO timestamp with offset. */
export function timeGrid(grid: MockGrid): TimeGrid {
  const t: string[] = [];
  for (let i = 0; i < grid.count; i += 1) t.push(isoWithOffset(grid.msAt(i), grid.timeZone));
  return {
    range: grid.range,
    stepMinutes: grid.stepMinutes,
    count: grid.count,
    nowIndex: grid.nowIndex,
    t,
    end: isoWithOffset(grid.msAt(grid.count), grid.timeZone),
  };
}
