import type { OutdoorSeries, OverviewRow } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { joinList, nameOf, outdoorText, systemActionText, valueAt, type RoomNames } from './tutteModel';

export interface TutteTableProps {
  rows: readonly OverviewRow[];
  outdoor: OutdoorSeries;
  index: number;
  when: string;
  names: RoomNames;
}

function cell(v: number | null): string {
  return v === null ? t('common.missingValue') : fmt.temp(v);
}

/** Visually hidden table: the values of every room at the cursor (the same data as the right column). */
export function TutteTable({ rows, outdoor, index, when, names }: TutteTableProps) {
  return (
    <table className="visually-hidden">
      <caption>
        <span>{t('clima.tutte.table.caption')}</span> <span>{t('clima.tutte.table.time', { when })}</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">{t('clima.tutte.table.room')}</th>
          <th scope="col">{t('clima.table.temperature')}</th>
          <th scope="col">{t('clima.table.target')}</th>
          <th scope="col">{t('clima.tutte.table.systems')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const climate = row.climate;
          return (
            <tr key={row.room.id}>
              <th scope="row">{nameOf(names, row.room.id)}</th>
              <td>{climate === null ? t('common.missingValue') : cell(valueAt(climate.measuredC, climate.forecastC, index))}</td>
              <td>{climate === null ? t('clima.tutte.noSensorShort') : cell(row.target?.targetC[index] ?? null)}</td>
              <td>{joinList(row.systems.map((s) => systemActionText(s, index)))}</td>
            </tr>
          );
        })}
        <tr>
          <th scope="row">{t('clima.tutte.outdoor')}</th>
          <td>
            {outdoorText(
              valueAt(outdoor.measuredC, outdoor.forecastC, index),
              valueAt(outdoor.measuredHumidityPct, outdoor.forecastHumidityPct, index),
            )}
          </td>
          <td>{t('common.missingValue')}</td>
          <td>{t('common.missingValue')}</td>
        </tr>
      </tbody>
    </table>
  );
}
