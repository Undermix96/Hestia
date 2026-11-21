// Helpers that turn the mockup's compact program lists into contract programs and systems (spec §4.5).
import type { Level, Mode, Program, Slot, WeekDays, Weekday } from '../../../types';
import { WEEKDAYS } from '../../../types';
import {
  adapterTypes,
  systemCapabilities,
  type CapabilityPreset,
  type DriverName,
} from './capabilities';
import type { MockBehavior, MockPowerDef, MockSystemDef } from './types';

/** Hours → 'HH:MM' (8.75 → '08:45', 24 → '24:00'). */
export function hm(hours: number): string {
  const total = Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

interface SlotValue {
  levelId?: string;
  targetC?: number;
  on?: boolean;
}

function slot(day: Weekday, index: number, from: number, to: number, value: SlotValue): Slot {
  return {
    from: hm(from),
    to: hm(to),
    levelId: value.levelId ?? null,
    targetC: value.targetC ?? null,
    on: value.on ?? null,
    ref: `${day}-${index}`,
  };
}

function valueOf(rep: 'levels' | 'perSlot', t: number, levelIdOf?: (t: number) => string): SlotValue {
  if (rep === 'perSlot') return { targetC: t };
  if (!levelIdOf) throw new Error('levels programs need levelIdOf');
  return { levelId: levelIdOf(t) };
}

/** Neng `rad` list [[startHour, targetC], ...] → full-coverage slots of one day; slot k = [start_k, start_{k+1}) (last → 24). */
export function fullDaySlots(
  day: Weekday,
  entries: [number, number][],
  rep: 'levels' | 'perSlot',
  levelIdOf?: (t: number) => string,
): Slot[] {
  return entries.map(([start, t], k) => slot(day, k, start, entries[k + 1]?.[0] ?? 24, valueOf(rep, t, levelIdOf)));
}

/** Neng `ac` list [[from, to, targetC], ...] → slots with gaps. */
export function gapDaySlots(
  day: Weekday,
  entries: [number, number, number][],
  rep: 'levels' | 'perSlot',
  levelIdOf?: (t: number) => string,
): Slot[] {
  return entries.map(([from, to, t], k) => slot(day, k, from, to, valueOf(rep, t, levelIdOf)));
}

/** [from, to] on-slots. */
export function onOffDaySlots(day: Weekday, entries: [number, number][]): Slot[] {
  return entries.map(([from, to], k) => slot(day, k, from, to, { on: true }));
}

export function week(build: (day: Weekday) => Slot[]): WeekDays {
  const days = {} as WeekDays;
  for (const d of WEEKDAYS) days[d] = build(d);
  return days;
}

export function isWeekend(day: Weekday): boolean {
  return day === 'sat' || day === 'sun';
}

/** Weekend variant used by perSlot: a slot starting at 06:00 starts at 07:30 and the previous slot ends at 07:30. */
export function weekendShift(entries: [number, number][]): [number, number][] {
  return entries.map(([start, t]): [number, number] => [start === 6 ? 7.5 : start, t]);
}

/** Same shift for gap lists: a slot starting at 06:00 starts at 07:30. */
export function weekendShiftGaps(entries: [number, number, number][]): [number, number, number][] {
  return entries.map(([from, to, t]): [number, number, number] => [from === 6 ? 7.5 : from, to, t]);
}

export function level(id: string, targetC: number): Level {
  return { id, label: null, labelKey: `mock.level.${id}`, targetC };
}

function levelIdOf(levels: Level[]): (t: number) => string {
  return (t) => {
    const found = levels.find((l) => l.targetC === t);
    if (!found) throw new Error(`No level with target ${t}`);
    return found.id;
  };
}

export const MOCK_PROGRAM_VERSION = 'mock-1';

export function noProgram(): Program {
  return { representation: 'none', levels: null, days: week(() => []), version: MOCK_PROGRAM_VERSION };
}

/** Compact description of one heating/cooling system of the mock houses. */
export interface HouseSystemSpec {
  id: string;
  kind: 'radiator' | 'ac';
  roomIds: string[];
  /** level ids and their targets, e.g. [['eco', 18.5], ['comfort', 21]] */
  levels: [string, number][];
  /** full-coverage program (radiators): [[startHour, targetC], ...] */
  full?: [number, number][];
  /** program with gaps (splits): [[from, to, targetC], ...] */
  gaps?: [number, number, number][];
  power?: MockPowerDef;
}

export interface HouseVariant {
  representation: 'levels' | 'perSlot' | 'none';
  preset: CapabilityPreset;
  /** perSlot scenario: sat/sun slots starting at 06:00 start at 07:30 */
  weekendShift?: boolean;
  /** representation 'none' only */
  constantTargetC?: number;
  /** mode of mode-based systems (default 'heat') */
  mode?: Mode;
}

function programOf(spec: HouseSystemSpec, variant: HouseVariant): Program {
  if (variant.representation === 'none') return noProgram();
  const rep = variant.representation;
  const levels = spec.levels.map(([id, t]) => level(id, t));
  const idOf = rep === 'levels' ? levelIdOf(levels) : undefined;
  const days = week((day) => {
    const shift = variant.weekendShift === true && isWeekend(day);
    if (spec.full) return fullDaySlots(day, shift ? weekendShift(spec.full) : spec.full, rep, idOf);
    if (spec.gaps) return gapDaySlots(day, shift ? weekendShiftGaps(spec.gaps) : spec.gaps, rep, idOf);
    return [];
  });
  return { representation: rep, levels: rep === 'levels' ? levels : null, days, version: MOCK_PROGRAM_VERSION };
}

export function houseSystem(spec: HouseSystemSpec, variant: HouseVariant): MockSystemDef {
  const driver: DriverName = spec.kind;
  const behavior: MockBehavior = spec.kind === 'radiator' ? 'always_on_target' : 'mode_based';
  const hasPower = spec.power != null;
  return {
    id: spec.id,
    kind: spec.kind,
    name: null,
    nameKey: null,
    roomIds: [...spec.roomIds],
    behavior,
    hysteresis: { belowC: 0.3, aboveC: 0.2 },
    mode: behavior === 'mode_based' ? (variant.mode ?? 'heat') : null,
    program: programOf(spec, variant),
    constantTargetC: variant.representation === 'none' ? (variant.constantTargetC ?? null) : null,
    capabilities: systemCapabilities(variant.preset, driver, hasPower),
    adapters: adapterTypes(driver, variant.preset, hasPower),
    power: spec.power ? { ...spec.power } : null,
  };
}
