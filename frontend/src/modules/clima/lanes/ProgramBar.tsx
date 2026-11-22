import type { MouseEvent } from 'react';
import type { ProgramSegment, SystemCapabilities, SystemLane, TimeRange } from '../../../api/types';
import { t } from '../../../i18n';
import { fmt } from '../../../i18n/format';
import { MOTION } from '../../../styles/motion';
import { editorAvailability, type EditorAvailability } from '../logic/editorOptions';
import { boxPct } from '../logic/runs';
import { systemName } from '../names';
import { kindSpec } from '../systemKinds';
import { SEGMENT_LABEL_MIN_WIDTH_PCT } from '../thermogram/scales';
import { segmentValueText, slotAttr } from './segmentText';
import styles from './lanes.module.css';

export interface ProgramBarProps {
  lane: SystemLane;
  capabilities: SystemCapabilities;
  count: number;
  range: TimeRange;
  /** key of the segment whose editor is open (null: none in this lane) */
  selectedKey: string | null;
  /** id of the editor panel (aria-controls of the selected segment) */
  editorId: string;
  onSelect(segment: ProgramSegment, availability: EditorAvailability, button: HTMLButtonElement): void;
}

/** Upper bar of a lane: the program segments, coloured by kind; editable ones are buttons. */
export function ProgramBar({ lane, capabilities, count, range, selectedKey, editorId, onSelect }: ProgramBarProps) {
  if (lane.representation === 'none') {
    return (
      <div className={styles.program}>
        <span className={styles.noProgram}>{t('clima.lane.noProgram')}</span>
      </div>
    );
  }
  const spec = kindSpec(lane.kind);
  const name = systemName(lane);
  return (
    <div className={styles.program}>
      {lane.segments.map((seg) => {
        const box = boxPct(seg.startIndex, seg.endIndex, count);
        const value = segmentValueText(seg, lane.kind);
        const label = box.width > SEGMENT_LABEL_MIN_WIDTH_PCT[range] && seg.on !== false ? value : null;
        const selected = seg.key === selectedKey;
        const classes = [styles.segment, MOTION.grow];
        if (selected) classes.push(styles.selected);
        else if (seg.edited) classes.push(styles.edited);
        const style = {
          left: `${box.left.toFixed(3)}%`,
          width: `${box.width.toFixed(3)}%`,
          background: spec.programFill(seg),
        };
        const availability = editorAvailability(seg, capabilities, lane.representation);
        if (!availability.clickable) {
          return (
            <span key={seg.key} aria-hidden="true" className={classes.join(' ')} style={style}>
              {label}
            </span>
          );
        }
        const onClick = (e: MouseEvent<HTMLButtonElement>) => onSelect(seg, availability, e.currentTarget);
        return (
          <button
            key={seg.key}
            type="button"
            className={classes.join(' ')}
            style={style}
            data-slot={slotAttr(lane.systemId, seg)}
            data-state={seg.state}
            aria-label={t('clima.segment.editable', {
              system: name,
              from: fmt.slotTime(seg.slotFrom ?? ''),
              to: fmt.slotTime(seg.slotTo ?? ''),
              value: value ?? t('clima.cursor.notProgrammed'),
            })}
            aria-expanded={selected}
            aria-controls={selected ? editorId : undefined}
            onClick={onClick}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
