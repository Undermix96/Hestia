// Slot editor drafts: bounds, null when unchanged, field per representation, time bounds, day scope.
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../src/api/datasource/mock/MockDataSource';
import { WEEKDAYS, type RoomTimeline } from '../../src/api/types';
import { hhmmToMinutes, minutesToHhmm } from '../../src/lib/time';
import {
  currentDraftTimes,
  currentDraftValue,
  draftContext,
  draftForTimes,
  draftForValue,
  stepValue,
  timeBounds,
  valueBounds,
} from '../../src/modules/clima/logic/editorDraft';
import { editorAvailability } from '../../src/modules/clima/logic/editorOptions';

const OVERRIDE = { scopes: ['slot' as const], futureSlots: false, step: 0.5, minDelta: -4, maxDelta: 4, expiry: 'external' as const };

function lane(tl: RoomTimeline, systemId: string) {
  return tl.lanes.find((l) => l.systemId === systemId)!;
}
function current(tl: RoomTimeline, systemId: string) {
  return lane(tl, systemId).segments.find((s) => s.state === 'current')!;
}

describe('value bounds', () => {
  it('±4 around the programmed value, step 0.5', () => {
    expect(valueBounds(21, OVERRIDE)).toEqual({ min: 17, max: 25, step: 0.5 });
  });
  it('stepValue clamps and snaps', () => {
    const b = valueBounds(21, OVERRIDE);
    expect(stepValue(21, 0.5, b)).toBe(21.5);
    expect(stepValue(21, -0.5, b)).toBe(20.5);
    expect(stepValue(24.5, 1, b)).toBe(25);
    expect(stepValue(17, -0.5, b)).toBe(17);
    expect(stepValue(21.2, 0, b)).toBe(21);
    expect(stepValue(0.1 + 0.2, 0, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
  });
});

describe('value drafts', () => {
  it('slot: null when unchanged, targetC otherwise, every other field null', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const seg = current(tl, 'z-soggiorno');
    const ctx = draftContext(tl, 'z-soggiorno', seg, 'slot');
    expect(ctx.programmedC).toBe(21);
    expect(ctx.committedC).toBeNull();
    expect(draftForValue(ctx, 'slot', 21)).toBeNull();
    const d = draftForValue(ctx, 'slot', 22)!;
    expect(d).toEqual({
      systemId: 'z-soggiorno',
      slotRef: 'fri-1',
      day: 'fri',
      scope: 'slot',
      change: { deltaC: null, targetC: 22, levelValueC: null, from: null, to: null, days: null },
      validUntil: null,
    });
    expect(currentDraftValue(ctx, null)).toBe(21);
    expect(currentDraftValue(ctx, d)).toBe(22);
  });

  it('permanentValue on levels: levelValueC of the slot level', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const ctx = draftContext(tl, 'z-soggiorno', current(tl, 'z-soggiorno'), 'permanentValue');
    expect(ctx.programmedC).toBe(21);
    const d = draftForValue(ctx, 'permanentValue', 20.5)!;
    expect(d.scope).toBe('permanentValue');
    expect(d.change).toEqual({ deltaC: null, targetC: null, levelValueC: 20.5, from: null, to: null, days: null });
    expect(currentDraftValue(ctx, d)).toBe(20.5);
  });

  it('permanentValue on perSlot: targetC', async () => {
    const tl = await new MockDataSource('perSlot').getRoomTimeline({ roomId: 'camera', range: '24h' });
    const ctx = draftContext(tl, 'z-camera', current(tl, 'z-camera'), 'permanentValue');
    expect(ctx.programmedC).toBe(18);
    expect(draftForValue(ctx, 'permanentValue', 18)).toBeNull();
    const d = draftForValue(ctx, 'permanentValue', 18.5)!;
    expect(d.change).toEqual({ deltaC: null, targetC: 18.5, levelValueC: null, from: null, to: null, days: null });
  });

  it('a committed slot override is the reference while editing it again', async () => {
    const ds = new MockDataSource('home');
    let tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    const ctx0 = draftContext(tl, 'z-bagno', current(tl, 'z-bagno'), 'slot');
    await ds.createOverride(draftForValue(ctx0, 'slot', 22)!);
    tl = await ds.getRoomTimeline({ roomId: 'bagno', range: '24h' });
    const ctx = draftContext(tl, 'z-bagno', current(tl, 'z-bagno'), 'slot');
    expect(ctx.programmedC).toBe(23);
    expect(ctx.committedC).toBe(22);
    expect(currentDraftValue(ctx, null)).toBe(22);
    expect(draftForValue(ctx, 'slot', 22)).toBeNull();
    expect(draftForValue(ctx, 'slot', 23)!.change.targetC).toBe(23);
  });
});

describe('time bounds', () => {
  it('full-coverage day: neighbours are never swallowed, first/last edges fixed', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const program = tl.systems.find((s) => s.id === 'z-soggiorno')!.program!;
    expect(timeBounds(program, 'fri', 'fri-1', 30)).toEqual({
      fromMin: 30,
      fromMax: 1350,
      toMin: 390,
      toMax: 1410,
      fixedFrom: false,
      fixedTo: false,
    });
    expect(timeBounds(program, 'fri', 'fri-0', 30)).toMatchObject({ fromMin: 0, fromMax: 0, fixedFrom: true, toMax: 1350 });
    expect(timeBounds(program, 'fri', 'fri-2', 30)).toMatchObject({ toMin: 1440, toMax: 1440, fixedTo: true, fromMin: 390 });
    expect(timeBounds(program, 'fri', 'fri-1', 30, { from: '07:00', to: '20:00' })).toMatchObject({ fromMax: 1170, toMin: 450 });
  });

  it('gap day: no overlap with neighbours', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const program = tl.systems.find((s) => s.id === 'ac-soggiorno')!.program!;
    expect(timeBounds(program, 'fri', 'fri-0', 30)).toEqual({
      fromMin: 0,
      fromMax: 495,
      toMin: 390,
      toMax: 960,
      fixedFrom: false,
      fixedTo: false,
    });
    expect(timeBounds(program, 'fri', 'fri-1', 30)).toMatchObject({ fromMin: 525, toMax: 1440 });
    expect(() => timeBounds(program, 'fri', 'nope', 30)).toThrow();
  });
});

describe('time drafts', () => {
  it('perDay: days = [day]; null when unchanged', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const ctx = draftContext(tl, 'z-soggiorno', current(tl, 'z-soggiorno'), 'permanentTimes');
    expect(draftForTimes(ctx, '06:00', '23:00')).toBeNull();
    const d = draftForTimes(ctx, '07:00', '23:00')!;
    expect(d.scope).toBe('permanentTimes');
    expect(d.change).toEqual({ deltaC: null, targetC: null, levelValueC: null, from: '07:00', to: '23:00', days: ['fri'] });
    expect(currentDraftTimes(ctx, null)).toEqual({ from: '06:00', to: '23:00' });
    expect(currentDraftTimes(ctx, d)).toEqual({ from: '07:00', to: '23:00' });
  });

  it('dayScope all: every weekday', async () => {
    const tl = await new MockDataSource('manyRooms').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const seg = lane(tl, 'deum-soggiorno').segments.find((s) => s.state === 'future' && s.slotRef != null)!;
    const ctx = draftContext(tl, 'deum-soggiorno', seg, 'permanentTimes');
    const d = draftForTimes(ctx, '09:30', '12:00')!;
    expect(d.change.days).toEqual([...WEEKDAYS]);
  });
});

describe('drafts built by the editor are accepted by the mock', () => {
  it.each(['home', 'perSlot', 'manyRooms'] as const)('%s', async (scenario) => {
    const ds = new MockDataSource(scenario);
    const rooms = await ds.getRooms();
    for (const room of rooms.filter((r) => r.hasSensor)) {
      const tl = await ds.getRoomTimeline({ roomId: room.id, range: '24h' });
      for (const l of tl.lanes) {
        const sys = tl.systems.find((s) => s.id === l.systemId)!;
        for (const seg of l.segments) {
          const a = editorAvailability(seg, sys.capabilities, l.representation);
          for (const option of a.options) {
            const ctx = draftContext(tl, l.systemId, seg, option);
            let draft;
            if (option === 'permanentTimes') {
              const step = sys.capabilities.program.minuteStep;
              const b = timeBounds(sys.program!, seg.day!, seg.slotRef!, step);
              const from = hhmmToMinutes(seg.slotFrom!);
              const to = hhmmToMinutes(seg.slotTo!);
              // Move the start later by one step when allowed, else the end earlier.
              draft = !b.fixedFrom && from + step <= b.fromMax
                ? draftForTimes(ctx, minutesToHhmm(from + step), seg.slotTo!)
                : draftForTimes(ctx, seg.slotFrom!, minutesToHhmm(to - step));
            } else {
              draft = draftForValue(ctx, option, (ctx.programmedC ?? 20) + 0.5);
            }
            expect(draft).not.toBeNull();
            if (!draft) continue;
            const preview = await ds.getRoomTimeline({ roomId: room.id, range: '24h', draft });
            expect(preview.lanes.find((x) => x.systemId === l.systemId)).toBeDefined();
          }
        }
      }
    }
  });
});
