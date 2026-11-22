import { describe, expect, it } from 'vitest';
import {
  hhmmToMinutes,
  hourOfDay,
  isoWithOffset,
  localDayIndex,
  localParts,
  localToEpoch,
  minuteOfDay,
  minutesToHhmm,
} from '../../src/lib/time';

const TZ = 'Europe/Rome';

describe('time helpers', () => {
  it('localParts in Rome', () => {
    const p = localParts(Date.parse('2026-11-20T08:30:00+01:00'), TZ);
    expect(p).toEqual({ year: 2026, month: 11, day: 20, hour: 8, minute: 30, weekday: 'fri' });
    expect(hourOfDay(p)).toBe(8.5);
    expect(minuteOfDay(p)).toBe(510);
    expect(localParts(Date.parse('2026-11-19T23:30:00Z'), TZ).weekday).toBe('fri');
  });

  it('isoWithOffset uses the zone offset of the instant (winter +01:00, summer +02:00)', () => {
    expect(isoWithOffset(Date.parse('2026-11-20T07:30:00Z'), TZ)).toBe('2026-11-20T08:30:00+01:00');
    expect(isoWithOffset(Date.parse('2026-07-15T10:00:00Z'), TZ)).toBe('2026-07-15T12:00:00+02:00');
    expect(isoWithOffset(Date.parse('2026-07-15T10:00:00Z'), 'UTC')).toBe('2026-07-15T10:00:00+00:00');
  });

  it('localToEpoch converts a wall time back', () => {
    expect(localToEpoch(2026, 11, 20, 510, TZ)).toBe(Date.parse('2026-11-20T08:30:00+01:00'));
    expect(localToEpoch(2026, 11, 20, 1440, TZ)).toBe(Date.parse('2026-11-21T00:00:00+01:00'));
    expect(localToEpoch(2026, 7, 15, 720, TZ)).toBe(Date.parse('2026-07-15T12:00:00+02:00'));
  });

  it('localDayIndex counts local dates', () => {
    const a = localDayIndex(localParts(Date.parse('2026-11-20T00:10:00+01:00'), TZ));
    const b = localDayIndex(localParts(Date.parse('2026-11-19T23:50:00+01:00'), TZ));
    expect(a - b).toBe(1);
  });

  it('HH:MM conversions', () => {
    expect(hhmmToMinutes('08:45')).toBe(525);
    expect(hhmmToMinutes('24:00')).toBe(1440);
    expect(minutesToHhmm(1440)).toBe('24:00');
    expect(minutesToHhmm(0)).toBe('00:00');
    expect(minutesToHhmm(525)).toBe('08:45');
    expect(() => hhmmToMinutes('8:45')).toThrow();
  });
});
