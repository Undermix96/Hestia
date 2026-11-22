// Program helpers of the mock: slot lookup, values and the next program change (port of NS.js `nextChange`).
import type { NextProgramChange, Program, Slot, Weekday } from '../../types';
import { WEEKDAYS } from '../../types';
import { hhmmToMinutes, isoWithOffset, localParts, localToEpoch } from '../../../lib/time';
import type { MockGrid } from './neng/grid';
import type { MockSystemDef } from './scenarios/types';

/** Slot with from <= minute < to, or null (gap). */
export function slotAt(program: Program, weekday: Weekday, minuteOfDay: number): Slot | null {
  for (const s of program.days[weekday]) {
    if (hhmmToMinutes(s.from) <= minuteOfDay && minuteOfDay < hhmmToMinutes(s.to)) return s;
  }
  return null;
}

export function levelTarget(program: Program, levelId: string): number {
  const level = program.levels?.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);
  return level.targetC;
}

/** Program value of a slot: level target (levels), slot target (perSlot), null otherwise. */
export function slotTarget(program: Program, slot: Slot): number | null {
  if (program.representation === 'levels') return slot.levelId != null ? levelTarget(program, slot.levelId) : null;
  if (program.representation === 'perSlot') return slot.targetC;
  return null;
}

export function previousWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7]!;
}

export function nextWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7]!;
}

/** Slot that ends exactly where `slot` starts (same day, or the previous day's last slot ending at 24:00). */
function previousContiguous(program: Program, day: Weekday, index: number): Slot | null {
  const slots = program.days[day];
  const s = slots[index]!;
  if (index > 0) return slots[index - 1]!.to === s.from ? slots[index - 1]! : null;
  if (s.from !== '00:00') return null;
  const prev = program.days[previousWeekday(day)];
  const last = prev[prev.length - 1];
  return last && last.to === '24:00' ? last : null;
}

/** Slot that starts exactly where `slot` ends. */
function nextContiguous(program: Program, day: Weekday, index: number): Slot | null {
  const slots = program.days[day];
  const s = slots[index]!;
  if (index < slots.length - 1) return slots[index + 1]!.from === s.to ? slots[index + 1]! : null;
  if (s.to !== '24:00') return null;
  const first = program.days[nextWeekday(day)][0];
  return first && first.from === '00:00' ? first : null;
}

interface Candidate {
  ms: number;
  change: NextProgramChange['change'];
  targetC: number | null;
}

/**
 * First program change strictly after now and within 24 h, read from the program in force after now.
 * Slot starts of a contiguous program → 'target' (even when the value does not change, like the mockup);
 * a start after a gap → 'on'; an end followed by a gap → 'off'. Ties keep the first candidate (starts, then ends).
 */
export function nextChange(def: MockSystemDef, grid: MockGrid, programAfterNow: Program): NextProgramChange | null {
  const program = programAfterNow;
  if (program.representation === 'none') return null;
  if (def.behavior === 'mode_based' && def.mode === 'off') return null;
  const tz = grid.timeZone;
  const from = grid.nowMs;
  const until = from + 24 * 3_600_000;
  let best: Candidate | null = null;
  const consider = (c: Candidate) => {
    if (c.ms > from && c.ms <= until && (best == null || c.ms < best.ms)) best = c;
  };
  for (let offset = 0; offset <= 1; offset += 1) {
    const p = localParts(from + offset * 86_400_000, tz);
    const day = p.weekday;
    const slots = program.days[day];
    const at = (hhmm: string) => localToEpoch(p.year, p.month, p.day, hhmmToMinutes(hhmm), tz);
    const onOff = program.representation === 'onOff';
    slots.forEach((s, index) => {
      const prev = previousContiguous(program, day, index);
      if (onOff) {
        if (s.on === true && prev?.on !== true) consider({ ms: at(s.from), change: 'on', targetC: null });
        if (s.on !== true && prev?.on === true) consider({ ms: at(s.from), change: 'off', targetC: null });
      } else {
        consider({ ms: at(s.from), change: prev ? 'target' : 'on', targetC: slotTarget(program, s) });
      }
    });
    slots.forEach((s, index) => {
      const next = nextContiguous(program, day, index);
      if (onOff) {
        if (s.on === true && next == null) consider({ ms: at(s.to), change: 'off', targetC: null });
      } else if (next == null) consider({ ms: at(s.to), change: 'off', targetC: null });
    });
  }
  const found = best as Candidate | null;
  return found ? { at: isoWithOffset(found.ms, tz), change: found.change, targetC: found.targetC } : null;
}
