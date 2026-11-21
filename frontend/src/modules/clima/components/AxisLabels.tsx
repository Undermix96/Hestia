import styles from './components.module.css';

export interface AxisTickLabel {
  key: string;
  text: string;
  /** Position in % of the chart width (centre of the label). */
  leftPct: number | string;
  isNow: boolean;
  /** Kind of tick (e.g. 'now' | 'hour' | 'day'), exposed as `data-edge` for styling. */
  edge?: string;
}

/** Time axis under a chart: absolutely positioned labels, "adesso" in the heat colour. */
export function AxisLabels({ ticks, className }: { ticks: readonly AxisTickLabel[]; className?: string }) {
  return (
    <div aria-hidden="true" className={`${styles.axis} mono num${className ? ` ${className}` : ''}`}>
      {ticks.map((tick) => (
        <span
          key={tick.key}
          className={tick.isNow ? `${styles.axisTick} ${styles.axisNow}` : styles.axisTick}
          style={{ left: `${tick.leftPct}%` }}
          data-edge={tick.edge}
        >
          {tick.text}
        </span>
      ))}
    </div>
  );
}
