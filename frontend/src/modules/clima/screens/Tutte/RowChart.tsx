import { useMemo } from 'react';
import type { Action, OverviewRow, RoomClimateSeries, TargetSeries } from '../../../../api/types';
import { t } from '../../../../i18n';
import { MOTION } from '../../../../styles/motion';
import { actionFill } from '../../logic/colors';
import { actionRuns, boxPct } from '../../logic/runs';
import { miniChartPaths } from '../../thermogram/paths';
import { MINI_H, VIEW_W } from '../../thermogram/scales';
import { linkRoomId, nameOf, rowChartLabel, type RoomNames } from './tutteModel';
import styles from './Tutte.module.css';

/** Center cell of a room row: mini thermogram (or the no-sensor hatch) and one action strip per system. */
export function RowChart({ row, nowIndex, names }: { row: OverviewRow; nowIndex: number; names: RoomNames }) {
  const dense = row.systems.length > 2;
  return (
    <div
      className={`${styles.row} ${styles.cell}${dense ? ` ${styles.cellDense}` : ''}`}
      data-testid={`tutte-chart-${row.room.id}`}
    >
      {row.climate !== null && row.target !== null ? (
        <MiniThermo
          climate={row.climate}
          target={row.target}
          nowIndex={nowIndex}
          label={rowChartLabel(row, nowIndex, names)}
        />
      ) : (
        <div className={styles.noSensor}>{t('clima.tutte.noSensor', { room: nameOf(names, linkRoomId(row)) })}</div>
      )}
      {row.systems.map((system) => (
        <ActionStrip key={system.systemId} actions={system.action} nowIndex={nowIndex} />
      ))}
    </div>
  );
}

interface MiniThermoProps {
  climate: RoomClimateSeries;
  target: TargetSeries;
  nowIndex: number;
  label: string;
}

/** Row chart on the common 15–24° scale: comfort band, dashed target, measured line, forecast dots. */
function MiniThermo({ climate, target, nowIndex, label }: MiniThermoProps) {
  const p = useMemo(() => miniChartPaths(climate, target, nowIndex), [climate, target, nowIndex]);
  return (
    <svg
      className={styles.chart}
      width="100%"
      height={MINI_H}
      viewBox={`0 0 ${VIEW_W} ${MINI_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path className={MOTION.morph} d={p.band} fill="var(--c-band)" />
      <path
        className={MOTION.morph}
        d={p.target}
        fill="none"
        stroke="var(--c-target)"
        strokeWidth={1.4}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={MOTION.drawPast}
        d={p.past}
        fill="none"
        stroke="var(--c-text)"
        strokeWidth={2.2}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className={`${MOTION.drawForecast} ${MOTION.morph}`}
        d={p.forecast}
        fill="none"
        stroke="var(--c-text)"
        strokeWidth={2.2}
        strokeDasharray="1 5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** 7px strip of what a system does over time (forecast part at half opacity). */
function ActionStrip({ actions, nowIndex }: { actions: readonly (Action | null)[]; nowIndex: number }) {
  const n = actions.length;
  const spans = useMemo(() => actionRuns(actions, nowIndex), [actions, nowIndex]);
  return (
    <div className={styles.strip} aria-hidden="true" data-testid="tutte-strip">
      {spans.map((run) => {
        const box = boxPct(run.start, run.end, n);
        return (
          <span
            key={run.start}
            className={`${styles.stripRun} ${MOTION.grow}`}
            style={{
              left: `${box.left.toFixed(3)}%`,
              width: `${box.width.toFixed(3)}%`,
              background: actionFill(run.action),
              opacity: run.forecast ? 0.5 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
