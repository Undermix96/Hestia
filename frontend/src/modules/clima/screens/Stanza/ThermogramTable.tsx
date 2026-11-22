import { useMemo } from 'react';
import type { RoomTimeline, SystemLane } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { actionLabel, roomName, systemName } from '../../names';
import { tableRows } from '../../thermogram/tableRows';

function value(v: number | null, format: (x: number) => string): string {
  return v == null ? t('common.missingValue') : format(v);
}

/** Text equivalent of the thermogram for screen readers (visually hidden). */
export function ThermogramTable({ tl, lanes }: { tl: RoomTimeline; lanes: readonly SystemLane[] }) {
  const rows = useMemo(() => tableRows(tl), [tl]);
  const tz = tl.clock.timeZone;
  // tableRows lists actions in tl.lanes order; the columns follow the displayed lane order.
  const columns = lanes.map((lane) => tl.lanes.findIndex((l) => l.systemId === lane.systemId));
  return (
    // The wrapper is hidden, not the table: a table ignores the 1px width and would widen the page.
    <div className="visually-hidden">
      <table>
        <caption>{t('clima.table.caption', { room: roomName(tl.room) })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('clima.table.time')}</th>
            <th scope="col">{t('clima.table.temperature')}</th>
            <th scope="col">{t('clima.table.humidity')}</th>
            <th scope="col">{t('clima.table.target')}</th>
            {lanes.map((lane) => (
              <th key={lane.systemId} scope="col">
                {t('clima.table.action', { system: systemName(lane) })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const time =
              tl.grid.range === '7d'
                ? t('clima.cursor.past7d', { day: fmt.dayLabel(row.iso, tz), time: fmt.time(row.iso, tz) })
                : fmt.time(row.iso, tz);
            return (
              <tr key={row.index}>
                <th scope="row">{row.phase === 'forecast' ? t('clima.table.forecast', { time }) : time}</th>
                <td>{value(row.temperatureC, fmt.temp)}</td>
                <td>{value(row.humidityPct, fmt.pct)}</td>
                <td>{value(row.targetC, fmt.temp)}</td>
                {columns.map((c, k) => (
                  <td key={lanes[k]!.systemId}>{actionLabel(c >= 0 ? (row.actions[c] ?? null) : null)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
