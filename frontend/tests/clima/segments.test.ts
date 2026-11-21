// Program lanes and action runs equal the mockup's lanes (oracle), plus segment rules.
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import type { OverrideCreate, TimeRange } from '../../src/api/types';
import { actionFill } from '../../src/modules/clima/logic/colors';
import { actionRuns, boxPct } from '../../src/modules/clima/logic/runs';
import { buildSegments, findSelectedSegment, segmentState } from '../../src/modules/clima/logic/segments';
import { kindSpec } from '../../src/modules/clima/systemKinds';
import { SEGMENT_LABEL_MIN_WIDTH_PCT } from '../../src/modules/clima/thermogram/scales';
import { loadStanzaOracle, ORACLE_ROOMS } from './oracle/loadMockup';

const RANGES: [TimeRange, '24h' | '7g'][] = [
  ['24h', '24h'],
  ['7d', '7g'],
];

const it1 = (v: number) => `${v.toFixed(1).replace('.', ',')}°`;

describe.each(RANGES)('lanes %s', (range, oracleRange) => {
  const oracle = loadStanzaOracle();
  const ds = new MockDataSource('home');

  it.each(ORACLE_ROOMS.map((id, ri) => [id, ri] as const))('%s', async (roomId, ri) => {
    const g = oracle.render({ room: ri, hi: null, range: oracleRange }).g;
    const tl = await ds.getRoomTimeline({ roomId, range });
    const n = tl.grid.count;
    expect(tl.lanes).toHaveLength(g.lanes.length);
    tl.lanes.forEach((lane, li) => {
      const o = g.lanes[li]!;
      const spec = kindSpec(lane.kind);
      expect(lane.segments).toHaveLength(o.prog.length);
      lane.segments.forEach((seg, si) => {
        const os = o.prog[si]!;
        const box = boxPct(seg.startIndex, seg.endIndex, n);
        expect(box.left.toFixed(3)).toBe(os.l);
        expect(box.width.toFixed(3)).toBe(os.w);
        expect(spec.programFill(seg)).toBe(os.bg);
        const labelled = spec.showProgramValue(seg) && box.width > SEGMENT_LABEL_MIN_WIDTH_PCT[range];
        expect(labelled ? it1(seg.targetC!) : '').toBe(os.t);
        expect(os.cur === 'pointer').toBe(seg.state !== 'past' && seg.slotRef != null);
      });
      const current = lane.segments.filter((s) => s.startIndex <= tl.grid.nowIndex && tl.grid.nowIndex < s.endIndex);
      expect(current).toHaveLength(1);
      expect(current[0]!.state).toBe('current');
      const act = actionRuns(lane.action, tl.grid.nowIndex);
      expect(act).toHaveLength(o.act.length);
      act.forEach((r, ai) => {
        const oa = o.act[ai]!;
        const box = boxPct(r.start, r.end, n);
        expect(box.left.toFixed(3)).toBe(oa.l);
        expect(box.width.toFixed(3)).toBe(oa.w);
        expect(actionFill(r.action)).toBe(oa.bg);
        expect(r.forecast ? 0.5 : 1).toBe(oa.op);
      });
    });
  });
});

describe('segments', () => {
  it('state from indices', () => {
    expect(segmentState(0, 10, 10)).toBe('past');
    expect(segmentState(5, 11, 10)).toBe('current');
    expect(segmentState(10, 12, 10)).toBe('current');
    expect(segmentState(11, 12, 10)).toBe('future');
  });

  it('builds keys, merges gaps and flags edits only outside the past', () => {
    const a = { day: 'fri' as const, ref: 'fri-0', from: '06:00', to: '08:00', levelId: null, startMs: 0, endMs: 0 };
    const segs = buildSegments({
      systemId: 's',
      count: 6,
      nowIndex: 2,
      t: ['t0', 't1', 't2', 't3', 't4', 't5'],
      end: 'end',
      slot: [null, null, a, a, a, null],
      target: [null, null, 20, 21, 21, null],
      on: [null, null, null, null, null, null],
      programmedTarget: [null, null, 20, 20, 20, null],
      overrideId: [null, 'ovr-0', null, 'ovr-1', 'ovr-1', null],
      draft: [false, false, false, false, false, false],
    });
    expect(segs.map((s) => [s.key, s.startIndex, s.endIndex, s.state, s.edited])).toEqual([
      ['s|gap|gap|0', 0, 2, 'past', false],
      ['s|fri|fri-0|2', 2, 3, 'current', false],
      ['s|fri|fri-0|3', 3, 5, 'future', true],
      ['s|gap|gap|5', 5, 6, 'future', false],
    ]);
    expect(segs[2]!.overrideId).toBe('ovr-1');
    expect(segs[2]!.programmedTargetC).toBe(20);
    expect(segs[2]!.start).toBe('t3');
    expect(segs[3]!.end).toBe('end');
    expect(segs[1]!.slotFrom).toBe('06:00');
    expect(segs[1]!.end).toBe('t3');
  });

  it('finds the selected segment after a draft split it', async () => {
    const ds = new MockDataSource('home');
    const tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    const seg = tl.lanes[0]!.segments.find((s) => s.state === 'current')!;
    const selection = {
      systemId: 'z-bagno',
      segmentKey: seg.key,
      slotRef: seg.slotRef!,
      day: seg.day!,
      state: 'current' as const,
    };
    const draft: OverrideCreate = {
      systemId: 'z-bagno',
      slotRef: seg.slotRef!,
      day: seg.day!,
      scope: 'slot',
      change: { deltaC: null, targetC: 22, levelValueC: null, from: null, to: null, days: null },
      validUntil: null,
    };
    const preview = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h', draft });
    const found = findSelectedSegment(preview.lanes[0]!, selection)!;
    expect(found.state).toBe('current');
    expect(found.targetC).toBe(22);
    expect(found.edited).toBe(true);
    expect(found.overrideId).toBeNull();
    expect(findSelectedSegment(preview.lanes[0]!, { ...selection, systemId: 'other' })).toBeNull();
  });
});
