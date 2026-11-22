import type { Action } from '../../../api/types';
import { MOTION } from '../../../styles/motion';
import { actionFill } from '../logic/colors';
import { actionRuns, boxPct } from '../logic/runs';
import styles from './lanes.module.css';

export interface ActionBarProps {
  actions: readonly (Action | null)[];
  nowIndex: number;
  /** bar height in px (14 in the Stanza lanes) */
  height?: number;
}

/** Lower bar of a lane: what the system does, sample by sample; forecast runs at half opacity. */
export function ActionBar({ actions, nowIndex, height = 14 }: ActionBarProps) {
  const n = actions.length;
  return (
    <div className={styles.action} style={{ height: `${height}px` }} aria-hidden="true">
      {actionRuns(actions, nowIndex).map((run) => {
        const box = boxPct(run.start, run.end, n);
        const classes = [styles.run, MOTION.grow];
        if (run.forecast) classes.push(styles.forecast);
        return (
          <span
            key={`${run.start}|${run.action ?? 'null'}`}
            className={classes.join(' ')}
            style={{
              left: `${box.left.toFixed(3)}%`,
              width: `${box.width.toFixed(3)}%`,
              background: actionFill(run.action),
            }}
          />
        );
      })}
    </div>
  );
}
