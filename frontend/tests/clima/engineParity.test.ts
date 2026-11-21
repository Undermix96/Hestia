// The mock engine is a faithful port of the mockup: same arrays, bit for bit, as the original `sim()`.
import { describe, expect, it } from 'vitest';
import { simulateScenario } from '../../src/api/datasource/mock/aggregate';
import { MOCK_NOW_ISO, MOCK_TIME_ZONE } from '../../src/api/datasource/mock/clock';
import { buildGrid } from '../../src/api/datasource/mock/neng/grid';
import { getScenario } from '../../src/api/datasource/mock/scenarios';
import type { Mode, OverrideCreate, TimeRange } from '../../src/api/types';
import { loadEngineOracle, ORACLE_ROOMS, ORACLE_SIM_STATE } from './oracle/loadMockup';

const RANGES: [TimeRange, '24h' | '7g'][] = [
  ['24h', '24h'],
  ['7d', '7g'],
];

const RADIATOR: Record<string, string | null> = {
  soggiorno: 'z-soggiorno',
  corridoio: null,
  camera: 'z-camera',
  cameretta: 'z-cameretta',
  bagno: 'z-bagno',
};
const SPLIT: Record<string, string | null> = {
  soggiorno: 'ac-soggiorno',
  corridoio: 'ac-corridoio',
  camera: null,
  cameretta: null,
  bagno: null,
};

describe.each(RANGES)('home %s', (range, oracleRange) => {
  const oracle = loadEngineOracle();
  oracle.setRange(oracleRange);
  const grid = buildGrid(range, MOCK_NOW_ISO, MOCK_TIME_ZONE);
  const sim = simulateScenario(getScenario('home'), grid, [], null);

  it('has the mockup grid shape', () => {
    expect(grid.count).toBe(oracle.NS());
    expect(grid.nowIndex).toBe(oracle.NOWI());
  });

  it('outdoor T/H equal the oracle OUTM', () => {
    expect(sim.outdoor.T).toEqual(oracle.OUTM().T);
    expect(sim.outdoor.H).toEqual(oracle.OUTM().H);
  });

  it.each(ORACLE_ROOMS.map((id, ri) => [id, ri] as const))('%s equals the oracle sim()', (roomId, ri) => {
    const o = oracle.sim(ri, ORACLE_SIM_STATE);
    const room = sim.sims.get(roomId)!;
    expect(room.T).toEqual(o.T);
    expect(room.H).toEqual(o.H);
    const rad = RADIATOR[roomId];
    if (rad) {
      expect(sim.systems.get(rad)!.target).toEqual(o.rt);
      expect(sim.systems.get(rad)!.action).toEqual(o.ra);
    }
    const ac = SPLIT[roomId];
    if (ac) {
      expect(sim.systems.get(ac)!.target).toEqual(o.as);
      expect(sim.systems.get(ac)!.action).toEqual(o.aa);
    }
  });
});

// Edits of the mockup (`st.edits`, key `room:kind:entry`, delta °C) apply to future samples only. Our slot overrides
// apply to the occurrence that contains now, which covers every future sample of these entries in both ranges.
const NULL_CHANGE = { deltaC: null, targetC: null, levelValueC: null, from: null, to: null, days: null };
function slotDraft(systemId: string, slotRef: string, deltaC: number): OverrideCreate {
  return { systemId, slotRef, day: 'fri', scope: 'slot', validUntil: null, change: { ...NULL_CHANGE, deltaC } };
}

const EDIT_CASES: { name: string; ri: number; roomId: string; edits: Record<string, number>; draft: OverrideCreate }[] = [
  { name: 'soggiorno radiator +1', ri: 0, roomId: 'soggiorno', edits: { '0:rad:1': 1 }, draft: slotDraft('z-soggiorno', 'fri-1', 1) },
  { name: 'soggiorno split -2', ri: 0, roomId: 'soggiorno', edits: { '0:ac:0': -2 }, draft: slotDraft('ac-soggiorno', 'fri-0', -2) },
  { name: 'corridoio split -3', ri: 1, roomId: 'corridoio', edits: { '1:ac:0': -3 }, draft: slotDraft('ac-corridoio', 'fri-0', -3) },
  { name: 'camera radiator +2', ri: 2, roomId: 'camera', edits: { '2:rad:2': 2 }, draft: slotDraft('z-camera', 'fri-2', 2) },
  { name: 'bagno radiator -4', ri: 4, roomId: 'bagno', edits: { '4:rad:1': -4 }, draft: slotDraft('z-bagno', 'fri-1', -4) },
];

describe.each(RANGES)('home %s with edits', (range, oracleRange) => {
  const oracle = loadEngineOracle();
  oracle.setRange(oracleRange);
  const grid = buildGrid(range, MOCK_NOW_ISO, MOCK_TIME_ZONE);

  it.each(EDIT_CASES)('$name equals the oracle sim() with the same edit', ({ ri, roomId, edits, draft }) => {
    const o = oracle.sim(ri, { ...ORACLE_SIM_STATE, edits });
    const sim = simulateScenario(getScenario('home'), grid, [], draft);
    const room = sim.sims.get(roomId)!;
    expect(room.T).toEqual(o.T);
    expect(room.H).toEqual(o.H);
    const rad = RADIATOR[roomId];
    if (rad) {
      expect(sim.systems.get(rad)!.target).toEqual(o.rt);
      expect(sim.systems.get(rad)!.action).toEqual(o.ra);
    }
    const ac = SPLIT[roomId];
    if (ac) {
      expect(sim.systems.get(ac)!.target).toEqual(o.as);
      expect(sim.systems.get(ac)!.action).toEqual(o.aa);
    }
    // The edit changed the forecast but not the past.
    const base = oracle.sim(ri, ORACLE_SIM_STATE);
    expect(o.T.slice(0, grid.nowIndex)).toEqual(base.T.slice(0, grid.nowIndex));
    expect(o.T).not.toEqual(base.T);
  });
});

// Split modes of the mockup's PowerCard ('Caldo' | 'Freddo' | 'Deumid' | 'Spento') → our `MockSystemDef.mode`.
const MODES: [Mode, string][] = [
  ['heat', 'Caldo'],
  ['cool', 'Freddo'],
  ['dry', 'Deumid'],
  ['off', 'Spento'],
];

describe.each(RANGES)('home %s split modes', (range, oracleRange) => {
  const oracle = loadEngineOracle();
  oracle.setRange(oracleRange);
  const grid = buildGrid(range, MOCK_NOW_ISO, MOCK_TIME_ZONE);

  it.each(MODES)('mode %s equals the oracle mode %s', (mode, oracleMode) => {
    const scenario = getScenario('home');
    for (const s of scenario.systems) if (s.behavior === 'mode_based') s.mode = mode;
    const sim = simulateScenario(scenario, grid, [], null);
    for (const [roomId, ri] of [
      ['soggiorno', 0],
      ['corridoio', 1],
    ] as const) {
      const o = oracle.sim(ri, { ac: { s: oracleMode, c: oracleMode }, edits: {} });
      expect(sim.sims.get(roomId)!.T).toEqual(o.T);
      expect(sim.sims.get(roomId)!.H).toEqual(o.H);
      expect(sim.systems.get(SPLIT[roomId]!)!.target).toEqual(o.as);
      expect(sim.systems.get(SPLIT[roomId]!)!.action).toEqual(o.aa);
      const rad = RADIATOR[roomId];
      if (rad) expect(sim.systems.get(rad)!.action).toEqual(o.ra);
    }
  });
});
