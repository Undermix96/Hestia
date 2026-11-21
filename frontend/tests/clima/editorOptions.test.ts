// Capabilities → editor matrix (plan §2, D10): every representation × capability preset × slot state × gap.
import { describe, expect, it } from 'vitest';
import {
  LEVELS_RO,
  LEVELS_RW,
  NONE,
  ONOFF_TIMES,
  PERSLOT_RW,
  systemCapabilities,
  type CapabilityPreset,
} from '../../src/api/datasource/mock/scenarios/capabilities';
import type { ProgramRepresentation, SegmentState, SystemCapabilities } from '../../src/api/types';
import { editorAvailability } from '../../src/modules/clima/logic/editorOptions';

const PRESETS: Record<string, CapabilityPreset> = { LEVELS_RW, PERSLOT_RW, LEVELS_RO, NONE, ONOFF_TIMES };
const REPRESENTATIONS: ProgramRepresentation[] = ['levels', 'perSlot', 'onOff', 'none'];
const STATES: SegmentState[] = ['past', 'current', 'future'];

function caps(preset: CapabilityPreset, slotScope: boolean, read = true): SystemCapabilities {
  const c = systemCapabilities(preset, 'radiator', false);
  c.override.scopes = slotScope ? ['slot'] : [];
  c.program.read = read;
  return c;
}

const seg = (state: SegmentState, gap = false) => ({ state, slotRef: gap ? null : 'fri-1' });

describe('natural combinations', () => {
  it.each<[string, ProgramRepresentation, SegmentState, string[] | string, boolean]>([
    ['LEVELS_RW', 'levels', 'current', ['slot', 'permanentValue', 'permanentTimes'], true],
    ['LEVELS_RW', 'levels', 'future', ['permanentValue', 'permanentTimes'], true],
    ['LEVELS_RW', 'levels', 'past', 'past', false],
    ['PERSLOT_RW', 'perSlot', 'current', ['slot', 'permanentValue', 'permanentTimes'], false],
    ['PERSLOT_RW', 'perSlot', 'future', ['permanentValue', 'permanentTimes'], false],
    ['LEVELS_RO', 'levels', 'current', 'readonly', false],
    ['LEVELS_RO', 'levels', 'future', 'readonly', false],
    ['NONE', 'none', 'current', 'noProgram', false],
    ['ONOFF_TIMES', 'onOff', 'current', ['permanentTimes'], false],
    ['ONOFF_TIMES', 'onOff', 'future', ['permanentTimes'], false],
  ])('%s %s %s', (preset, rep, state, expected, warning) => {
    const a = editorAvailability(seg(state), caps(PRESETS[preset]!, PRESETS[preset]!.override.scopes.length > 0), rep);
    if (typeof expected === 'string') {
      expect(a).toEqual({ clickable: false, options: [], defaultOption: null, levelsWarning: false, reason: expected });
    } else {
      expect(a.clickable).toBe(true);
      expect(a.options).toEqual(expected);
      expect(a.defaultOption).toBe(expected[0]);
      expect(a.levelsWarning).toBe(warning);
      expect(a.reason).toBeNull();
    }
  });

  it('temporary-only capabilities (writes off, slot scope on) offer just the slot on the current slot', () => {
    const c = caps(LEVELS_RO, true);
    expect(editorAvailability(seg('current'), c, 'levels').options).toEqual(['slot']);
    expect(editorAvailability(seg('current'), c, 'levels').levelsWarning).toBe(false);
    expect(editorAvailability(seg('future'), c, 'levels').reason).toBe('readonly');
  });

  it('a program that cannot be read is not editable', () => {
    expect(editorAvailability(seg('current'), caps(LEVELS_RW, true, false), 'levels').reason).toBe('noProgram');
  });
});

describe('full matrix: writeLevelValues × writeSlotValue × writeTimes × slot scope × representation × state × gap', () => {
  const cases: [string, ProgramRepresentation, boolean, SegmentState, boolean][] = [];
  for (let flags = 0; flags < 8; flags += 1)
    for (const rep of REPRESENTATIONS)
      for (const slotScope of [true, false])
        for (const st of STATES) for (const gap of [false, true]) cases.push([flags.toString(2).padStart(3, '0'), rep, slotScope, st, gap]);

  it.each(cases)('writes(LV,SV,T)=%s rep=%s slotScope=%s %s gap=%s', (flags, rep, slotScope, st, gap) => {
    const c = caps(LEVELS_RW, slotScope);
    c.program.writeLevelValues = flags[0] === '1';
    c.program.writeSlotValue = flags[1] === '1';
    c.program.writeTimes = flags[2] === '1';
    const a = editorAvailability(seg(st, gap), c, rep);
    if (rep === 'none') return expect(a.reason).toBe('noProgram');
    if (gap) return expect(a.reason).toBe('gap');
    if (st === 'past') return expect(a.reason).toBe('past');
    const expected: string[] = [];
    if (slotScope && st === 'current' && rep !== 'onOff') expected.push('slot');
    if ((rep === 'levels' && c.program.writeLevelValues) || (rep === 'perSlot' && c.program.writeSlotValue)) {
      expected.push('permanentValue');
    }
    if (c.program.writeTimes) expected.push('permanentTimes');
    expect(a.options).toEqual(expected);
    expect(a.clickable).toBe(expected.length > 0);
    expect(a.reason).toBe(expected.length > 0 ? null : 'readonly');
    expect(a.defaultOption).toBe(expected[0] ?? null);
    expect(a.levelsWarning).toBe(rep === 'levels' && expected.includes('permanentValue'));
    // D10: future slots never get a temporary override.
    if (st === 'future') expect(a.options).not.toContain('slot');
  });
});
