// Rows of the "week program" card: one row per weekday, one bar per system with a program (pure).
import type { Program, Slot, SystemView, Weekday } from '../../../api/types';
import { WEEKDAYS } from '../../../api/types';
import { hhmmToMinutes, localParts } from '../../../lib/time';
import { kindSpec } from '../systemKinds';

export interface WeekBarSlot {
  leftPct: number;
  widthPct: number;
  fill: string;
  valueC: number | null;
  showValue: boolean;
}

export interface WeekBar {
  systemId: string;
  kind: string;
  variant: 'full' | 'thin';
  slots: WeekBarSlot[];
}

export interface WeekRow {
  day: Weekday;
  isToday: boolean;
  bars: WeekBar[];
}

/** A full bar shows the value of slots lasting at least this long. */
export const WEEK_VALUE_MIN_MINUTES = 180;

function slotValue(program: Program, slot: Slot): number | null {
  if (program.representation === 'levels') {
    return program.levels?.find((l) => l.id === slot.levelId)?.targetC ?? null;
  }
  if (program.representation === 'perSlot') return slot.targetC;
  return null;
}

/** `systems` in lane order; rows mon..sun. */
export function weekRows(systems: readonly SystemView[], todayIso: string, timeZone: string): WeekRow[] {
  const today = localParts(Date.parse(todayIso), timeZone).weekday;
  const withProgram = systems.filter((s) => s.program != null && s.program.representation !== 'none');
  return WEEKDAYS.map((day) => ({
    day,
    isToday: day === today,
    bars: withProgram.map((s) => {
      const program = s.program!;
      const spec = kindSpec(s.kind);
      const slots: WeekBarSlot[] = [];
      for (const slot of program.days[day]) {
        const from = hhmmToMinutes(slot.from);
        const to = hhmmToMinutes(slot.to);
        const valueC = slotValue(program, slot);
        const on = program.representation === 'onOff' ? slot.on : null;
        if (spec.weekBar === 'thin' && valueC == null && on !== true) continue;
        slots.push({
          leftPct: (from / 1440) * 100,
          widthPct: ((to - from) / 1440) * 100,
          fill: spec.programFill({ targetC: valueC, on }),
          valueC,
          showValue: spec.weekBar === 'full' && valueC != null && to - from >= WEEK_VALUE_MIN_MINUTES,
        });
      }
      return { systemId: s.id, kind: s.kind, variant: spec.weekBar, slots };
    }),
  }));
}
