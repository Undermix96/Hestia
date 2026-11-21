import { TIME_RANGES, type TimeRange } from '../../../api/types';
import { t } from '../../../i18n';
import styles from './components.module.css';

export interface RangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  /** Stanza: 8px 14px buttons; Tutte: 38px tall buttons. */
  size: 'stanza' | 'tutte';
}

/** "24 ore" / "7 giorni" toggle (one pressed button). */
export function RangeSelector({ value, onChange, size }: RangeSelectorProps) {
  const sizeClass = size === 'stanza' ? styles.rangeStanza : styles.rangeTutte;
  return (
    <div className={styles.range} role="group" aria-label={t('clima.range.label')}>
      {TIME_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={`${styles.rangeButton} ${sizeClass}`}
          aria-pressed={range === value}
          onClick={() => {
            if (range !== value) onChange(range);
          }}
        >
          {t(`clima.range.${range}`)}
        </button>
      ))}
    </div>
  );
}
