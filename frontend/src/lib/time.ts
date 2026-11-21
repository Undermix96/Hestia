// Time-zone helpers built on Intl. Never depend on the machine time zone: always pass an IANA zone.
import type { Weekday } from '../api/types';

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

interface FullParts extends LocalParts {
  second: number;
}

const WEEKDAY_BY_SHORT: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function fullParts(epochMs: number, timeZone: string): FullParts {
  const out: FullParts = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 'mon' };
  for (const p of formatter(timeZone).formatToParts(new Date(epochMs))) {
    switch (p.type) {
      case 'year':
        out.year = Number(p.value);
        break;
      case 'month':
        out.month = Number(p.value);
        break;
      case 'day':
        out.day = Number(p.value);
        break;
      case 'hour':
        out.hour = Number(p.value);
        break;
      case 'minute':
        out.minute = Number(p.value);
        break;
      case 'second':
        out.second = Number(p.value);
        break;
      case 'weekday': {
        const wd = WEEKDAY_BY_SHORT[p.value];
        if (!wd) throw new Error(`Unexpected weekday ${p.value}`);
        out.weekday = wd;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Local calendar parts of an instant in `timeZone`. */
export function localParts(epochMs: number, timeZone: string): LocalParts {
  const { second, ...parts } = fullParts(epochMs, timeZone);
  void second;
  return parts;
}

/** Offset of `timeZone` from UTC at an instant, in milliseconds (Rome in winter: +3 600 000). */
export function offsetMs(epochMs: number, timeZone: string): number {
  const p = fullParts(epochMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO 8601 with the zone's offset at that instant, e.g. '2026-11-20T08:30:00+01:00'. */
export function isoWithOffset(epochMs: number, timeZone: string): string {
  const p = fullParts(epochMs, timeZone);
  const off = Math.round(offsetMs(epochMs, timeZone) / 60000);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return (
    `${String(p.year).padStart(4, '0')}-${pad2(p.month)}-${pad2(p.day)}` +
    `T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

export function parseIso(iso: string): number {
  return Date.parse(iso);
}

/** Hour of the day with the minute as a fraction (08:30 → 8.5), like the mockup's `hAt`. */
export function hourOfDay(parts: LocalParts): number {
  return parts.hour + parts.minute / 60;
}

export function minuteOfDay(parts: LocalParts): number {
  return parts.hour * 60 + parts.minute;
}

/** Days since 1970-01-01 of the local calendar date. */
export function localDayIndex(parts: LocalParts): number {
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

/** Epoch ms of a local wall-clock time (`minutes` since local midnight, may be 1440) in `timeZone`. */
export function localToEpoch(year: number, month: number, day: number, minutes: number, timeZone: string): number {
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  let guess = wall - offsetMs(wall, timeZone);
  for (let i = 0; i < 2; i += 1) {
    const next = wall - offsetMs(guess, timeZone);
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

/** 'HH:MM' → minutes since midnight ('24:00' → 1440). */
export function hhmmToMinutes(v: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) throw new Error(`Invalid time ${v}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes since midnight → 'HH:MM' (1440 → '24:00'). */
export function minutesToHhmm(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
