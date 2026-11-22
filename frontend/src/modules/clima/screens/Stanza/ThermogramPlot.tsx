import { useMemo, type KeyboardEvent, type PointerEvent } from 'react';
import type { ProgramSegment, RoomTimeline, SystemLane as SystemLaneData, SystemView } from '../../../../api/types';
import { t } from '../../../../i18n';
import { MOTION } from '../../../../styles/motion';
import { ForecastHatch } from '../../components/ForecastHatch';
import { NowLine } from '../../components/NowLine';
import { SystemLane } from '../../lanes/SystemLane';
import { actionTextColor } from '../../logic/colors';
import { indexFromPointer, keyboardStep, moveCursor, tooltipOnLeft } from '../../logic/cursor';
import type { EditorAvailability } from '../../logic/editorOptions';
import { actionLabel, roomName, systemName } from '../../names';
import { outdoorChartPaths, roomChartPaths } from '../../thermogram/paths';
import { nowPct, ROOM_TICKS, tickTopPct, yRoomT } from '../../thermogram/scales';
import {
  cursorValueText,
  cursorWhen,
  outdoorValueAt,
  roomTemperatureAt,
  roomValueAt,
  systemTargetText,
} from './cursorText';
import styles from './Stanza.module.css';

const HUMIDITY_TOP = 80;
const HUMIDITY_BOTTOM = 30;
const OUTDOOR_MAX = 15;
const OUTDOOR_MIN = 0;

/** Left column: room name and °C ticks, lane names, outdoor scale. */
export function ThermogramLabels({ tl, lanes }: { tl: RoomTimeline; lanes: readonly SystemLaneData[] }) {
  return (
    <div className={styles.labels} aria-hidden="true">
      <div className={`${styles.labelsRoom} mono num`}>
        <span className={styles.labelsTitle}>{roomName(tl.room)}</span>
        {ROOM_TICKS.map((v) => (
          <span key={v} className={styles.labelsTick} style={{ top: `${tickTopPct(v).toFixed(2)}%` }}>
            {t('clima.axis.degrees', { value: v })}
          </span>
        ))}
      </div>
      <div className={styles.spacer} />
      {lanes.map((lane) => (
        <div key={lane.systemId} className={styles.laneLabel}>
          <span className={styles.laneName}>{systemName(lane)}</span>
          <span className={styles.laneActing}>{t('clima.lane.acting')}</span>
        </div>
      ))}
      <div className={styles.spacer} />
      <div className={`${styles.labelsOutdoor} mono num`}>
        <span className={styles.labelsTitle}>{t('clima.lane.outdoor')}</span>
        <span className={styles.outdoorMax}>{t('clima.axis.degrees', { value: OUTDOOR_MAX })}</span>
        <span className={styles.outdoorMin}>{t('clima.axis.degrees', { value: OUTDOOR_MIN })}</span>
      </div>
    </div>
  );
}

function RoomChart({ tl, ariaLabel }: { tl: RoomTimeline; ariaLabel: string }) {
  const p = useMemo(() => roomChartPaths(tl.climate, tl.target, tl.grid.nowIndex), [tl]);
  return (
    <div className={styles.roomChart}>
      {ROOM_TICKS.map((v) => (
        <div key={v} className={styles.gridline} style={{ top: `${tickTopPct(v).toFixed(2)}%` }} />
      ))}
      <svg
        width="100%"
        height="260"
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        className={styles.chartSvg}
      >
        <path className={`${styles.humArea} ${MOTION.morph}`} d={p.humidityArea} />
        <path className={`${styles.humLine} ${MOTION.morph}`} d={p.humidityLine} vectorEffect="non-scaling-stroke" />
        <path className={`${styles.band} ${MOTION.morph}`} d={p.band} />
        <path className={`${styles.target} ${MOTION.morph}`} d={p.target} vectorEffect="non-scaling-stroke" />
        <path className={`${styles.past} ${MOTION.drawPast}`} d={p.past} vectorEffect="non-scaling-stroke" />
        <path
          className={`${styles.forecastLine} ${MOTION.drawForecast} ${MOTION.morph}`}
          d={p.forecast}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className={`${styles.humLabel} ${styles.humLabelTop} mono num`} aria-hidden="true">
        {t('clima.axis.percent', { value: HUMIDITY_TOP })}
      </div>
      <div className={`${styles.humLabel} ${styles.humLabelBottom} mono num`} aria-hidden="true">
        {t('clima.axis.percent', { value: HUMIDITY_BOTTOM })}
      </div>
    </div>
  );
}

function OutdoorChart({ tl }: { tl: RoomTimeline }) {
  const p = useMemo(() => outdoorChartPaths(tl.outdoor, 'stanza'), [tl]);
  return (
    <div className={styles.outdoorChart}>
      <svg
        width="100%"
        height="80"
        viewBox="0 0 1000 80"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={styles.outdoorSvg}
      >
        <path className={`${styles.outHumArea} ${MOTION.morph}`} d={p.humidityArea} />
        <path className={`${styles.outHum} ${MOTION.morph}`} d={p.humidity} vectorEffect="non-scaling-stroke" />
        <path className={`${styles.outTemp} ${MOTION.morph}`} d={p.temperature} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function CursorLayer({ tl, lanes, index }: { tl: RoomTimeline; lanes: readonly SystemLaneData[]; index: number }) {
  const n = tl.grid.count;
  const left = `${(((index + 0.5) / n) * 100).toFixed(2)}%`;
  const temperature = roomTemperatureAt(tl, index);
  const onLeft = tooltipOnLeft(index, n);
  return (
    <>
      <div className={styles.cursorLine} style={{ left }} aria-hidden="true" />
      {temperature != null ? (
        <div className={styles.cursorDot} style={{ left, top: `${yRoomT(temperature)}px` }} aria-hidden="true" />
      ) : null}
      <div
        className={`${styles.tooltip} num`}
        style={{ left, transform: `translateX(${onLeft ? 'calc(-100% - 14px)' : '14px'})` }}
        data-testid="cursor-tooltip"
        data-side={onLeft ? 'left' : 'right'}
        aria-hidden="true"
      >
        <div className={`${styles.tooltipWhen} mono`}>{cursorWhen(tl, index)}</div>
        <div className={styles.tooltipRow}>
          <span>{t('clima.cursor.room')}</span>
          <b>{roomValueAt(tl, index)}</b>
        </div>
        {lanes.map((lane) => {
          const action = lane.action[index] ?? null;
          return (
            <div key={lane.systemId}>
              <div className={styles.tooltipRow}>
                <span>{systemName(lane)}</span>
                <b>{systemTargetText(lane.kind, lane.targetC[index])}</b>
              </div>
              <div className={`${styles.tooltipRow} ${styles.tooltipMuted}`}>
                <span className={styles.tooltipIndent}>{t('clima.cursor.action')}</span>
                <b style={{ color: actionTextColor(action) }}>{actionLabel(action)}</b>
              </div>
            </div>
          );
        })}
        <div className={`${styles.tooltipRow} ${styles.tooltipMuted}`}>
          <span>{t('clima.cursor.outdoor')}</span>
          <b className={styles.tooltipOutdoor}>{outdoorValueAt(tl, index)}</b>
        </div>
      </div>
    </>
  );
}

export interface ThermogramPlotProps {
  tl: RoomTimeline;
  lanes: readonly SystemLaneData[];
  systems: ReadonlyMap<string, SystemView>;
  chartLabel: string;
  cursorIndex: number | null;
  onCursor(index: number | null): void;
  /** Escape on the cursor slider: closes the editor if open, else hides the cursor. */
  onEscape(): void;
  selectedKeys: ReadonlyMap<string, string>;
  editorId: string;
  onSelect(
    lane: SystemLaneData,
    segment: ProgramSegment,
    availability: EditorAvailability,
    button: HTMLButtonElement,
  ): void;
}

/** Charts and lanes on one time axis, with the forecast hatch, the "now" line and the cursor. */
export function ThermogramPlot({
  tl,
  lanes,
  systems,
  chartLabel,
  cursorIndex,
  onCursor,
  onEscape,
  selectedKeys,
  editorId,
  onSelect,
}: ThermogramPlotProps) {
  const { count: n, nowIndex, range } = tl.grid;
  const now = nowPct(nowIndex, n).toFixed(2);
  const index = cursorIndex != null && cursorIndex < n ? cursorIndex : null;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    onCursor(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect(), n));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
      return;
    }
    const step = keyboardStep(e.key, range, e.shiftKey);
    if (step === null) return;
    e.preventDefault();
    onCursor(moveCursor(index, step, nowIndex, n));
  };

  return (
    <div className={styles.plot} onPointerMove={onPointerMove} onPointerLeave={() => onCursor(null)}>
      <ForecastHatch leftPct={now} rounded />
      <RoomChart tl={tl} ariaLabel={chartLabel} />
      <div className={styles.spacer} />
      {lanes.map((lane) => {
        const system = systems.get(lane.systemId);
        if (!system) return null;
        return (
          <SystemLane
            key={lane.systemId}
            lane={lane}
            nowIndex={nowIndex}
            capabilities={system.capabilities}
            count={n}
            range={range}
            selectedKey={selectedKeys.get(lane.systemId) ?? null}
            editorId={editorId}
            onSelect={(seg, availability, button) => onSelect(lane, seg, availability, button)}
          />
        );
      })}
      <div className={styles.spacer} />
      <OutdoorChart tl={tl} />
      <NowLine leftPct={now} withDot />
      {index !== null ? <CursorLayer tl={tl} lanes={lanes} index={index} /> : null}
      <div
        className={styles.slider}
        tabIndex={0}
        role="slider"
        aria-label={t('clima.cursor.slider')}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={index ?? nowIndex}
        aria-valuetext={cursorValueText(tl, index ?? nowIndex)}
        onFocus={() => {
          if (index === null) onCursor(nowIndex);
        }}
        onBlur={() => onCursor(null)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
