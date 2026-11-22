/**
 * Locale-aware formatting of numbers and dates (Intl, `it-IT`).
 *
 * Dates are always formatted in an explicit IANA time zone (the data's
 * `clock.timeZone`, or the data source's zone for the header): never the
 * machine's zone.
 */
import type { Weekday } from '../api/types';
import { intlLocale, t } from './index';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(minDigits: number, maxDigits: number, signed = false): Intl.NumberFormat {
  const id = `${minDigits}|${maxDigits}|${signed}`;
  let nf = numberFormats.get(id);
  if (!nf) {
    nf = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
      ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    });
    numberFormats.set(id, nf);
  }
  return nf;
}

function dateFormat(id: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheId = `${id}|${options.timeZone ?? ''}`;
  let df = dateFormats.get(cacheId);
  if (!df) {
    df = new Intl.DateTimeFormat(intlLocale, options);
    dateFormats.set(cacheId, df);
  }
  return df;
}

function timeFormat(timeZone: string): Intl.DateTimeFormat {
  return dateFormat('time', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
}

export const fmt = {
  /** Temperature with one decimal: 21.8 → '21,8'. */
  temp(v: number): string {
    return numberFormat(1, 1).format(v);
  },
  /** Signed temperature delta with one decimal: 0.5 → '+0,5', -1 → '-1,0', 0 → '0,0'. */
  signedTemp(v: number): string {
    return numberFormat(1, 1, true).format(v);
  },
  /** Number with exactly `digits` decimals: (22.1, 2) → '22,10'. */
  decimal(v: number, digits: number): string {
    return numberFormat(digits, digits).format(v);
  },
  /** Percentage value without decimals: 47.4 → '47'. */
  pct(v: number): string {
    return numberFormat(0, 0).format(v);
  },
  /** Clock time 'HH:mm' (24 h) of an ISO timestamp in `tz`. */
  time(iso: string, tz: string): string {
    return timeFormat(tz).format(new Date(iso));
  },
  /** Program slot boundary 'HH:MM'. The end of the day stays '24:00' ("19:00–24:00", not the ambiguous "19:00–00:00"). */
  slotTime(hhmm: string): string {
    return hhmm;
  },
  /** Axis day label: 'sab 14'. */
  dayLabel(iso: string, tz: string): string {
    const date = new Date(iso);
    const weekday = dateFormat('weekdayShort', { weekday: 'short', timeZone: tz }).format(date);
    const day = dateFormat('dayNumeric', { day: 'numeric', timeZone: tz }).format(date);
    return t('clima.axis.day', { weekday, day });
  },
  /** Header date: 'ven 20 nov'. */
  headerDate(date: Date, tz: string): string {
    return dateFormat('headerDate', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: tz,
    }).format(date);
  },
  /** Month name, capitalised: 11 → 'Novembre'. */
  monthName(month: number): string {
    const name = dateFormat('monthLong', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, month - 1, 15)),
    );
    return name.charAt(0).toLocaleUpperCase(intlLocale) + name.slice(1);
  },
  /** Short weekday name from the catalog: 'mon' → 'Lun'. */
  weekdayShort(day: Weekday): string {
    return t(`common.weekday.${day}`);
  },
};
