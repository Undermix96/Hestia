// View helpers of the Tutte le stanze screen: thin glue between the contract, the logic modules and i18n.
import type { Action, OverviewRow, RoomView, SystemSeries, SystemStatus, TimeGrid, TimeRange } from '../../../../api/types';
import { intlLocale, t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { cursorPhase } from '../../logic/cursor';
import { actionLabel, roomName, systemShortName } from '../../names';

/** Value of a measured/forecast pair at sample i (measured wins; both are set at nowIndex). */
export function valueAt(measured: readonly (number | null)[], forecast: readonly (number | null)[], i: number): number | null {
  return measured[i] ?? forecast[i] ?? null;
}

/** "21,8°", or the missing-value mark. */
export function degrees(v: number | null): string {
  return v === null ? t('common.missingValue') : t('clima.axis.degrees', { value: fmt.temp(v) });
}

/** Cursor readout of sample `index`: "ore 06:00", "sab 14 · 06:00" (past in 7d), "adesso · 08:30", "previsione · 09:30". */
export function cursorWhen(grid: TimeGrid, index: number, timeZone: string): string {
  const iso = grid.t[index] ?? grid.t[grid.nowIndex] ?? '';
  const time = fmt.time(iso, timeZone);
  switch (cursorPhase(index, grid.nowIndex)) {
    case 'past':
      return pastWhen(grid.range, iso, time, timeZone);
    case 'now':
      return t('clima.cursor.now', { time });
    default:
      return t('clima.cursor.forecast', { time });
  }
}

function pastWhen(range: TimeRange, iso: string, time: string, timeZone: string): string {
  return range === '7d'
    ? t('clima.cursor.past7d', { day: fmt.dayLabel(iso, timeZone), time })
    : t('clima.cursor.past24h', { time });
}

/** Room opened by the row's link: the room itself, or the room a sensorless room follows. */
export function linkRoomId(row: OverviewRow): string {
  if (row.room.hasSensor) return row.room.id;
  return row.room.followsRoomId ?? row.status.systems.find((s) => s.viaRoomId !== null)?.viaRoomId ?? row.room.id;
}

export type RoomNames = ReadonlyMap<string, string>;

export function roomNames(rooms: readonly RoomView[]): RoomNames {
  return new Map(rooms.map((r) => [r.id, roomName(r)]));
}

export function nameOf(names: RoomNames, roomId: string): string {
  return names.get(roomId) ?? roomId;
}

/** Room a sensorless row shows "(con <room>)" for, per system; null for rows with a sensor. */
export function viaRoomName(row: OverviewRow, status: SystemStatus, names: RoomNames): string | null {
  if (row.room.hasSensor || status.viaRoomId === null) return null;
  return nameOf(names, status.viaRoomId);
}

/** Text of a status line: "caloriferi standby" or "caloriferi scalda (con Bagno)". */
export function statusText(status: SystemStatus, via: string | null): string {
  const values = { system: systemShortName(status), action: actionLabel(status.action) };
  return via === null ? t('clima.status.system', values) : t('clima.status.viaRoom', { ...values, room: via });
}

/** Action of a system at sample i, as "clima scalda". */
export function systemActionText(system: SystemSeries, i: number): string {
  return t('clima.status.system', { system: systemShortName(system), action: actionLabel(actionAt(system, i)) });
}

export function actionAt(system: SystemSeries, i: number): Action | null {
  return system.action[i] ?? null;
}

const listFormat = new Intl.ListFormat(intlLocale, { style: 'long', type: 'conjunction' });

/** Locale list: "a, b e c". */
export function joinList(items: readonly string[]): string {
  return listFormat.format(items);
}

/** aria-label of a row chart (values now). */
export function rowChartLabel(row: OverviewRow, nowIndex: number, names: RoomNames): string {
  const target = row.target?.targetC[nowIndex] ?? null;
  return t('clima.tutte.rowChartLabel', {
    room: nameOf(names, row.room.id),
    temperature: row.status.temperatureC === null ? t('common.missingValue') : fmt.temp(row.status.temperatureC),
    target: target === null ? t('common.missingValue') : fmt.temp(target),
    status: joinList(row.status.systems.map((s) => statusText(s, viaRoomName(row, s, names)))),
  });
}

/** "5,9° · 83%" (missing parts as the missing-value mark). */
export function outdoorText(temperatureC: number | null, humidityPct: number | null): string {
  const missing = t('common.missingValue');
  return t('clima.tutte.outdoorValue', {
    temperature: temperatureC === null ? missing : fmt.temp(temperatureC),
    humidity: humidityPct === null ? missing : fmt.pct(humidityPct),
  });
}
