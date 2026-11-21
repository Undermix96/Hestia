// MockDataSource: scenarios, aggregates, determinism, drafts, stored overrides and validation.
import { describe, expect, it, vi } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import { DataSourceError, SCENARIO_IDS } from '../../src/api/datasource/types';
import type { OverrideChange, OverrideCreate, RoomTimeline } from '../../src/api/types';
import { editorAvailability } from '../../src/modules/clima/logic/editorOptions';
import { kindSpec } from '../../src/modules/clima/systemKinds';

const fmt = (v: number | null | undefined) => (v == null ? null : v.toFixed(1));
const NULL_CHANGE: OverrideChange = { deltaC: null, targetC: null, levelValueC: null, from: null, to: null, days: null };

function change(body: Partial<OverrideCreate> & Pick<OverrideCreate, 'systemId' | 'slotRef' | 'scope'>, c: Partial<OverrideChange>): OverrideCreate {
  return { day: 'fri', validUntil: null, ...body, change: { ...NULL_CHANGE, ...c } };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(DataSourceError);
  await expect(p).rejects.toMatchObject({ code });
}

const now = (tl: RoomTimeline) => tl.grid.nowIndex;

describe('every scenario', () => {
  it.each(SCENARIO_IDS)('%s: grid, rooms and determinism', async (id) => {
    const a = new MockDataSource(id);
    const b = new MockDataSource(id);
    expect(a.kind).toBe('mock');
    expect(a.scenario).toBe(id);
    expect(a.timeZone).toBe('Europe/Rome');
    expect(a.now().toISOString()).toBe('2026-11-20T07:30:00.000Z');
    const rooms = await a.getRooms();
    expect(rooms.length).toBeGreaterThanOrEqual(6);
    for (const range of ['24h', '7d'] as const) {
      const ov = await a.getOverview({ range });
      expect(JSON.stringify(ov)).toBe(JSON.stringify(await b.getOverview({ range })));
      expect(ov.rows.map((r) => r.room.id)).toEqual(rooms.map((r) => r.id));
      for (const room of rooms) {
        const tl = await a.getRoomTimeline({ roomId: room.id, range });
        expect(JSON.stringify(tl)).toBe(JSON.stringify(await b.getRoomTimeline({ roomId: room.id, range })));
        expect(tl.rooms).toHaveLength(rooms.length);
        expect(tl.lanes.map((l) => l.systemId)).toEqual(tl.systems.map((s) => s.id));
        for (const l of tl.lanes) {
          expect(l.targetC).toHaveLength(tl.grid.count);
          expect(l.action).toHaveLength(tl.grid.count);
        }
        expect(tl.climate.measuredC).toHaveLength(tl.grid.count);
      }
    }
  });

  it.each([
    ['24h', 52, 48, '2026-11-19T08:30:00+01:00', '2026-11-20T10:30:00+01:00'],
    ['7d', 360, 336, '2026-11-13T08:30:00+01:00', '2026-11-20T20:30:00+01:00'],
  ] as const)('grid %s', async (range, count, nowIndex, t0, end) => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range });
    expect(tl.grid).toMatchObject({ range, count, nowIndex, stepMinutes: 30, end });
    expect(tl.grid.t).toHaveLength(count);
    expect(tl.grid.t[0]).toBe(t0);
    expect(tl.grid.t[nowIndex]).toBe('2026-11-20T08:30:00+01:00');
    expect(tl.clock).toEqual({ now: '2026-11-20T08:30:00+01:00', timeZone: 'Europe/Rome' });
    // measured up to now, forecast from now
    expect(tl.climate.measuredC[nowIndex + 1]).toBeNull();
    expect(tl.climate.forecastC[nowIndex - 1]).toBeNull();
    expect(tl.climate.forecastC[nowIndex]).toBe(tl.climate.measuredC[nowIndex]);
    expect(tl.outdoor.nowC).toBe(tl.outdoor.measuredC[nowIndex]);
  });

  it('returns independent copies', async () => {
    const ds = new MockDataSource('home');
    const a = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    a.lanes[0]!.targetC[0] = 99;
    a.grid.t[0] = 'x';
    const b = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(b.lanes[0]!.targetC[0]).toBe(21);
    expect(b.grid.t[0]).toBe('2026-11-19T08:30:00+01:00');
  });

  it('honours an abort signal and resolves asynchronously', async () => {
    const ds = new MockDataSource('home');
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(ds.getRooms(ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(ds.getOverview({ range: '24h' }, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const late = new AbortController();
    const p = ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' }, late.signal);
    late.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('unknown room → not_found', async () => {
    await expectCode(new MockDataSource('home').getRoomTimeline({ roomId: 'garage', range: '24h' }), 'not_found');
  });
});

describe('home', () => {
  const ds = new MockDataSource('home');

  it('rooms, lanes and shared zone', async () => {
    const rooms = await ds.getRooms();
    expect(rooms.map((r) => r.id)).toEqual(['soggiorno', 'corridoio', 'camera', 'cameretta', 'bagno', 'ripostiglio']);
    expect(rooms.find((r) => r.id === 'ripostiglio')).toMatchObject({ hasSensor: false, followsRoomId: 'bagno', systemIds: ['z-bagno'] });
    const tl = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(tl.lanes.map((l) => [l.systemId, l.kind, l.representation])).toEqual([
      ['z-soggiorno', 'radiator', 'levels'],
      ['ac-soggiorno', 'ac', 'levels'],
    ]);
    const rip = tl.rooms.find((r) => r.roomId === 'ripostiglio')!;
    expect(rip).toMatchObject({ temperatureC: null, humidityPct: null, hasSensor: false });
    expect(rip.systems).toEqual([expect.objectContaining({ systemId: 'z-bagno', viaRoomId: 'bagno', action: 'heat' })]);
    expect(tl.rooms.find((r) => r.roomId === 'bagno')!.systems[0]!.viaRoomId).toBeNull();
    expect(tl.systems[0]).toMatchObject({ primaryRoomId: 'soggiorno', behavior: 'always_on_target', adapters: { program: 'ha_schedule_levels' } });
    expect(tl.systems[1]!.adapters.power).toBe('estimate');
    expect(tl.sources.outdoor.forecastHours).toBe(12);
  });

  it('values at now (D8: 24h and 7d differ like the screenshots)', async () => {
    const t24 = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const t7 = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '7d' });
    expect(fmt(t24.climate.measuredC[now(t24)])).toBe('21.8');
    expect(fmt(t7.climate.measuredC[now(t7)])).toBe('21.5');
    expect(Math.round(t24.climate.measuredHumidityPct[now(t24)]!)).toBe(47);
    expect(fmt(t24.outdoor.nowC)).toBe('5.9');
    expect(Math.round(t24.outdoor.nowHumidityPct!)).toBe(83);
    expect(t24.lanes.map((l) => [l.action[now(t24)], l.targetC[now(t24)]])).toEqual([
      ['idle', 21],
      ['heat', 21.5],
    ]);
    expect(t24.systems[1]!.state).toEqual({ mode: 'heat', action: 'heat', targetC: 21.5 });
  });

  it('power summary (always from the 24h simulation)', async () => {
    for (const range of ['24h', '7d'] as const) {
      const { power } = await ds.getRoomTimeline({ roomId: 'camera', range });
      expect(fmt(power.nowKw)).toBe('1.3');
      expect(fmt(power.last24HKwh)).toBe('8.8');
      expect(fmt(power.last24HCost)).toBe('2.5');
      expect(power).toMatchObject({
        kind: 'estimated',
        month: 11,
        monthKwh: 79,
        monthCost: 22.1,
        currency: 'EUR',
        tariffPerKwh: 0.28,
        measuredSystemIds: [],
        unmeasuredKinds: ['radiator'],
      });
    }
  });

  it('next program changes', async () => {
    const next = async (roomId: string) =>
      (await ds.getRoomTimeline({ roomId, range: '24h' })).lanes.map((l) => [l.systemId, l.nextChange]);
    expect(await next('soggiorno')).toEqual([
      ['z-soggiorno', { at: '2026-11-20T23:00:00+01:00', change: 'target', targetC: 18.5 }],
      ['ac-soggiorno', { at: '2026-11-20T08:45:00+01:00', change: 'off', targetC: null }],
    ]);
    expect(await next('corridoio')).toEqual([['ac-corridoio', { at: '2026-11-20T09:00:00+01:00', change: 'off', targetC: null }]]);
    expect(await next('camera')).toEqual([['z-camera', { at: '2026-11-20T21:00:00+01:00', change: 'target', targetC: 19.5 }]]);
    expect(await next('cameretta')).toEqual([['z-cameretta', { at: '2026-11-20T19:00:00+01:00', change: 'target', targetC: 20 }]]);
    expect(await next('bagno')).toEqual([['z-bagno', { at: '2026-11-20T09:00:00+01:00', change: 'target', targetC: 20 }]]);
  });

  it('target band follows the radiator, then the split', async () => {
    const tl = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const i = now(tl);
    expect(tl.target.targetC[i]).toBe(21);
    expect(tl.target.sourceSystemIds[i]).toBe('z-soggiorno');
    expect(tl.target.comfortLowC[i]).toBe(21 - 0.3);
    expect(tl.target.comfortHighC[i]).toBe(21 + 0.2);
    const corr = await ds.getRoomTimeline({ roomId: 'corridoio', range: '24h' });
    expect(corr.target.targetC[i]).toBe(20.5);
    expect(corr.target.targetC[i + 1]).toBeNull();
    expect(corr.target.sourceSystemIds[i + 1]).toBeNull();
  });

  it('overview rows: no climate/target without sensor, shared systems included', async () => {
    const ov = await ds.getOverview({ range: '24h' });
    expect(ov.rows).toHaveLength(6);
    const rip = ov.rows.find((r) => r.room.id === 'ripostiglio')!;
    expect(rip.climate).toBeNull();
    expect(rip.target).toBeNull();
    expect(rip.systems.map((s) => s.systemId)).toEqual(['z-bagno']);
    expect(rip.status.systems[0]!.viaRoomId).toBe('bagno');
    expect(ov.rows[0]!.systems.map((s) => s.systemId)).toEqual(['z-soggiorno', 'ac-soggiorno']);
  });
});

describe('scenario invariants', () => {
  it('perSlot: per-slot values and a 07:30 weekend start', async () => {
    const tl = await new MockDataSource('perSlot').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    for (const s of tl.systems) {
      expect(s.program!.representation).toBe('perSlot');
      expect(s.program!.levels).toBeNull();
      expect(s.adapters.program).toBe('ha_schedule_data');
    }
    const rad = tl.systems[0]!.program!;
    expect(rad.days.fri.map((s) => [s.from, s.to, s.targetC])).toEqual([
      ['00:00', '06:00', 18.5],
      ['06:00', '23:00', 21],
      ['23:00', '24:00', 18.5],
    ]);
    expect(rad.days.sat.map((s) => [s.from, s.to])).toEqual([
      ['00:00', '07:30'],
      ['07:30', '23:00'],
      ['23:00', '24:00'],
    ]);
    expect(tl.systems[1]!.program!.days.sun[0]!.from).toBe('07:30');
    const a = editorAvailability(tl.lanes[0]!.segments.find((s) => s.state === 'current')!, tl.systems[0]!.capabilities, 'perSlot');
    expect(a.options).toEqual(['slot', 'permanentValue', 'permanentTimes']);
  });

  it('readonly: no write capabilities, nothing clickable', async () => {
    const ds = new MockDataSource('readonly');
    for (const room of await ds.getRooms()) {
      const tl = await ds.getRoomTimeline({ roomId: room.id, range: '24h' });
      for (const [i, s] of tl.systems.entries()) {
        expect(s.capabilities.program).toMatchObject({ writeLevelValues: false, writeSlotValue: false, writeTimes: false });
        expect(s.capabilities.override.scopes).toEqual([]);
        for (const seg of tl.lanes[i]!.segments) {
          expect(editorAvailability(seg, s.capabilities, tl.lanes[i]!.representation).clickable).toBe(false);
        }
      }
    }
  });

  it('noProgram: representation none, no segments, constant target band, splits off', async () => {
    const ds = new MockDataSource('noProgram');
    const tl = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    for (const l of tl.lanes) {
      expect(l.representation).toBe('none');
      expect(l.segments).toEqual([]);
      expect(l.nextChange).toBeNull();
    }
    expect(new Set(tl.target.targetC)).toEqual(new Set([20.5]));
    expect(new Set(tl.lanes[1]!.action)).toEqual(new Set(['off']));
    expect(new Set(tl.lanes[1]!.mode)).toEqual(new Set(['off']));
    expect(tl.systems[1]!.adapters).toMatchObject({ program: 'none', override: 'disabled' });
    const corr = await ds.getRoomTimeline({ roomId: 'corridoio', range: '24h' });
    expect(new Set(corr.target.targetC)).toEqual(new Set([null]));
    const bagno = await ds.getRoomTimeline({ roomId: 'bagno', range: '7d' });
    expect(new Set(bagno.target.targetC)).toEqual(new Set([21]));
  });

  it('manyRooms: 10 rooms, a room with 3 systems, a generic dehumidifier', async () => {
    const ds = new MockDataSource('manyRooms');
    const rooms = await ds.getRooms();
    expect(rooms).toHaveLength(10);
    expect(rooms.filter((r) => r.hasSensor)).toHaveLength(8);
    expect(rooms.filter((r) => r.followsRoomId).map((r) => [r.id, r.followsRoomId])).toEqual([
      ['ripostiglio', 'bagno'],
      ['lavanderia', 'bagno2'],
    ]);
    const tl = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(tl.lanes.map((l) => l.kind)).toEqual(['radiator', 'ac', 'dehumidifier']);
    expect(kindSpec('dehumidifier').messageKind).toBe('generic');
    const deum = tl.lanes[2]!;
    expect(deum.representation).toBe('onOff');
    expect(deum.nameKey).toBe('mock.system.dehumidifier');
    expect(deum.nextChange).toEqual({ at: '2026-11-20T10:00:00+01:00', change: 'on', targetC: null });
    expect(deum.action[now(tl)]).toBe('off');
    expect(deum.action[now(tl) + 3]).toBe('dry');
    expect(deum.segments.some((s) => s.on === true)).toBe(true);
    // displayTargetSystemId: the split's set point wins while it is programmed
    expect(tl.target.sourceSystemIds[now(tl)]).toBe('ac-soggiorno');
    expect(tl.target.targetC[now(tl)]).toBe(21.5);
    expect(tl.target.sourceSystemIds[now(tl) + 1]).toBe('z-soggiorno');
    expect(tl.power.unmeasuredKinds).toEqual(['radiator', 'dehumidifier']);
    const ov = await ds.getOverview({ range: '7d' });
    expect(ov.rows).toHaveLength(10);
    const studio = await ds.getRoomTimeline({ roomId: 'studio', range: '24h' });
    expect(studio.lanes[0]!.representation).toBe('perSlot');
    const b2 = await ds.getRoomTimeline({ roomId: 'lavanderia', range: '24h' });
    expect(b2.systems[0]!.capabilities.override.scopes).toEqual([]);
    expect(b2.rooms.find((r) => r.roomId === 'lavanderia')!.systems[0]!.viaRoomId).toBe('bagno2');
  });
});

describe('drafts and overrides', () => {
  const bagnoSlot = (targetC: number) => change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'slot' }, { targetC });

  it('a draft changes only samples from now on and is never stored', async () => {
    const ds = new MockDataSource('home');
    const base = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    const preview = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h', draft: bagnoSlot(19) });
    const i = now(base);
    expect(preview.climate.measuredC.slice(0, i)).toEqual(base.climate.measuredC.slice(0, i));
    expect(preview.climate.measuredHumidityPct.slice(0, i)).toEqual(base.climate.measuredHumidityPct.slice(0, i));
    expect(preview.lanes[0]!.targetC.slice(0, i)).toEqual(base.lanes[0]!.targetC.slice(0, i));
    expect(preview.lanes[0]!.action.slice(0, i)).toEqual(base.lanes[0]!.action.slice(0, i));
    expect(preview.lanes[0]!.targetC[i]).toBe(19);
    expect(preview.lanes[0]!.targetC[i + 1]).toBe(20); // 09:00: the slot ended, day level unchanged
    expect(base.lanes[0]!.action[i]).toBe('heat');
    expect(preview.lanes[0]!.action[i]).toBe('idle');
    expect(preview.climate.forecastC).not.toEqual(base.climate.forecastC);
    const seg = preview.lanes[0]!.segments.find((s) => s.state === 'current')!;
    expect(seg).toMatchObject({ edited: true, overrideId: null, targetC: 19, programmedTargetC: 23, startIndex: i });
    const past = preview.lanes[0]!.segments.find((s) => s.endIndex === i)!;
    expect(past).toMatchObject({ state: 'past', edited: false, targetC: 23, slotRef: 'fri-1' });
    expect(preview.overrides).toEqual([]);
    expect(await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' })).toEqual(base);
  });

  it('createOverride (slot) stores it, notifies, marks the segment; delete restores', async () => {
    const ds = new MockDataSource('home');
    const base = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    const baseOverview = await ds.getOverview({ range: '24h' });
    const listener = vi.fn();
    const unsubscribe = ds.subscribe(listener);
    const o = await ds.createOverride(bagnoSlot(19.5));
    expect(o).toEqual({
      id: 'ovr-1',
      systemId: 'z-bagno',
      slotRef: 'fri-1',
      day: 'fri',
      scope: 'slot',
      change: { ...NULL_CHANGE, targetC: 19.5 },
      status: 'active',
      validFrom: '2026-11-20T08:30:00+01:00',
      validUntil: '2026-11-20T09:00:00+01:00',
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    expect(tl.overrides).toEqual([o]);
    expect(tl.lanes[0]!.targetC[now(tl)]).toBe(19.5);
    expect(tl.climate.forecastC).not.toEqual(base.climate.forecastC);
    const seg = tl.lanes[0]!.segments.find((s) => s.state === 'current')!;
    expect(seg).toMatchObject({ edited: true, overrideId: 'ovr-1', targetC: 19.5 });
    // the shared zone and Tutte see it too
    expect((await ds.getRoomTimeline({ roomId: 'ripostiglio', range: '24h' })).overrides).toEqual([o]);
    expect((await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' })).overrides).toEqual([]);
    const ov = await ds.getOverview({ range: '24h' });
    expect(ov.rows[4]!.systems[0]!.targetC[now(tl)]).toBe(19.5);
    // same key → replaced
    const o2 = await ds.createOverride(bagnoSlot(22));
    expect(o2.id).toBe('ovr-2');
    expect((await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' })).overrides.map((x) => x.id)).toEqual(['ovr-2']);
    await ds.deleteOverride('ovr-2');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' })).toEqual(base);
    expect(await ds.getOverview({ range: '24h' })).toEqual(baseOverview);
    await expectCode(ds.deleteOverride('ovr-2'), 'not_found');
    unsubscribe();
    await ds.createOverride(bagnoSlot(22));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a draft on an overridden slot replaces the committed value in the preview', async () => {
    const ds = new MockDataSource('home');
    await ds.createOverride(bagnoSlot(21.5));
    const preview = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h', draft: bagnoSlot(24) });
    const seg = preview.lanes[0]!.segments.find((s) => s.state === 'current')!;
    expect(seg).toMatchObject({ targetC: 24, edited: true, overrideId: null });
  });

  it('permanentValue on levels changes every slot of the level from now on', async () => {
    const ds = new MockDataSource('home');
    const before = await ds.getRoomTimeline({ roomId: 'bagno', range: '7d' });
    await ds.createOverride(change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'permanentValue' }, { levelValueC: 22 }));
    const tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '7d' });
    const sys = tl.systems[0]!;
    expect(sys.program!.levels!.find((l) => l.id === 'comfort')!.targetC).toBe(22);
    expect(sys.program!.version).toBe('mock-2');
    const i = now(tl);
    expect(tl.lanes[0]!.targetC.slice(0, i)).toEqual(before.lanes[0]!.targetC.slice(0, i));
    expect(tl.lanes[0]!.targetC[i]).toBe(22);
    // 18:00-22:00 today is also comfort
    const evening = tl.grid.t.indexOf('2026-11-20T18:00:00+01:00');
    expect(tl.lanes[0]!.targetC[evening]).toBe(22);
    const seg = tl.lanes[0]!.segments.find((s) => s.startIndex === evening)!;
    expect(seg).toMatchObject({ edited: true, programmedTargetC: 22, overrideId: 'ovr-1', state: 'future' });
  });

  it('permanentTimes moves the slot and its neighbour, after now only', async () => {
    const ds = new MockDataSource('home');
    await ds.createOverride(change({ systemId: 'z-soggiorno', slotRef: 'fri-1', scope: 'permanentTimes' }, { from: '06:00', to: '22:00', days: ['fri'] }));
    const tl = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '7d' });
    const day = tl.systems[0]!.program!.days.fri;
    expect(day.map((s) => [s.from, s.to])).toEqual([
      ['00:00', '06:00'],
      ['06:00', '22:00'],
      ['22:00', '24:00'],
    ]);
    expect(tl.systems[0]!.program!.days.thu[1]!.to).toBe('23:00');
    const i22 = tl.grid.t.indexOf('2026-11-20T22:00:00+01:00');
    expect(i22).toBeLessThan(0); // 7d future ends at 20:30
    const ds24 = new MockDataSource('home');
    const lanes = await ds24.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(lanes.lanes[0]!.nextChange!.at).toBe('2026-11-20T23:00:00+01:00');
    const tl24 = await ds.getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    expect(tl24.lanes[0]!.nextChange).toEqual({ at: '2026-11-20T22:00:00+01:00', change: 'target', targetC: 18.5 });
    const cur = tl24.lanes[0]!.segments.find((s) => s.state === 'current')!;
    expect(cur).toMatchObject({ slotFrom: '06:00', slotTo: '22:00', edited: true, overrideId: 'ovr-1' });
  });

  it.each<[string, OverrideCreate]>([
    ['until is not offered', { ...bagnoSlot(22), scope: 'until', validUntil: '2026-11-20T09:00:00+01:00' }],
    ['validUntil on slot', { ...bagnoSlot(22), validUntil: '2026-11-20T09:00:00+01:00' }],
    ['slot on a future slot', change({ systemId: 'z-bagno', slotRef: 'fri-2', scope: 'slot' }, { targetC: 21 })],
    ['slot on a past slot', change({ systemId: 'z-bagno', slotRef: 'fri-0', scope: 'slot' }, { targetC: 19.5 })],
    ['slot on another day', change({ systemId: 'z-bagno', slotRef: 'thu-1', day: 'thu', scope: 'slot' }, { targetC: 22 })],
    ['out of bounds', bagnoSlot(27.5)],
    ['not on the step grid', bagnoSlot(22.2)],
    ['both targetC and deltaC', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'slot' }, { targetC: 22, deltaC: -1 })],
    ['foreign field', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'slot' }, { targetC: 22, levelValueC: 22 })],
    ['permanentValue on an ended slot', change({ systemId: 'z-bagno', slotRef: 'fri-0', scope: 'permanentValue' }, { levelValueC: 20 })],
    ['permanentValue with targetC on levels', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'permanentValue' }, { targetC: 22 })],
    ['times off the grid', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'permanentTimes' }, { from: '06:10', to: '09:00' })],
    ['times swallowing a neighbour', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'permanentTimes' }, { from: '06:00', to: '18:00' })],
    ['first slot must start at 00:00', change({ systemId: 'z-bagno', slotRef: 'fri-4', scope: 'permanentTimes' }, { from: '22:00', to: '23:30' })],
    ['from after to', change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'permanentTimes' }, { from: '08:00', to: '07:00' })],
    ['unknown slot', change({ systemId: 'z-bagno', slotRef: 'fri-9', scope: 'slot' }, { targetC: 22 })],
    ['unknown system', change({ systemId: 'nope', slotRef: 'fri-1', scope: 'slot' }, { targetC: 22 })],
    ['gap overlap', change({ systemId: 'ac-soggiorno', slotRef: 'fri-0', scope: 'permanentTimes' }, { from: '06:00', to: '16:30' })],
  ])('rejects: %s', async (_name, body) => {
    const ds = new MockDataSource('home');
    await expectCode(ds.createOverride(body), 'invalid_change');
    await expectCode(ds.getRoomTimeline({ roomId: 'bagno', range: '24h', draft: body }), 'invalid_change');
  });

  it('rejects writes the capabilities do not allow', async () => {
    await expectCode(new MockDataSource('readonly').createOverride(bagnoSlot(22)), 'invalid_change');
    await expectCode(
      new MockDataSource('noProgram').createOverride(change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'slot' }, { targetC: 22 })),
      'invalid_change',
    );
    await expectCode(
      new MockDataSource('manyRooms').createOverride(change({ systemId: 'deum-soggiorno', slotRef: 'fri-0', scope: 'slot' }, { targetC: 22 })),
      'invalid_change',
    );
    const all = await new MockDataSource('manyRooms').createOverride(
      change({ systemId: 'deum-soggiorno', slotRef: 'fri-0', scope: 'permanentTimes' }, { from: '09:30', to: '12:00', days: null }),
    );
    expect(all.validUntil).toBeNull();
  });

  it('accepts a delta for a slot override', async () => {
    const ds = new MockDataSource('home');
    await ds.createOverride(change({ systemId: 'z-bagno', slotRef: 'fri-1', scope: 'slot' }, { deltaC: -1.5 }));
    const tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    expect(tl.lanes[0]!.targetC[now(tl)]).toBe(21.5);
  });
});
