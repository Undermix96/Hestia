import styles from './components.module.css';

/** Hatched background of the forecast part of a chart (from `leftPct` to the right edge). */
export function ForecastHatch({ leftPct, rounded = false }: { leftPct: number | string; rounded?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={rounded ? `${styles.hatch} ${styles.hatchRounded}` : styles.hatch}
      style={{ left: `${leftPct}%` }}
    />
  );
}
