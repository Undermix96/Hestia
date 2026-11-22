import { useMemo, type PointerEvent } from 'react';
import type { ClimaOverview, TimeRange } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { enterClass } from '../../../../styles/motion';
import { AxisLabels, type AxisTickLabel } from '../../components/AxisLabels';
import { ForecastHatch } from '../../components/ForecastHatch';
import { NowLine } from '../../components/NowLine';
import { indexFromPointer } from '../../logic/cursor';
import { useClimaStore } from '../../store/climaStore';
import { axisTicks } from '../../thermogram/axis';
import { nowPct } from '../../thermogram/scales';
import { CursorSlider } from './CursorSlider';
import { CursorValues } from './CursorValues';
import { OutdoorCenter, OutdoorLeft, OutdoorRight } from './OutdoorRow';
import { RoomRow } from './RoomRow';
import { RowChart } from './RowChart';
import { TopBar } from './TopBar';
import { TutteTable } from './TutteTable';
import { cursorWhen, roomNames } from './tutteModel';
import styles from './Tutte.module.css';

export interface AllRoomsPanelProps {
  overview: ClimaOverview;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

/** The single panel of the screen: one row per room plus outdoor, with one shared cursor. */
export function AllRoomsPanel({ overview, range, onRangeChange }: AllRoomsPanelProps) {
  const storeCursor = useClimaStore((s) => s.cursorIndex);
  const setCursor = useClimaStore((s) => s.setCursor);
  const { grid, clock, rows, outdoor } = overview;
  const n = grid.count;
  const nowIndex = grid.nowIndex;
  const tz = clock.timeZone;
  // A cursor left over from a grid of another size is ignored.
  const cursorIndex = storeCursor !== null && storeCursor < n ? storeCursor : null;
  const index = cursorIndex ?? nowIndex;
  const when = cursorWhen(grid, index, tz);
  const names = useMemo(() => roomNames(rows.map((r) => r.room)), [rows]);
  const nowLeft = nowPct(nowIndex, n).toFixed(2);

  const ticks = useMemo(
    (): AxisTickLabel[] =>
      axisTicks(grid, tz).map((tick) => ({
        key: `${tick.kind}-${tick.index}`,
        text:
          tick.kind === 'now'
            ? t('clima.axis.now')
            : tick.kind === 'day'
              ? fmt.dayLabel(tick.iso, tz)
              : fmt.time(tick.iso, tz),
        leftPct: tick.leftPct.toFixed(2),
        isNow: tick.kind === 'now',
        edge: tick.kind,
      })),
    [grid, tz],
  );

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    setCursor(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect(), n));
  }

  return (
    <section className={`${styles.panel} ${enterClass(2)}`} aria-label={t('clima.tutte.label')}>
      <TopBar when={when} range={range} onRangeChange={onRangeChange} />
      <div className={styles.columns}>
        <div className={styles.left}>
          {rows.map((row) => (
            <RoomRow key={row.room.id} row={row} names={names} />
          ))}
          <OutdoorLeft outdoor={outdoor} />
        </div>
        <div className={styles.center} onPointerMove={onPointerMove} onPointerLeave={() => setCursor(null)}>
          <ForecastHatch leftPct={nowLeft} />
          {rows.map((row) => (
            <RowChart key={row.room.id} row={row} nowIndex={nowIndex} names={names} />
          ))}
          <OutdoorCenter outdoor={outdoor} />
          <NowLine leftPct={nowLeft} />
          {cursorIndex !== null ? (
            <span
              aria-hidden="true"
              className={styles.cursorLine}
              style={{ left: `${(((cursorIndex + 0.5) / n) * 100).toFixed(2)}%` }}
              data-testid="tutte-cursor-line"
            />
          ) : null}
          <CursorSlider
            cursorIndex={cursorIndex}
            nowIndex={nowIndex}
            count={n}
            range={grid.range}
            valueText={when}
            onChange={setCursor}
          />
        </div>
        <div className={styles.right}>
          {rows.map((row) => (
            <CursorValues key={row.room.id} row={row} index={index} />
          ))}
          <OutdoorRight outdoor={outdoor} index={index} />
        </div>
      </div>
      <AxisLabels ticks={ticks} className={styles.axis ?? ''} />
      <TutteTable rows={rows} outdoor={outdoor} index={index} when={when} names={names} />
    </section>
  );
}
