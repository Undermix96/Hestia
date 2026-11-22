import type { OverviewRow } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { degrees } from '../../components/chartTexts';
import { actionDotColor } from '../../logic/colors';
import { sampleAt } from '../../thermogram/samples';
import { actionAt, systemActionText } from './tutteModel';
import styles from './Tutte.module.css';

/** Right cell of a room row: temperature, target and each system's action at the cursor. */
export function CursorValues({ row, index }: { row: OverviewRow; index: number }) {
  const climate = row.climate;
  const temperature = climate === null ? null : sampleAt(climate.measuredC, climate.forecastC, index);
  const target = row.target?.targetC[index] ?? null;
  let targetText: string;
  if (climate === null) targetText = t('clima.tutte.noSensorShort');
  else if (target === null) targetText = t('clima.tutte.noTarget');
  else targetText = t('clima.tutte.target', { value: fmt.temp(target) });
  return (
    <div className={`${styles.row} ${styles.values}`} data-testid={`tutte-values-${row.room.id}`}>
      <span className={`num ${styles.valueTemp}`}>{degrees(temperature)}</span>
      <span className={`num ${styles.valueTarget}`}>{targetText}</span>
      {climate === null
        ? null
        : row.systems.map((system) => (
            <span
              key={system.systemId}
              className={styles.valueAction}
              style={{ color: actionDotColor(actionAt(system, index)) }}
            >
              {systemActionText(system, index)}
            </span>
          ))}
    </div>
  );
}
