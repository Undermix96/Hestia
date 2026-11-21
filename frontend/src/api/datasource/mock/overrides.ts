// Stored changes of the mock and their validation (spec §4.7). Mirrors the editor matrix of
// logic/editorOptions.ts, so the editor can never produce a draft the mock rejects.
import type { Override, OverrideChange, OverrideCreate, Program, Slot, Weekday } from '../../types';
import { WEEKDAYS } from '../../types';
import { hhmmToMinutes, minutesToHhmm } from '../../../lib/time';
import type { MockGrid } from './neng/grid';
import { isFullCoverage, slotTarget } from './programs';
import type { MockSystemDef } from './scenarios/types';

export interface StoredChange {
  override: Override;
  body: OverrideCreate;
}

const EPS = 1e-9;
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function isPermanent(body: OverrideCreate): boolean {
  return body.scope === 'permanentValue' || body.scope === 'permanentTimes';
}

/** Changes with the same key replace each other. */
export function sameKey(a: OverrideCreate, b: OverrideCreate): boolean {
  return a.systemId === b.systemId && a.day === b.day && a.slotRef === b.slotRef && a.scope === b.scope;
}

type ChangeField = keyof OverrideChange;
const FIELDS: readonly ChangeField[] = ['deltaC', 'targetC', 'levelValueC', 'from', 'to', 'days'];

function onlyFields(change: OverrideChange, allowed: readonly ChangeField[]): string | null {
  for (const f of FIELDS) if (!allowed.includes(f) && change[f] != null) return `change.${f} is not allowed for this scope`;
  return null;
}

function withinBounds(value: number, base: number, sys: MockSystemDef): string | null {
  const { minDelta, maxDelta, step } = sys.capabilities.override;
  const delta = value - base;
  if (delta < minDelta - EPS || delta > maxDelta + EPS) return `value ${value} outside ${base}${minDelta}..+${maxDelta}`;
  const steps = delta / step;
  if (Math.abs(steps - Math.round(steps)) > EPS) return `value ${value} is not a multiple of ${step} from ${base}`;
  return null;
}

function slotIndex(program: Program, day: Weekday, ref: string): number {
  return program.days[day].findIndex((s) => s.ref === ref);
}

/** Index of the slot on `day` that matches the source slot (same ref, else same times, else same index). */
function matchingIndex(program: Program, day: Weekday, source: Slot, sourceIndex: number): number {
  const slots = program.days[day];
  const byRef = slots.findIndex((s) => s.ref === source.ref);
  if (byRef >= 0) return byRef;
  const byTimes = slots.findIndex((s) => s.from === source.from && s.to === source.to);
  if (byTimes >= 0) return byTimes;
  return sourceIndex < slots.length ? sourceIndex : -1;
}

function targetDays(body: OverrideCreate, sys: MockSystemDef): Weekday[] {
  if (sys.capabilities.program.dayScope === 'all') return [...WEEKDAYS];
  return body.change.days ?? [body.day];
}

function validateTimes(slots: readonly Slot[], index: number, fromMin: number, toMin: number, minuteStep: number): string | null {
  if (toMin - fromMin < minuteStep) return 'the slot must last at least one minute step';
  const prev = slots[index - 1];
  const next = slots[index + 1];
  if (isFullCoverage(slots)) {
    if (index === 0 && fromMin !== 0) return 'the first slot must start at 00:00';
    if (index === slots.length - 1 && toMin !== 1440) return 'the last slot must end at 24:00';
    if (prev && fromMin <= hhmmToMinutes(prev.from)) return 'the slot would swallow the previous slot';
    if (next && toMin >= hhmmToMinutes(next.to)) return 'the slot would swallow the next slot';
  } else {
    if (prev && fromMin < hhmmToMinutes(prev.to)) return 'the slot overlaps the previous slot';
    if (next && toMin > hhmmToMinutes(next.from)) return 'the slot overlaps the next slot';
  }
  return null;
}

/**
 * Validates a change against the system and its program in force (committed permanent changes applied).
 * Returns an error message (English, for developers) or null.
 */
export function validateChange(body: OverrideCreate, sys: MockSystemDef, program: Program, grid: MockGrid): string | null {
  const caps = sys.capabilities;
  const rep = program.representation;
  if (body.systemId !== sys.id) return 'systemId mismatch';
  if (!WEEKDAYS.includes(body.day)) return `unknown day ${String(body.day)}`;
  if (!caps.program.read || rep === 'none') return 'the system has no readable program';
  const index = slotIndex(program, body.day, body.slotRef);
  if (index < 0) return `unknown slot ${body.slotRef} on ${body.day}`;
  const slot = program.days[body.day][index]!;
  if (body.validUntil != null) return 'validUntil is only allowed for scope until';
  const nowParts = grid.partsAt(grid.nowIndex);
  const nowMinute = nowParts.hour * 60 + nowParts.minute;
  const isToday = body.day === nowParts.weekday;
  const fromMin = hhmmToMinutes(slot.from);
  const toMin = hhmmToMinutes(slot.to);
  const c = body.change;

  switch (body.scope) {
    case 'until':
      return 'scope until is not offered in M1';
    case 'slot': {
      if (!caps.override.scopes.includes('slot')) return 'slot overrides are not supported';
      if (rep !== 'levels' && rep !== 'perSlot') return 'slot overrides need a valued program';
      if (!isToday || fromMin > nowMinute || nowMinute >= toMin) return 'slot overrides apply to the current slot only';
      const bad = onlyFields(c, ['targetC', 'deltaC']);
      if (bad) return bad;
      if ((c.targetC == null) === (c.deltaC == null)) return 'exactly one of targetC / deltaC is required';
      const programmed = slotTarget(program, slot);
      if (programmed == null) return 'the slot has no value';
      return withinBounds(c.targetC ?? programmed + (c.deltaC ?? 0), programmed, sys);
    }
    case 'permanentValue': {
      if (isToday && toMin <= nowMinute) return 'the slot has already ended';
      if (rep === 'levels') {
        if (!caps.program.writeLevelValues) return 'level values are read-only';
        const bad = onlyFields(c, ['levelValueC']);
        if (bad) return bad;
        if (c.levelValueC == null) return 'levelValueC is required';
        const programmed = slotTarget(program, slot);
        if (programmed == null) return 'the slot has no level';
        return withinBounds(c.levelValueC, programmed, sys);
      }
      if (rep === 'perSlot') {
        if (!caps.program.writeSlotValue) return 'slot values are read-only';
        const bad = onlyFields(c, ['targetC']);
        if (bad) return bad;
        if (c.targetC == null) return 'targetC is required';
        return withinBounds(c.targetC, slot.targetC ?? 0, sys);
      }
      return 'this program has no values to change';
    }
    case 'permanentTimes': {
      if (!caps.program.writeTimes) return 'slot times are read-only';
      if (isToday && toMin <= nowMinute) return 'the slot has already ended';
      const bad = onlyFields(c, ['from', 'to', 'days']);
      if (bad) return bad;
      if (c.from == null || c.to == null) return 'from and to are required';
      if (!HHMM.test(c.from) || !HHMM.test(c.to) || c.from === '24:00') return 'invalid time';
      const newFrom = hhmmToMinutes(c.from);
      const newTo = hhmmToMinutes(c.to);
      const step = caps.program.minuteStep;
      // A changed edge must be on the minute grid; an unchanged one may keep an off-grid time (e.g. 08:45).
      if ((newFrom !== fromMin && newFrom % step !== 0) || (newTo !== toMin && newTo % step !== 0)) {
        return `changed times must be multiples of ${step} minutes`;
      }
      if (newFrom >= newTo) return 'from must be before to';
      if (c.days != null && c.days.some((d) => !WEEKDAYS.includes(d))) return 'unknown day in days';
      for (const d of targetDays(body, sys)) {
        const i = matchingIndex(program, d, slot, index);
        if (i < 0) return `no matching slot on ${d}`;
        const err = validateTimes(program.days[d], i, newFrom, newTo, step);
        if (err) return `${d}: ${err}`;
      }
      return null;
    }
    default:
      return 'unknown scope';
  }
}

function bumpVersion(version: string): string {
  const m = /^mock-(\d+)$/.exec(version);
  return `mock-${m ? Number(m[1]) + 1 : 2}`;
}

/** Applies a permanent change to a program (returns a new program; the input is not modified). */
export function applyPermanent(program: Program, change: OverrideCreate, sys: MockSystemDef): Program {
  const next: Program = structuredClone(program);
  const index = slotIndex(next, change.day, change.slotRef);
  if (index < 0) return next;
  const source = { ...next.days[change.day][index]! };
  const c = change.change;
  if (change.scope === 'permanentValue') {
    if (next.representation === 'levels' && c.levelValueC != null) {
      const level = next.levels?.find((l) => l.id === source.levelId);
      if (level) level.targetC = c.levelValueC;
    } else if (next.representation === 'perSlot' && c.targetC != null) {
      next.days[change.day][index]!.targetC = c.targetC;
    }
  } else if (change.scope === 'permanentTimes' && c.from != null && c.to != null) {
    for (const d of targetDays(change, sys)) {
      const slots = next.days[d];
      const i = matchingIndex(program, d, source, index);
      const s = slots[i];
      if (!s) continue;
      const full = isFullCoverage(slots);
      s.from = minutesToHhmm(hhmmToMinutes(c.from));
      s.to = minutesToHhmm(hhmmToMinutes(c.to));
      if (full) {
        const prev = slots[i - 1];
        const after = slots[i + 1];
        if (prev) prev.to = s.from;
        if (after) after.from = s.to;
      }
    }
  } else {
    return next;
  }
  next.version = bumpVersion(program.version);
  return next;
}

/** Base program with the given permanent changes applied in order. */
export function effectiveProgram(base: Program, changes: readonly OverrideCreate[], sys: MockSystemDef): Program {
  let program = base;
  for (const c of changes) if (c.systemId === sys.id && isPermanent(c)) program = applyPermanent(program, c, sys);
  return program;
}
