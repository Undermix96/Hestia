// Summary facts (HANDOFF §7) per kind, plus the generic fallback; on mock `home` they match the mockup's sentence.
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import type { NextProgramChange, TimeRange } from '../../src/api/types';
import {
  summaryFacts,
  summaryInputFromTimeline,
  type SummaryInput,
  type SummarySystemInput,
  type SystemFactState,
} from '../../src/modules/clima/logic/summaryFacts';
import catalog from '../../../locales/it.json';
import { SCENARIO_IDS } from '../../src/api/datasource/types';
import { loadStanzaOracle, ORACLE_ROOMS } from './oracle/loadMockup';

const HYST = { belowC: 0.3, aboveC: 0.2 };

function radiator(over: Partial<SummarySystemInput> = {}): SummarySystemInput {
  return {
    systemId: 'z',
    kind: 'radiator',
    displayName: 'Caloriferi',
    behavior: 'always_on_target',
    hysteresis: HYST,
    representation: 'levels',
    mode: null,
    action: 'idle',
    targetC: 21,
    nextChange: null,
    ...over,
  };
}

function split(over: Partial<SummarySystemInput> = {}): SummarySystemInput {
  return {
    systemId: 'ac',
    kind: 'ac',
    displayName: 'Climatizzatore',
    behavior: 'mode_based',
    hysteresis: HYST,
    representation: 'levels',
    mode: 'heat',
    action: 'heat',
    targetC: 21.5,
    nextChange: null,
    ...over,
  };
}

function dehumidifier(over: Partial<SummarySystemInput> = {}): SummarySystemInput {
  return {
    systemId: 'deum',
    kind: 'dehumidifier',
    displayName: 'Deumidificatore',
    behavior: 'unknown',
    hysteresis: HYST,
    representation: 'onOff',
    mode: null,
    action: 'dry',
    targetC: null,
    nextChange: null,
    ...over,
  };
}

function input(temperatureC: number | null, systems: SummarySystemInput[]): SummaryInput {
  return { roomName: 'Soggiorno', temperatureC, humidityPct: 47, outdoorC: 5.9, outdoorHumidityPct: 83, systems };
}

const state = (temperatureC: number | null, s: SummarySystemInput) => summaryFacts(input(temperatureC, [s])).systems[0]!.state;

describe('radiators (always_on_target)', () => {
  it('heating towards the target', () => {
    expect(state(20, radiator({ action: 'heat' }))).toEqual({ type: 'heatingTowards', targetC: 21, overshoot: false });
  });
  it('heating with the room already above the range ("tra poco vanno in standby")', () => {
    expect(state(21.3, radiator({ action: 'heat' }))).toEqual({ type: 'heatingTowards', targetC: 21, overshoot: true });
  });
  it('above the target', () => {
    expect(state(21.8, radiator())).toEqual({ type: 'aboveTarget', targetC: 21 });
  });
  it('in range (camera: 17,7–18,2)', () => {
    const s = state(18.1, radiator({ targetC: 18 }));
    expect(s.type).toBe('inRange');
    if (s.type !== 'inRange') return;
    expect(s.lowC.toFixed(1)).toBe('17.7');
    expect(s.highC.toFixed(1)).toBe('18.2');
    expect(s.temperatureC).toBe(18.1);
  });
  it('unknown without target or temperature', () => {
    expect(state(20, radiator({ targetC: null }))).toEqual({ type: 'unknown' });
    expect(state(null, radiator())).toEqual({ type: 'unknown' });
  });
  it('noProgram: a constant target still gives a range', () => {
    expect(state(20.5, radiator({ representation: 'none', targetC: 20.5 })).type).toBe('inRange');
  });
});

describe('splits (mode_based)', () => {
  it.each<[string, Partial<SummarySystemInput>, SystemFactState]>([
    ['not scheduled', { targetC: null, action: 'off' }, { type: 'notScheduled' }],
    ['heating', { action: 'heat' }, { type: 'heatingTowards', targetC: 21.5, overshoot: false }],
    ['cooling', { mode: 'cool', action: 'cool' }, { type: 'coolingTowards', targetC: 21.5 }],
    ['standby', { action: 'idle' }, { type: 'standby', targetC: 21.5 }],
    ['drying', { mode: 'dry', action: 'dry' }, { type: 'drying' }],
    ['off (mode off)', { mode: 'off', action: 'off', targetC: null }, { type: 'off' }],
    ['off wins over a target', { mode: 'off', action: 'off', targetC: 21 }, { type: 'off' }],
  ])('%s', (_name, over, expected) => {
    expect(state(20, split(over))).toEqual(expected);
  });
});

describe('generic kinds (unknown / thermostatic behaviour)', () => {
  it('dehumidifier drying', () => {
    const f = summaryFacts(input(20, [dehumidifier()])).systems[0]!;
    expect(f.messageKind).toBe('generic');
    expect(f.kind).toBe('dehumidifier');
    expect(f.state).toEqual({ type: 'drying' });
  });
  it('dehumidifier outside its slots: not scheduled', () => {
    expect(state(20, dehumidifier({ action: 'off' }))).toEqual({ type: 'notScheduled' });
  });
  it('dehumidifier without a program: off', () => {
    expect(state(20, dehumidifier({ action: 'off', representation: 'none' }))).toEqual({ type: 'off' });
  });
  it('a reported action is trusted', () => {
    expect(state(20, dehumidifier({ action: 'heat', targetC: 22 }))).toEqual({
      type: 'heatingTowards',
      targetC: 22,
      overshoot: false,
    });
    expect(state(20, dehumidifier({ behavior: 'thermostatic', action: 'cool', targetC: 24 }))).toEqual({
      type: 'coolingTowards',
      targetC: 24,
    });
    expect(state(20, dehumidifier({ action: 'idle', targetC: 22 }))).toEqual({ type: 'standby', targetC: 22 });
  });
  it('no action information: unknown', () => {
    expect(state(20, dehumidifier({ action: null }))).toEqual({ type: 'unknown' });
  });
});

describe('next change', () => {
  const at = (iso: string, change: NextProgramChange['change'] = 'target'): NextProgramChange => ({
    at: iso,
    change,
    targetC: change === 'off' ? null : 20,
  });

  it('earliest over the systems', () => {
    const f = summaryFacts(
      input(20, [
        radiator({ nextChange: at('2026-11-20T23:00:00+01:00') }),
        split({ nextChange: at('2026-11-20T08:45:00+01:00', 'off') }),
      ]),
    );
    expect(f.next).toMatchObject({ systemId: 'ac', messageKind: 'ac', change: 'off', at: '2026-11-20T08:45:00+01:00' });
  });

  it('ties keep the first system in lane order (radiator)', () => {
    const f = summaryFacts(
      input(20, [radiator({ nextChange: at('2026-11-20T09:00:00+01:00') }), split({ nextChange: at('2026-11-20T09:00:00+01:00', 'off') })]),
    );
    expect(f.next?.systemId).toBe('z');
    expect(f.next?.messageKind).toBe('radiator');
  });

  it('none without changes; lead and conditions pass through', () => {
    const f = summaryFacts(input(21.8, [radiator()]));
    expect(f.next).toBeNull();
    expect(f.lead).toEqual({ roomName: 'Soggiorno', temperatureC: 21.8 });
    expect(f.conditions).toEqual({ humidityPct: 47, outdoorC: 5.9, outdoorHumidityPct: 83 });
  });
});

// ---- mock home vs the mockup's sentence -------------------------------------------------------------------

const num = (s: string) => Number(s.replace(',', '.'));
const fmt = (v: number) => v.toFixed(1).replace('.', ',');

function parseRadiator(rest: string): SystemFactState | null {
  let m = /I caloriferi stanno scaldando verso ([\d,]+)°(, tra poco vanno in standby)?/.exec(rest);
  if (m) return { type: 'heatingTowards', targetC: num(m[1]!), overshoot: m[2] != null };
  m = /I caloriferi sono fermi: la stanza è sopra il target di ([\d,]+)°/.exec(rest);
  if (m) return { type: 'aboveTarget', targetC: num(m[1]!) };
  m = /I caloriferi sono in standby: ([\d,]+)° è dentro il range ([\d,]+)–([\d,]+)°/.exec(rest);
  if (m) return { type: 'inRange', temperatureC: num(m[1]!), lowC: num(m[2]!), highC: num(m[3]!) };
  return null;
}

function parseSplit(rest: string): SystemFactState | null {
  if (rest.includes('Il climatizzatore non è programmato adesso')) return { type: 'notScheduled' };
  let m = /Il climatizzatore scalda verso ([\d,]+)°/.exec(rest);
  if (m) return { type: 'heatingTowards', targetC: num(m[1]!), overshoot: false };
  m = /Il climatizzatore raffredda verso ([\d,]+)°/.exec(rest);
  if (m) return { type: 'coolingTowards', targetC: num(m[1]!) };
  m = /Il climatizzatore è acceso ma in standby, set ([\d,]+)°/.exec(rest);
  if (m) return { type: 'standby', targetC: num(m[1]!) };
  return null;
}

/** Rounds the numbers of a fact like the sentence does (one decimal). */
function rounded(s: SystemFactState): SystemFactState {
  const r = (v: number) => num(fmt(v));
  switch (s.type) {
    case 'heatingTowards':
      return { ...s, targetC: s.targetC == null ? null : r(s.targetC) };
    case 'coolingTowards':
    case 'standby':
      return { ...s, targetC: s.targetC == null ? null : r(s.targetC) };
    case 'aboveTarget':
      return { ...s, targetC: r(s.targetC) };
    case 'inRange':
      return { type: 'inRange', temperatureC: r(s.temperatureC), lowC: r(s.lowC), highC: r(s.highC) };
    default:
      return s;
  }
}

describe.each([
  ['24h', '24h'],
  ['7d', '7g'],
] as [TimeRange, '24h' | '7g'][])('mock home %s matches the mockup summary', (range, oracleRange) => {
  const oracle = loadStanzaOracle();
  const ds = new MockDataSource('home');

  it.each(ORACLE_ROOMS.map((id, ri) => [id, ri] as const))('%s', async (roomId, ri) => {
    const hero = oracle.render({ room: ri, hi: null, range: oracleRange }).hero;
    const tl = await ds.getRoomTimeline({ roomId, range });
    const facts = summaryFacts(
      summaryInputFromTimeline(tl, { room: (r) => r.id, system: (s) => s.id }),
    );
    expect(hero.lead.trim()).toBe(`${hero.lead.split(' ')[0]} è a ${fmt(facts.lead.temperatureC!)}°.`);
    for (const f of facts.systems) {
      const expected = f.kind === 'radiator' ? parseRadiator(hero.rest) : parseSplit(hero.rest);
      expect(expected).not.toBeNull();
      expect(rounded(f.state)).toEqual(expected);
    }
    const m = /Alle (\d\d:\d\d) (il target dei caloriferi passa a ([\d,]+)°|il climatizzatore si accende a ([\d,]+)°|il climatizzatore si spegne)/.exec(
      hero.rest,
    );
    expect(m).not.toBeNull();
    const next = facts.next!;
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    expect(local.format(new Date(next.at))).toBe(m![1]);
    if (m![3]) expect([next.messageKind, next.change, fmt(next.targetC!)]).toEqual(['radiator', 'target', m![3]]);
    else if (m![4]) expect([next.messageKind, next.change, fmt(next.targetC!)]).toEqual(['ac', 'on', m![4]]);
    else expect([next.messageKind, next.change]).toEqual(['ac', 'off']);
    expect(hero.fc).toBe(
      `Umidità ${Math.round(facts.conditions.humidityPct!)}% · fuori ${fmt(facts.conditions.outdoorC!)}° e ${Math.round(
        facts.conditions.outdoorHumidityPct!,
      )}%.`,
    );
  });
});

describe('every scenario has a message for its summary facts', () => {
  const messages = catalog as Record<string, unknown>;
  it.each(SCENARIO_IDS)('%s', async (id) => {
    const ds = new MockDataSource(id);
    const missing = new Set<string>();
    for (const room of await ds.getRooms()) {
      for (const range of ['24h', '7d'] as const) {
        const tl = await ds.getRoomTimeline({ roomId: room.id, range });
        const facts = summaryFacts(summaryInputFromTimeline(tl, { room: (r) => r.id, system: (s) => s.id }));
        for (const f of facts.systems) {
          const key = `clima.summary.system.${f.state.type}.${f.messageKind}`;
          if (!(key in messages)) missing.add(key);
        }
        if (facts.next) {
          const key = `clima.summary.next.${facts.next.change}.${facts.next.messageKind}`;
          if (!(key in messages)) missing.add(key);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
