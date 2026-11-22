import type { TimeRange } from '../../../../api/types';
import { t } from '../../../../i18n';
import { LegendSwatch } from '../../components/LegendSwatch';
import { RangeSelector } from '../../components/RangeSelector';
import styles from './Tutte.module.css';

export interface TopBarProps {
  /** Cursor readout ("adesso · 08:30"). */
  when: string;
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

/** Compact legend (left), cursor readout and range selector (right). */
export function TopBar({ when, range, onRangeChange }: TopBarProps) {
  return (
    <div className={styles.topBar}>
      <div className={styles.legend}>
        <LegendSwatch variant="line" label={t('clima.tutte.legend.measured')} />
        <LegendSwatch variant="dotted" label={t('clima.tutte.legend.forecast')} />
        <LegendSwatch variant="dashed" label={t('clima.tutte.legend.target')} />
        <LegendSwatch variant="band" label={t('clima.tutte.legend.range')} />
        <LegendSwatch variant="blockSmall" label={t('clima.tutte.legend.heat')} background="var(--c-heat)" />
        <LegendSwatch variant="blockSmall" label={t('clima.tutte.legend.idle')} background="var(--pattern-idle)" />
      </div>
      <div className={styles.topRight}>
        <span className={`mono num ${styles.readout}`} data-testid="tutte-readout">
          {when}
        </span>
        <RangeSelector value={range} onChange={onRangeChange} size="tutte" />
      </div>
    </div>
  );
}
