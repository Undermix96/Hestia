import type { SystemLane as SystemLaneData } from '../../../api/types';
import { ActionBar } from './ActionBar';
import { ProgramBar, type ProgramBarProps } from './ProgramBar';
import styles from './lanes.module.css';

export type SystemLaneProps = Omit<ProgramBarProps, 'lane'> & { lane: SystemLaneData; nowIndex: number };

/** One system on the thermogram: program bar over action bar (50px). */
export function SystemLane({ lane, nowIndex, ...program }: SystemLaneProps) {
  return (
    <div className={styles.lane} data-system={lane.systemId}>
      <ProgramBar lane={lane} {...program} />
      <ActionBar actions={lane.action} nowIndex={nowIndex} />
    </div>
  );
}
