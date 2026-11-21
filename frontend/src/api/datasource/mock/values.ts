// Effective program value of every system at every sample: program, permanent changes, slot overrides, draft.
import type { OverrideCreate, Program, Slot } from '../../types';
import { localToEpoch } from '../../../lib/time';
import type { SlotOccurrence } from '../../../modules/clima/logic/segments';
import type { MockGrid } from './neng/grid';
import type { SampleValue, SimSystemInput } from './neng/simulate';
import { applyPermanent, effectiveProgram, isPermanent, sameKey, type StoredChange } from './overrides';
import { slotAt, slotTarget } from './programs';
import type { MockSystemDef } from './scenarios/types';

/** One change in force for the preview: committed (with its id) or the draft (id null). */
interface ActiveChange {
  id: string | null;
  body: OverrideCreate;
}

export interface SystemPrograms {
  /** base program with the committed permanent changes (what SystemView.program shows) */
  committed: Program;
  /** committed + draft permanent changes: the program in force after now in this computation */
  preview: Program;
}

export interface SystemValues extends SimSystemInput {
  programs: SystemPrograms;
}

/** Committed changes with the draft replacing the one with the same key (or appended). */
export function activeChanges(committed: readonly StoredChange[], draft: OverrideCreate | null): ActiveChange[] {
  const out: ActiveChange[] = [];
  let placed = false;
  for (const c of committed) {
    if (draft && sameKey(c.body, draft)) {
      out.push({ id: null, body: draft });
      placed = true;
    } else out.push({ id: c.override.id, body: c.body });
  }
  if (draft && !placed) out.push({ id: null, body: draft });
  return out;
}

interface RawValue {
  targetC: number | null;
  on: boolean | null;
  slot: SlotOccurrence | null;
}

function sameValue(a: RawValue, b: RawValue): boolean {
  return (
    a.targetC === b.targetC &&
    a.on === b.on &&
    a.slot?.ref === b.slot?.ref &&
    a.slot?.from === b.slot?.from &&
    a.slot?.to === b.slot?.to
  );
}

export function systemValues(
  def: MockSystemDef,
  grid: MockGrid,
  committed: readonly StoredChange[],
  draft: OverrideCreate | null,
): SystemValues {
  const own = activeChanges(
    committed.filter((c) => c.body.systemId === def.id),
    draft && draft.systemId === def.id ? draft : null,
  );
  const base = def.program;
  const committedProgram = effectiveProgram(
    base,
    committed.filter((c) => c.body.systemId === def.id).map((c) => c.body),
    def,
  );
  // Prefix programs: steps[j] = base with the first j permanent changes applied.
  const permanents = own.filter((c) => isPermanent(c.body));
  const steps: Program[] = [base];
  for (const c of permanents) steps.push(applyPermanent(steps[steps.length - 1]!, c.body, def));
  const preview = steps[steps.length - 1]!;
  const slotOverrides = own.filter((c) => c.body.scope === 'slot');

  const occurrences = new Map<string, SlotOccurrence>();
  const occurrence = (k: number, slot: Slot): SlotOccurrence => {
    const p = grid.partsAt(k);
    const key = `${p.year}-${p.month}-${p.day}|${slot.ref}|${slot.from}|${slot.to}|${slot.levelId ?? ''}`;
    let occ = occurrences.get(key);
    if (!occ) {
      const [fh, fm] = slot.from.split(':').map(Number) as [number, number];
      const [th, tm] = slot.to.split(':').map(Number) as [number, number];
      occ = {
        day: p.weekday,
        ref: slot.ref,
        from: slot.from,
        to: slot.to,
        levelId: slot.levelId,
        startMs: localToEpoch(p.year, p.month, p.day, fh * 60 + fm, grid.timeZone),
        endMs: localToEpoch(p.year, p.month, p.day, th * 60 + tm, grid.timeZone),
      };
      occurrences.set(key, occ);
    }
    return occ;
  };

  const raw = (program: Program, k: number): RawValue => {
    const p = grid.partsAt(k);
    const slot = slotAt(program, p.weekday, p.hour * 60 + p.minute);
    if (!slot) return { targetC: null, on: null, slot: null };
    return {
      targetC: slotTarget(program, slot),
      on: program.representation === 'onOff' ? slot.on : null,
      slot: occurrence(k, slot),
    };
  };

  const valueAt = (k: number): SampleValue => {
    if (base.representation === 'none') {
      return { targetC: def.constantTargetC, on: null, slot: null, programmedTargetC: def.constantTargetC, overrideId: null, draft: false };
    }
    if (k < grid.nowIndex) {
      const v = raw(base, k);
      return { ...v, programmedTargetC: v.targetC, overrideId: null, draft: false };
    }
    let overrideId: string | null = null;
    let fromDraft = false;
    let prev = raw(base, k);
    for (let j = 0; j < permanents.length; j += 1) {
      const next = raw(steps[j + 1]!, k);
      const change = permanents[j]!;
      const touches =
        !sameValue(prev, next) ||
        (next.slot != null && next.slot.day === change.body.day && next.slot.ref === change.body.slotRef);
      if (touches) {
        if (change.id == null) fromDraft = true;
        else overrideId = change.id;
      }
      prev = next;
    }
    let targetC = prev.targetC;
    const occ = prev.slot;
    if (occ && occ.startMs <= grid.nowMs && grid.nowMs < occ.endMs) {
      const o = slotOverrides.find((c) => c.body.day === occ.day && c.body.slotRef === occ.ref);
      if (o) {
        targetC = o.body.change.targetC ?? (prev.targetC != null ? prev.targetC + (o.body.change.deltaC ?? 0) : null);
        if (o.id == null) fromDraft = true;
        else overrideId = o.id;
      }
    }
    const programmed = raw(committedProgram, k).targetC;
    return { targetC, on: prev.on, slot: occ, programmedTargetC: programmed, overrideId, draft: fromDraft };
  };

  return { def, valueAt, programs: { committed: committedProgram, preview } };
}
