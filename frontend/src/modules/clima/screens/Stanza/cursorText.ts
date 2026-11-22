// Texts of the chart cursor (tooltip, slider value text) at one sample of a room timeline.
import type { RoomTimeline } from '../../../../api/types';
import { t, tDynamic } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { cursorPhase } from '../../logic/cursor';

function temp(v: number | null | undefined): string {
  return v == null ? t('common.missingValue') : fmt.temp(v);
}

function pct(v: number | null | undefined): string {
  return v == null ? t('common.missingValue') : fmt.pct(v);
}

/** Room temperature at sample i (measured up to now, forecast after). */
export function roomTemperatureAt(tl: RoomTimeline, i: number): number | null {
  return tl.climate.measuredC[i] ?? tl.climate.forecastC[i] ?? null;
}

/** "ore 00:30" · "sab 14 · 00:30" · "adesso · 08:30" · "previsione · 10:00" */
export function cursorWhen(tl: RoomTimeline, i: number): string {
  const iso = tl.grid.t[i] ?? tl.grid.end;
  const tz = tl.clock.timeZone;
  const time = fmt.time(iso, tz);
  switch (cursorPhase(i, tl.grid.nowIndex)) {
    case 'now':
      return t('clima.cursor.now', { time });
    case 'forecast':
      return t('clima.cursor.forecast', { time });
    default:
      return tl.grid.range === '7d'
        ? t('clima.cursor.past7d', { day: fmt.dayLabel(iso, tz), time })
        : t('clima.cursor.past24h', { time });
  }
}

/** "21,3° · 49%" for the room at sample i. */
export function roomValueAt(tl: RoomTimeline, i: number): string {
  return t('clima.cursor.value', {
    temperature: temp(roomTemperatureAt(tl, i)),
    humidity: pct(tl.climate.measuredHumidityPct[i] ?? tl.climate.forecastHumidityPct[i]),
  });
}

/** "7,1° · 81%" outdoors at sample i. */
export function outdoorValueAt(tl: RoomTimeline, i: number): string {
  return t('clima.cursor.value', {
    temperature: temp(tl.outdoor.measuredC[i] ?? tl.outdoor.forecastC[i]),
    humidity: pct(tl.outdoor.measuredHumidityPct[i] ?? tl.outdoor.forecastHumidityPct[i]),
  });
}

/** "target 21,0°" / "set 21,5°" / "non programmato" for a system with target `targetC`. */
export function systemTargetText(kind: string, targetC: number | null | undefined): string {
  return targetC == null
    ? t('clima.cursor.notProgrammed')
    : tDynamic(`kind.${kind}.target`, 'kind.generic.target', { value: fmt.temp(targetC) });
}

/** aria-valuetext of the cursor slider. */
export function cursorValueText(tl: RoomTimeline, i: number): string {
  return t('clima.cursor.valueText', { when: cursorWhen(tl, i), temperature: temp(roomTemperatureAt(tl, i)) });
}
