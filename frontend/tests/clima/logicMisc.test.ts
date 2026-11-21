// System kinds, cursor helpers, the a11y table rows and the week program rows.
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import { PALETTE, radiatorColor } from '../../src/modules/clima/logic/colors';
import { cursorPhase, indexFromPointer, keyboardStep, moveCursor, tooltipOnLeft } from '../../src/modules/clima/logic/cursor';
import { weekRows } from '../../src/modules/clima/logic/weekProgram';
import { kindSpec, sortByLaneOrder } from '../../src/modules/clima/systemKinds';
import { tableRows } from '../../src/modules/clima/thermogram/tableRows';

describe('systemKinds', () => {
  it('radiator, ac and the generic fallback', () => {
    expect(kindSpec('radiator')).toMatchObject({ messageKind: 'radiator', dotShape: 'square', laneOrder: 0, weekBar: 'full' });
    expect(kindSpec('ac')).toMatchObject({ messageKind: 'ac', dotShape: 'round', laneOrder: 10, weekBar: 'thin' });
    expect(kindSpec('dehumidifier')).toMatchObject({ kind: '*', messageKind: 'generic', dotShape: 'round', laneOrder: 50 });
    expect(kindSpec('vmc').messageKind).toBe('generic');
  });

  it('program fills', () => {
    expect(kindSpec('radiator').programFill({ targetC: 21, on: null })).toBe(radiatorColor(21));
    expect(kindSpec('radiator').programFill({ targetC: null, on: null })).toBe('transparent');
    expect(kindSpec('ac').programFill({ targetC: 21.5, on: null })).toBe(PALETTE.acProg);
    expect(kindSpec('ac').programFill({ targetC: null, on: null })).toBe('transparent');
    expect(kindSpec('dehumidifier').programFill({ targetC: null, on: true })).toBe(PALETTE.acProg);
    expect(kindSpec('dehumidifier').programFill({ targetC: null, on: false })).toBe('transparent');
    expect(kindSpec('ac').showProgramValue({ targetC: 21.5, on: null })).toBe(true);
    expect(kindSpec('dehumidifier').showProgramValue({ targetC: null, on: true })).toBe(false);
  });

  it('stable lane sort', () => {
    const items = [{ kind: 'vmc', id: 1 }, { kind: 'ac', id: 2 }, { kind: 'radiator', id: 3 }, { kind: 'ac', id: 4 }, { kind: 'radiator', id: 5 }];
    expect(sortByLaneOrder(items).map((x) => x.id)).toEqual([3, 5, 2, 4, 1]);
    expect(items.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('cursor', () => {
  it('pointer → sample (clamped)', () => {
    const rect = { left: 100, width: 520 };
    expect(indexFromPointer(100, rect, 52)).toBe(0);
    expect(indexFromPointer(110, rect, 52)).toBe(1);
    expect(indexFromPointer(50, rect, 52)).toBe(0);
    expect(indexFromPointer(1000, rect, 52)).toBe(51);
    expect(indexFromPointer(10, { left: 0, width: 0 }, 52)).toBe(0);
  });
  it('phase and tooltip side', () => {
    expect([cursorPhase(47, 48), cursorPhase(48, 48), cursorPhase(50, 48)]).toEqual(['past', 'now', 'forecast']);
    expect(tooltipOnLeft(30, 52)).toBe(false);
    expect(tooltipOnLeft(31, 52)).toBe(true);
  });
  it('keyboard steps', () => {
    expect(keyboardStep('ArrowRight', '24h', false)).toBe(1);
    expect(keyboardStep('ArrowLeft', '24h', true)).toBe(-2);
    expect(keyboardStep('ArrowRight', '7d', true)).toBe(12);
    expect(keyboardStep('PageUp', '24h', false)).toBe(-8);
    expect(keyboardStep('PageDown', '7d', false)).toBe(48);
    expect(keyboardStep('Home', '7d', false)).toBe('home');
    expect(keyboardStep('End', '24h', false)).toBe('end');
    expect(keyboardStep('a', '24h', false)).toBeNull();
  });
  it('moves from now when there is no cursor', () => {
    expect(moveCursor(null, 2, 48, 52)).toBe(50);
    expect(moveCursor(50, 8, 48, 52)).toBe(51);
    expect(moveCursor(3, -8, 48, 52)).toBe(0);
    expect(moveCursor(10, 'home', 48, 52)).toBe(0);
    expect(moveCursor(10, 'end', 48, 52)).toBe(51);
  });
});

describe('tableRows', () => {
  it('24h: every sample; 7d: every 2 h plus now', async () => {
    const ds = new MockDataSource('home');
    const t24 = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const rows = tableRows(t24);
    expect(rows).toHaveLength(52);
    expect(rows[48]).toMatchObject({ phase: 'now', iso: '2026-11-20T08:30:00+01:00', targetC: 21, actions: ['idle', 'heat'] });
    expect(rows[50]!.phase).toBe('forecast');
    expect(rows[50]!.temperatureC).toBe(t24.climate.forecastC[50]);
    const t7 = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '7d' });
    const r7 = tableRows(t7);
    expect(r7).toHaveLength(90);
    expect(r7.some((r) => r.index === 336 && r.phase === 'now')).toBe(true);
    expect(r7.every((r) => r.index % 4 === 0)).toBe(true);
  });
});

describe('weekRows', () => {
  it('home soggiorno: full radiator bar with values, thin split bar', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const rows = weekRows(tl.systems, tl.clock.now, tl.clock.timeZone);
    expect(rows.map((r) => r.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(rows.filter((r) => r.isToday).map((r) => r.day)).toEqual(['fri']);
    const [rad, ac] = rows[0]!.bars;
    expect(rad!.variant).toBe('full');
    expect(rad!.slots.map((s) => [s.leftPct.toFixed(2), s.widthPct.toFixed(2), s.valueC, s.showValue])).toEqual([
      ['0.00', '25.00', 18.5, true],
      ['25.00', '70.83', 21, true],
      ['95.83', '4.17', 18.5, false],
    ]);
    expect(rad!.slots[1]!.fill).toBe(radiatorColor(21));
    expect(ac!.variant).toBe('thin');
    expect(ac!.slots.map((s) => [s.leftPct.toFixed(2), s.widthPct.toFixed(2), s.fill])).toEqual([
      ['25.00', '11.46', PALETTE.acProg],
      ['66.67', '25.00', PALETTE.acProg],
    ]);
  });

  it('perSlot weekend starts at 07:30; no bars without a program', async () => {
    const tl = await new MockDataSource('perSlot').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const sat = weekRows(tl.systems, tl.clock.now, tl.clock.timeZone)[5]!;
    expect(sat.bars[0]!.slots[1]!.leftPct).toBe(31.25);
    expect(sat.bars[1]!.slots[0]!.leftPct).toBe(31.25);
    const none = await new MockDataSource('noProgram').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(weekRows(none.systems, none.clock.now, none.clock.timeZone)[0]!.bars).toEqual([]);
  });

  it('onOff: thin bar of the on-slots only', async () => {
    const tl = await new MockDataSource('manyRooms').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const deum = weekRows(tl.systems, tl.clock.now, tl.clock.timeZone)[0]!.bars[2]!;
    expect(deum.variant).toBe('thin');
    expect(deum.slots).toHaveLength(2);
    expect(deum.slots.every((s) => s.fill === PALETTE.acProg && !s.showValue)).toBe(true);
  });
});
