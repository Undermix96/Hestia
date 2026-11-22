// Texts shared by the Stanza and Tutte screens: temperatures, the axis labels and the cursor's "when".
import type { TimeGrid } from '../../../api/types';
import { t } from '../../../i18n';
import { fmt } from '../../../i18n/format';
import { cursorPhase } from '../logic/cursor';
import { axisTicks } from '../thermogram/axis';
import type { AxisTickLabel } from './AxisLabels';

/** Temperature number "21,8" (no unit: the message adds it), or the missing-value mark. */
export function temperatureOrMissing(v: number | null | undefined): string {
  return v == null ? t('common.missingValue') : fmt.temp(v);
}

/** Percentage number "47" (no unit), or the missing-value mark. */
export function percentOrMissing(v: number | null | undefined): string {
  return v == null ? t('common.missingValue') : fmt.pct(v);
}

/** "21,8°", or the missing-value mark. */
export function degrees(v: number | null | undefined): string {
  return v == null ? t('common.missingValue') : t('clima.axis.degrees', { value: fmt.temp(v) });
}

/** Labels of the time axis: "adesso", the hours (24h) or the days (7d). */
export function axisTickLabels(grid: TimeGrid, timeZone: string): AxisTickLabel[] {
  return axisTicks(grid, timeZone).map((tick) => ({
    key: `${tick.kind}|${tick.index}`,
    text:
      tick.kind === 'now'
        ? t('clima.axis.now')
        : tick.kind === 'day'
          ? fmt.dayLabel(tick.iso, timeZone)
          : fmt.time(tick.iso, timeZone),
    leftPct: tick.leftPct.toFixed(2),
    isNow: tick.kind === 'now',
    edge: tick.kind,
  }));
}

/** Cursor readout of sample `index`: "ore 06:00", "sab 14 · 06:00" (past in 7d), "adesso · 08:30", "previsione · 09:30". */
export function cursorWhen(grid: TimeGrid, index: number, timeZone: string): string {
  const iso = grid.t[index] ?? grid.t[grid.nowIndex] ?? grid.end;
  const time = fmt.time(iso, timeZone);
  switch (cursorPhase(index, grid.nowIndex)) {
    case 'now':
      return t('clima.cursor.now', { time });
    case 'forecast':
      return t('clima.cursor.forecast', { time });
    default:
      return grid.range === '7d'
        ? t('clima.cursor.past7d', { day: fmt.dayLabel(iso, timeZone), time })
        : t('clima.cursor.past24h', { time });
  }
}
