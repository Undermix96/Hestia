// Builds the OverrideCreate drafts of the slot editor (spec §5.7). Every OverrideChange field not used is null
// (the contract has no optional fields).
import type {
  OverrideCapabilities,
  OverrideChange,
  OverrideCreate,
  Program,
  ProgramSegment,
  RoomTimeline,
  SystemView,
  Weekday,
} from '../../../api/types';
import { WEEKDAYS } from '../../../api/types';
import { hhmmToMinutes, minutesToHhmm } from '../../../lib/time';
import type { EditorOption } from '../types';

export interface DraftContext {
  segment: ProgramSegment;
  system: SystemView;
  /** reference value of the option: level target (permanentValue on levels), else segment.programmedTargetC */
  programmedC: number | null;
  /** value of a committed override with the same scope on this slot occurrence (slot scope), else null */
  committedC: number | null;
}

export interface ValueBounds {
  min: number;
  max: number;
  step: number;
}

const NULL_CHANGE: OverrideChange = { deltaC: null, targetC: null, levelValueC: null, from: null, to: null, days: null };

function round6(v: number): number {
  return Number(v.toFixed(6));
}

/** Builds the draft context of a segment of a timeline for an editor option. */
export function draftContext(
  tl: RoomTimeline,
  systemId: string,
  segment: ProgramSegment,
  option: EditorOption,
): DraftContext {
  const system = tl.systems.find((s) => s.id === systemId);
  if (!system) throw new Error(`No system ${systemId} in the timeline`);
  let programmedC = segment.programmedTargetC;
  if (option === 'permanentValue' && system.program?.representation === 'levels' && segment.levelId != null) {
    programmedC = system.program.levels?.find((l) => l.id === segment.levelId)?.targetC ?? programmedC;
  }
  let committedC: number | null = null;
  if (option === 'slot') {
    const o = tl.overrides.find(
      (x) => x.systemId === system.id && x.day === segment.day && x.slotRef === segment.slotRef && x.scope === 'slot',
    );
    if (o) committedC = o.change.targetC ?? (programmedC != null ? programmedC + (o.change.deltaC ?? 0) : null);
  }
  return { segment, system, programmedC, committedC };
}

export function valueBounds(programmedC: number, caps: OverrideCapabilities): ValueBounds {
  return { min: round6(programmedC + caps.minDelta), max: round6(programmedC + caps.maxDelta), step: caps.step };
}

/** current + delta, clamped to the bounds and rounded to the step grid (anchored at min). */
export function stepValue(current: number, delta: number, bounds: ValueBounds): number {
  const raw = current + delta;
  const snapped = bounds.min + Math.round((raw - bounds.min) / bounds.step) * bounds.step;
  return round6(Math.max(bounds.min, Math.min(bounds.max, snapped)));
}

export interface TimeBounds {
  fromMin: number;
  fromMax: number;
  toMin: number;
  toMax: number;
  fixedFrom: boolean;
  fixedTo: boolean;
}

function isFullCoverage(program: Program, day: Weekday): boolean {
  const slots = program.days[day];
  if (!slots.length || slots[0]!.from !== '00:00' || slots[slots.length - 1]!.to !== '24:00') return false;
  return slots.every((s, i) => i === 0 || slots[i - 1]!.to === s.from);
}

/**
 * Bounds (minutes) of the times of a slot. Full-coverage days keep the first slot at 00:00 and the last at 24:00
 * and never swallow a neighbour; gap days never overlap one. `current` are the times being edited (default: the
 * program's), used for the from < to constraint.
 */
export function timeBounds(
  program: Program,
  day: Weekday,
  slotRef: string,
  minuteStep: number,
  current?: { from: string; to: string },
): TimeBounds {
  const slots = program.days[day];
  const i = slots.findIndex((s) => s.ref === slotRef);
  if (i < 0) throw new Error(`Unknown slot ${slotRef} on ${day}`);
  const slot = slots[i]!;
  const from = hhmmToMinutes(current?.from ?? slot.from);
  const to = hhmmToMinutes(current?.to ?? slot.to);
  const prev = slots[i - 1];
  const next = slots[i + 1];
  if (isFullCoverage(program, day)) {
    const fixedFrom = i === 0;
    const fixedTo = i === slots.length - 1;
    return {
      fromMin: fixedFrom ? 0 : hhmmToMinutes(prev!.from) + minuteStep,
      fromMax: fixedFrom ? 0 : to - minuteStep,
      toMin: fixedTo ? 1440 : from + minuteStep,
      toMax: fixedTo ? 1440 : hhmmToMinutes(next!.to) - minuteStep,
      fixedFrom,
      fixedTo,
    };
  }
  return {
    fromMin: prev ? hhmmToMinutes(prev.to) : 0,
    fromMax: to - minuteStep,
    toMin: from + minuteStep,
    toMax: next ? hhmmToMinutes(next.from) : 1440,
    fixedFrom: false,
    fixedTo: false,
  };
}

function base(ctx: DraftContext, scope: OverrideCreate['scope'], change: Partial<OverrideChange>): OverrideCreate | null {
  const { segment } = ctx;
  if (segment.slotRef == null || segment.day == null) return null;
  return {
    systemId: ctx.system.id,
    slotRef: segment.slotRef,
    day: segment.day,
    scope,
    change: { ...NULL_CHANGE, ...change },
    validUntil: null,
  };
}

/** Draft for a value option; null when the value equals the value in force (committed override or program). */
export function draftForValue(ctx: DraftContext, option: 'slot' | 'permanentValue', valueC: number): OverrideCreate | null {
  const reference = option === 'slot' ? (ctx.committedC ?? ctx.programmedC) : ctx.programmedC;
  if (reference != null && Math.abs(valueC - reference) < 1e-9) return null;
  if (option === 'slot') return base(ctx, 'slot', { targetC: valueC });
  if (ctx.system.program?.representation === 'levels') return base(ctx, 'permanentValue', { levelValueC: valueC });
  return base(ctx, 'permanentValue', { targetC: valueC });
}

/** The committed times of the segment's slot (from SystemView.program, which never includes the draft). */
export function committedTimes(ctx: DraftContext): { from: string; to: string } | null {
  const { segment, system } = ctx;
  if (!system.program || segment.day == null || segment.slotRef == null) return null;
  const slot = system.program.days[segment.day].find((s) => s.ref === segment.slotRef);
  return slot ? { from: slot.from, to: slot.to } : null;
}

/** Draft for new slot times; null when unchanged. */
export function draftForTimes(ctx: DraftContext, from: string, to: string): OverrideCreate | null {
  const committed = committedTimes(ctx);
  const f = minutesToHhmm(hhmmToMinutes(from));
  const t = minutesToHhmm(hhmmToMinutes(to));
  if (committed && committed.from === f && committed.to === t) return null;
  const day = ctx.segment.day;
  if (day == null) return null;
  const days = ctx.system.capabilities.program.dayScope === 'all' ? [...WEEKDAYS] : [day];
  return base(ctx, 'permanentTimes', { from: f, to: t, days });
}

/** Value the editor shows: the draft's, else the value in force. */
export function currentDraftValue(ctx: DraftContext, draft: OverrideCreate | null): number {
  const fallback = ctx.committedC ?? ctx.programmedC ?? ctx.segment.targetC ?? 0;
  if (!draft) return fallback;
  const c = draft.change;
  if (draft.scope === 'slot') return c.targetC ?? (ctx.programmedC ?? 0) + (c.deltaC ?? 0);
  if (draft.scope === 'permanentValue') return c.levelValueC ?? c.targetC ?? fallback;
  return fallback;
}

/** Times the editor shows: the draft's, else the committed ones. */
export function currentDraftTimes(ctx: DraftContext, draft: OverrideCreate | null): { from: string; to: string } | null {
  if (draft?.scope === 'permanentTimes' && draft.change.from != null && draft.change.to != null) {
    return { from: draft.change.from, to: draft.change.to };
  }
  return committedTimes(ctx);
}
