import { useMemo } from 'react';
import type { OutdoorSeries } from '../../../../api/types';
import { t } from '../../../../i18n';
import { MOTION } from '../../../../styles/motion';
import { outdoorChartPaths } from '../../thermogram/paths';
import { TUTTE_OUT_H, VIEW_W } from '../../thermogram/scales';
import { sampleAt } from '../../thermogram/samples';
import { outdoorText } from './tutteModel';
import styles from './Tutte.module.css';

/** Left cell of the outdoor row: "Esterno" and the conditions now. */
export function OutdoorLeft({ outdoor }: { outdoor: OutdoorSeries }) {
  return (
    <div className={`${styles.outdoorRow} ${styles.outdoorLeft}`}>
      <span className={styles.roomName}>{t('clima.tutte.outdoor')}</span>
      <span className={`num ${styles.outdoorValue}`}>{outdoorText(outdoor.nowC, outdoor.nowHumidityPct)}</span>
    </div>
  );
}

/** Center cell of the outdoor row: temperature and humidity lines. */
export function OutdoorCenter({ outdoor }: { outdoor: OutdoorSeries }) {
  const p = useMemo(() => outdoorChartPaths(outdoor, 'tutte'), [outdoor]);
  return (
    <div className={`${styles.outdoorRow} ${styles.outdoorCenter}`}>
      <svg
        className={styles.chart}
        width="100%"
        height={TUTTE_OUT_H}
        viewBox={`0 0 ${VIEW_W} ${TUTTE_OUT_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className={MOTION.morph}
          d={p.humidity}
          fill="none"
          stroke="var(--c-out-hum)"
          strokeWidth={1.2}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={MOTION.morph}
          d={p.temperature}
          fill="none"
          stroke="var(--c-out)"
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** Right cell of the outdoor row: the conditions at the cursor. */
export function OutdoorRight({ outdoor, index }: { outdoor: OutdoorSeries; index: number }) {
  return (
    <div className={`${styles.outdoorRow} ${styles.outdoorRight}`}>
      <span className={`num ${styles.outdoorCursor}`} data-testid="tutte-outdoor-cursor">
        {outdoorText(
          sampleAt(outdoor.measuredC, outdoor.forecastC, index),
          sampleAt(outdoor.measuredHumidityPct, outdoor.forecastHumidityPct, index),
        )}
      </span>
    </div>
  );
}
