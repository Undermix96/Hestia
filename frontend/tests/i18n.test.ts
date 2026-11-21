import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import catalog from '../../locales/it.json';
import { hasMessage, intlLocale, locale, t, tDynamic } from '../src/i18n';
import { fmt } from '../src/i18n/format';

const TZ = 'Europe/Rome';

describe('catalog (locales/it.json)', () => {
  const entries = Object.entries(catalog).filter(([key]) => key !== 'meta');

  it('is flat: every key except meta is a string message', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof value, key).toBe('string');
    }
  });

  it('has a meta object', () => {
    expect(catalog.meta).toEqual({ name: 'Italiano', fallback: 'en' });
  });

  it('every message compiles with IntlMessageFormat', () => {
    for (const [key, value] of entries) {
      expect(() => new IntlMessageFormat(value as string, intlLocale), key).not.toThrow();
    }
  });

  it('uses the typographic apostrophe (ICU treats the ASCII one as a quote)', () => {
    for (const [key, value] of entries) {
      expect(value as string, key).not.toContain("'");
    }
  });
});

describe('t()', () => {
  it('locale constants', () => {
    expect(locale).toBe('it');
    expect(intlLocale).toBe('it-IT');
  });

  it('returns a plain message', () => {
    expect(t('app.name')).toBe('Hestia');
    expect(t('module.clima.tutte')).toBe('Tutte le stanze');
  });

  it('interpolates arguments', () => {
    expect(t('header.dateTime', { date: 'ven 20 nov', time: '08:30' })).toBe('ven 20 nov · 08:30');
    expect(t('clima.status.viaRoom', { system: 'caloriferi', action: 'standby', room: 'Bagno' })).toBe(
      'caloriferi standby (con Bagno)',
    );
  });

  it('handles ICU select, with booleans passed as strings', () => {
    const key = 'clima.summary.system.heatingTowards.radiator';
    expect(t(key, { target: '21,0', overshoot: 'false' })).toBe(
      'I caloriferi stanno scaldando verso 21,0°.',
    );
    expect(t(key, { target: '21,0', overshoot: 'true' })).toBe(
      'I caloriferi stanno scaldando verso 21,0°, tra poco vanno in standby.',
    );
    // A boolean value is converted with String().
    expect(t(key, { target: '21,0', overshoot: true })).toBe(
      'I caloriferi stanno scaldando verso 21,0°, tra poco vanno in standby.',
    );
    expect(t('clima.power.title', { kind: 'ac' })).toBe('Corrente climatizzatori');
    expect(t('clima.power.title', { kind: 'mixed' })).toBe('Corrente impianti');
  });

  it('handles ICU plural', () => {
    expect(t('clima.week.sources', { count: 1, list: 'caloriferi' })).toBe('solo caloriferi');
    expect(t('clima.week.sources', { count: 2, list: 'caloriferi + climatizzatore' })).toBe(
      'caloriferi + climatizzatore',
    );
  });

  it('throws on a missing argument in tests (strict mode)', () => {
    expect(() => t('header.dateTime', { date: 'x' })).toThrow();
  });
});

describe('tDynamic() and hasMessage()', () => {
  it('uses the key when it exists', () => {
    expect(tDynamic('kind.ac.name', 'kind.generic.name')).toBe('Climatizzatore');
  });

  it('falls back when the key is missing', () => {
    expect(tDynamic('kind.dehumidifier.name', 'kind.generic.name')).toBe('Impianto');
    expect(tDynamic('kind.dehumidifier.modeLabel', 'kind.generic.modeLabel', { system: 'X', room: 'Y' })).toBe(
      'Modalità X · Y',
    );
  });

  it('hasMessage', () => {
    expect(hasMessage('app.name')).toBe(true);
    expect(hasMessage('mock.room.bagno')).toBe(true);
    expect(hasMessage('meta')).toBe(false);
    expect(hasMessage('no.such.key')).toBe(false);
    expect(hasMessage('toString')).toBe(false);
  });
});

describe('fmt', () => {
  it('temp: one decimal with a comma', () => {
    expect(fmt.temp(21.8)).toBe('21,8');
    expect(fmt.temp(21)).toBe('21,0');
    expect(fmt.temp(5.94)).toBe('5,9');
    expect(fmt.temp(-1.25)).toBe('-1,3');
  });

  it('decimal and pct', () => {
    expect(fmt.decimal(22.1, 2)).toBe('22,10');
    expect(fmt.decimal(79.4, 0)).toBe('79');
    expect(fmt.decimal(1.26, 1)).toBe('1,3');
    expect(fmt.decimal(1234.5, 1)).toBe('1234,5');
    expect(fmt.pct(47.4)).toBe('47');
    expect(fmt.pct(82.6)).toBe('83');
  });

  it('signedTemp', () => {
    expect(fmt.signedTemp(0.5)).toBe('+0,5');
    expect(fmt.signedTemp(-1)).toBe('-1,0');
  });

  it('time: HH:mm in the given zone, never the machine zone', () => {
    expect(fmt.time('2026-11-20T08:30:00+01:00', TZ)).toBe('08:30');
    expect(fmt.time('2026-11-20T07:30:00Z', TZ)).toBe('08:30');
    expect(fmt.time('2026-11-20T23:00:00Z', TZ)).toBe('00:00');
    expect(fmt.time('2026-07-20T06:30:00Z', TZ)).toBe('08:30');
  });

  it('slotTime', () => {
    expect(fmt.slotTime('24:00')).toBe('00:00');
    expect(fmt.slotTime('06:30')).toBe('06:30');
  });

  it('dayLabel', () => {
    expect(fmt.dayLabel('2026-11-14T00:00:00+01:00', TZ)).toBe('sab 14');
    expect(fmt.dayLabel('2026-11-19T12:00:00+01:00', TZ)).toBe('gio 19');
  });

  it('headerDate', () => {
    expect(fmt.headerDate(new Date('2026-11-20T08:30:00+01:00'), TZ)).toBe('ven 20 nov');
  });

  it('monthName', () => {
    expect(fmt.monthName(11)).toBe('Novembre');
    expect(fmt.monthName(1)).toBe('Gennaio');
  });

  it('weekdayShort', () => {
    expect(fmt.weekdayShort('mon')).toBe('Lun');
    expect(fmt.weekdayShort('sun')).toBe('Dom');
  });
});
