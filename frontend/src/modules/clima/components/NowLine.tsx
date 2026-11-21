import { MOTION } from '../../../styles/motion';
import styles from './components.module.css';

/** Vertical "now" line over a chart column; Stanza adds the glowing dot on top. */
export function NowLine({ leftPct, withDot = false }: { leftPct: number | string; withDot?: boolean }) {
  return (
    <span aria-hidden="true" className={styles.nowLine} style={{ left: `${leftPct}%` }}>
      {withDot ? <span className={`${styles.nowDot} ${MOTION.nowPulse}`} /> : null}
    </span>
  );
}
