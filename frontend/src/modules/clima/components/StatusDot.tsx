import type { Action } from '../../../api/types';
import { MOTION } from '../../../styles/motion';
import { actionDotColor } from '../logic/colors';
import styles from './components.module.css';

export type DotShape = 'square' | 'round';

export interface StatusDotProps {
  action: Action | null;
  /** Radiators: square; splits and other kinds: round (`kindSpec(kind).dotShape`). */
  shape: DotShape;
  /** Ring animation while the system is acting. */
  pulse?: boolean;
}

/** 7×7 px dot coloured by the system's action (decorative: the text says the action). */
export function StatusDot({ action, shape, pulse = false }: StatusDotProps) {
  const color = actionDotColor(action);
  const classes = [styles.dot, shape === 'square' ? styles.dotSquare : styles.dotRound];
  if (pulse) classes.push(MOTION.pulse);
  return <span aria-hidden="true" className={classes.join(' ')} style={{ background: color, color }} />;
}
