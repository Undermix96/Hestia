import type { CSSProperties } from 'react';
import styles from './components.module.css';

export type LegendVariant =
  | 'line'
  | 'dotted'
  | 'dashed'
  | 'band'
  | 'humidity'
  | 'block'
  | 'blockSmall'
  | 'off';

export interface LegendSwatchProps {
  variant: LegendVariant;
  label: string;
  /** Colour of `line`/`dotted` (default: the text colour), e.g. `var(--c-out)`. */
  color?: string;
  /** Background of `block`/`blockSmall`: a colour or a pattern such as `var(--pattern-idle)`. */
  background?: string;
}

const VARIANT_CLASS: Record<LegendVariant, string> = {
  line: styles.swatchLine ?? '',
  dotted: styles.swatchDotted ?? '',
  dashed: styles.swatchDashed ?? '',
  band: styles.swatchBand ?? '',
  humidity: styles.swatchHumidity ?? '',
  block: styles.swatchBlock ?? '',
  blockSmall: styles.swatchBlockSmall ?? '',
  off: `${styles.swatchBlock ?? ''} ${styles.swatchOff ?? ''}`,
};

function swatchStyle(variant: LegendVariant, color?: string, background?: string): CSSProperties {
  if (variant === 'line' && color) return { background: color };
  if (variant === 'dotted' && color) return { borderTopColor: color };
  if ((variant === 'block' || variant === 'blockSmall') && background) return { background };
  return {};
}

/** One legend entry: a small swatch and its label. */
export function LegendSwatch({ variant, label, color, background }: LegendSwatchProps) {
  return (
    <span className={styles.legendItem}>
      <span
        aria-hidden="true"
        className={`${styles.swatch} ${VARIANT_CLASS[variant]}`}
        style={swatchStyle(variant, color, background)}
      />
      {label}
    </span>
  );
}
