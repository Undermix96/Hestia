import type { KeyboardEvent } from 'react';
import type { TimeGrid } from '../../../../api/types';
import { t } from '../../../../i18n';
import { keyboardStep, moveCursor } from '../../logic/cursor';
import styles from './Tutte.module.css';

export interface CursorSliderProps {
  /** Store cursor (null = none). */
  cursorIndex: number | null;
  nowIndex: number;
  count: number;
  /** Range and sampling step (the keyboard steps are in hours). */
  grid: Pick<TimeGrid, 'range' | 'stepMinutes'>;
  /** Readout of the sample shown (cursor or now). */
  valueText: string;
  onChange: (index: number | null) => void;
}

/**
 * Transparent focusable layer over the chart column: the keyboard handle of the shared cursor
 * (←/→, Shift, PageUp/PageDown, Home/End; Esc hides the cursor).
 */
export function CursorSlider({ cursorIndex, nowIndex, count, grid, valueText, onChange }: CursorSliderProps) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      if (cursorIndex !== null) {
        e.preventDefault();
        onChange(null);
      }
      return;
    }
    const step = keyboardStep(e.key, grid, e.shiftKey);
    if (step === null) return;
    e.preventDefault();
    onChange(moveCursor(cursorIndex, step, nowIndex, count));
  }

  return (
    <div
      className={styles.slider}
      tabIndex={0}
      role="slider"
      aria-label={t('clima.cursor.slider')}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={cursorIndex ?? nowIndex}
      aria-valuetext={valueText}
      onFocus={() => {
        if (cursorIndex === null) onChange(nowIndex);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
