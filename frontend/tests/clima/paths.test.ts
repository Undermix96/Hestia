// SVG paths are byte-identical to the mockup's (oracle = the original mockup code).
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import type { TimeRange } from '../../src/api/types';
import {
  areaUnder,
  bandPath,
  combine,
  miniChartPaths,
  outdoorChartPaths,
  polyline,
  roomChartPaths,
  stepPath,
} from '../../src/modules/clima/thermogram/paths';
import { yRoomT } from '../../src/modules/clima/thermogram/scales';
import { loadStanzaOracle, loadTutteOracle, ORACLE_ROOMS } from './oracle/loadMockup';

const RANGES: [TimeRange, '24h' | '7g'][] = [
  ['24h', '24h'],
  ['7d', '7g'],
];

describe.each(RANGES)('Stanza paths %s', (range, oracleRange) => {
  const oracle = loadStanzaOracle();
  const ds = new MockDataSource('home');

  it.each(ORACLE_ROOMS.map((id, ri) => [id, ri] as const))('%s', async (roomId, ri) => {
    const g = oracle.render({ room: ri, hi: null, range: oracleRange }).g;
    const tl = await ds.getRoomTimeline({ roomId, range });
    const p = roomChartPaths(tl.climate, tl.target, tl.grid.nowIndex);
    expect(p.past).toBe(g.past);
    expect(p.forecast).toBe(g.fut);
    expect(p.humidityLine).toBe(g.humLine);
    expect(p.humidityArea).toBe(g.humArea);
    expect(p.target).toBe(g.tgt);
    expect(p.band).toBe(g.band);
    const o = outdoorChartPaths(tl.outdoor, 'stanza');
    expect(o.temperature).toBe(g.oTemp);
    expect(o.humidity).toBe(g.oHum);
    expect(o.humidityArea).toBe(g.oHumArea);
  });
});

describe.each(RANGES)('Tutte paths %s', (range, oracleRange) => {
  it('rows and outdoor equal the oracle', async () => {
    const vals = loadTutteOracle().render({ hi: null, range: oracleRange });
    const ov = await new MockDataSource('home').getOverview({ range });
    ORACLE_ROOMS.forEach((roomId, ri) => {
      const row = ov.rows.find((r) => r.room.id === roomId)!;
      const p = miniChartPaths(row.climate!, row.target!, ov.grid.nowIndex);
      const o = vals.rows[ri]!;
      expect(p.past).toBe(o.past);
      expect(p.forecast).toBe(o.fut);
      expect(p.target).toBe(o.tgt);
      expect(p.band).toBe(o.band);
    });
    const out = outdoorChartPaths(ov.outdoor, 'tutte');
    expect(out.temperature).toBe(vals.oTemp);
    expect(out.humidity).toBe(vals.oHum);
    expect(out.humidityArea).toBe('');
  });
});

describe('path primitives', () => {
  const y = (v: number) => v;

  it('polyline breaks on null and restarts with M', () => {
    expect(polyline([1, 2, null, 4, 5], y, 0, 4)).toBe('M100.0 1.0L300.0 2.0M700.0 4.0L900.0 5.0');
    expect(polyline([null, null], y, 0, 1)).toBe('');
    expect(polyline([1, 2, 3, 4], y, 1, 2)).toBe('M375.0 2.0L625.0 3.0');
  });

  it('areaUnder closes to the baseline and is empty for an empty line', () => {
    expect(areaUnder('M1 1', 1, 0, 2, 260)).toBe('M1 1L750.0 260L250.0 260Z');
    expect(areaUnder('', 1, 0, 2, 260)).toBe('');
  });

  it('stepPath draws one stroke per sample and reopens after a gap', () => {
    expect(stepPath([1, 1, null, 2], y)).toBe('M0.0 1.0L250.0 1.0L250.0 1.0L500.0 1.0M750.0 2.0L1000.0 2.0');
    expect(stepPath([null], y)).toBe('');
  });

  it('bandPath closes each run', () => {
    expect(bandPath([0, 0, null, 1], [2, 2, null, 3], y)).toBe(
      'M0.0 2.0L250.0 2.0L250.0 2.0L500.0 2.0L500.0 0.0L250.0 0.0L250.0 0.0L0.0 0.0Z' +
        'M750.0 3.0L1000.0 3.0L1000.0 1.0L750.0 1.0Z',
    );
    expect(bandPath([null], [null], y)).toBe('');
  });

  it('combine prefers the first series', () => {
    expect(combine([1, null, null], [9, 2, null])).toEqual([1, 2, null]);
  });

  it('room scale matches the mockup', () => {
    expect(yRoomT(14)).toBe(252);
    expect(yRoomT(25)).toBe(8);
  });
});
