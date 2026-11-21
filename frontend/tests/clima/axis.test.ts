// Axis ticks equal the mockup's `xl` labels (position and kind), with the 5 % omission around "now".
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import type { TimeRange } from '../../src/api/types';
import { localParts } from '../../src/lib/time';
import { axisTicks } from '../../src/modules/clima/thermogram/axis';
import { loadStanzaOracle, loadTutteOracle } from './oracle/loadMockup';

const TZ = 'Europe/Rome';
const pad = (n: number) => String(n).padStart(2, '0');

async function ticks(range: TimeRange) {
  const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range });
  return axisTicks(tl.grid, TZ);
}

describe('axisTicks', () => {
  it.each([
    ['24h', '24h'],
    ['7d', '7g'],
  ] as const)('%s equals the Stanza and Tutte oracles', async (range, oracleRange) => {
    const ours = await ticks(range);
    const stanza = loadStanzaOracle().render({ room: 0, hi: null, range: oracleRange }).g.xl;
    const tutte = loadTutteOracle().render({ hi: null, range: oracleRange }).xl;
    expect(tutte).toEqual(stanza);
    expect(ours).toHaveLength(stanza.length);
    ours.forEach((t, i) => {
      const o = stanza[i]!;
      expect(t.leftPct.toFixed(2)).toBe(o.l);
      const p = localParts(Date.parse(t.iso), TZ);
      if (t.kind === 'now') expect(o.t).toBe('adesso');
      else if (t.kind === 'hour') expect(o.t).toBe(`${pad(p.hour)}:${pad(p.minute)}`);
      else expect(o.t.endsWith(` ${p.day}`)).toBe(true);
    });
  });

  it('24h expected labels', async () => {
    const t = await ticks('24h');
    expect(t.map((x) => [x.kind, x.iso.slice(11, 16), x.leftPct.toFixed(2)])).toEqual([
      ['now', '08:30', '93.27'],
      ['hour', '12:00', '14.42'],
      ['hour', '16:00', '29.81'],
      ['hour', '20:00', '45.19'],
      ['hour', '00:00', '60.58'],
      ['hour', '04:00', '75.96'],
    ]);
  });

  it('7d expected labels and the omission near now', async () => {
    const t = await ticks('7d');
    expect(t.map((x) => [x.kind, x.iso.slice(0, 10), x.leftPct.toFixed(2)])).toEqual([
      ['now', '2026-11-20', '93.47'],
      ['day', '2026-11-14', '8.61'],
      ['day', '2026-11-15', '21.94'],
      ['day', '2026-11-16', '35.28'],
      ['day', '2026-11-17', '48.61'],
      ['day', '2026-11-18', '61.94'],
      ['day', '2026-11-19', '75.28'],
    ]);
    // Midnight of the 20th sits at 89.44 %, within 5 % of now (93.47 %): omitted.
    expect(t.some((x) => x.iso.startsWith('2026-11-20T00:00'))).toBe(false);
  });
});
