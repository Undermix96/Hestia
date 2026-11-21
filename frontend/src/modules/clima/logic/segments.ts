// Program segments of a lane: one run of one slot occurrence with one effective value (pure).
import type { ProgramSegment, SegmentState, SystemLane, Weekday } from '../../../api/types';
import type { SegmentSelection } from '../types';
import { runs } from './runs';

/** One occurrence of a program slot on a concrete local date. */
export interface SlotOccurrence {
  day: Weekday;
  ref: string;
  from: string;
  to: string;
  levelId: string | null;
  startMs: number;
  endMs: number;
}

export interface BuildSegmentsInput {
  systemId: string;
  count: number;
  nowIndex: number;
  t: readonly string[];
  end: string;
  slot: readonly (SlotOccurrence | null)[];
  target: readonly (number | null)[];
  on: readonly (boolean | null)[];
  programmedTarget: readonly (number | null)[];
  overrideId: readonly (string | null)[];
  draft: readonly boolean[];
}

export function segmentState(start: number, end: number, nowIndex: number): SegmentState {
  if (end <= nowIndex) return 'past';
  if (start <= nowIndex) return 'current';
  return 'future';
}

function sampleKey(input: BuildSegmentsInput, i: number): string {
  const s = input.slot[i];
  if (!s) return 'gap';
  const t = input.target[i];
  const value = t != null ? t.toFixed(2) : String(input.on[i] ?? 'x');
  // Slot times are part of the key: a permanent times change splits the current occurrence at now.
  return `${s.day}|${s.ref}|${s.from}-${s.to}|${value}`;
}

export function buildSegments(input: BuildSegmentsInput): ProgramSegment[] {
  return runs(input.count, (i) => sampleKey(input, i)).map((r) => {
    const s = input.slot[r.start] ?? null;
    const state = segmentState(r.start, r.end, input.nowIndex);
    let overrideId: string | null = null;
    let touched = false;
    for (let i = r.start; i < r.end; i += 1) {
      const id = input.overrideId[i] ?? null;
      if (id != null && overrideId == null) overrideId = id;
      if (id != null || input.draft[i]) touched = true;
    }
    return {
      key: `${input.systemId}|${s?.day ?? 'gap'}|${s?.ref ?? 'gap'}|${r.start}`,
      startIndex: r.start,
      endIndex: r.end,
      start: input.t[r.start] ?? input.end,
      end: r.end >= input.count ? input.end : (input.t[r.end] ?? input.end),
      slotRef: s?.ref ?? null,
      day: s?.day ?? null,
      slotFrom: s?.from ?? null,
      slotTo: s?.to ?? null,
      levelId: s?.levelId ?? null,
      targetC: input.target[r.start] ?? null,
      programmedTargetC: input.programmedTarget[r.start] ?? null,
      on: input.on[r.start] ?? null,
      state,
      edited: touched && state !== 'past',
      overrideId,
    };
  });
}

/**
 * The segment a selection points to. A draft can split the selected slot occurrence at nowIndex (past part
 * unchanged), which changes segment keys, so the lookup falls back to (systemId, day, slotRef) on a non-past segment.
 */
export function findSelectedSegment(lane: SystemLane, selection: SegmentSelection): ProgramSegment | null {
  if (lane.systemId !== selection.systemId) return null;
  const byKey = lane.segments.find((s) => s.key === selection.segmentKey && s.state !== 'past');
  if (byKey) return byKey;
  return (
    lane.segments.find((s) => s.state !== 'past' && s.day === selection.day && s.slotRef === selection.slotRef) ?? null
  );
}
