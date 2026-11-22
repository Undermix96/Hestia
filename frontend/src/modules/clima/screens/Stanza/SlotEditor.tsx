import { motion } from 'motion/react';
import { useEffect, type KeyboardEvent } from 'react';
import type { OverrideCreate, ProgramSegment, RoomTimeline } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { hhmmToMinutes, minutesToHhmm } from '../../../../lib/time';
import {
  committedTimes,
  currentDraftTimes,
  currentDraftValue,
  draftContext,
  draftForTimes,
  draftForValue,
  stepValue,
  timeBounds,
  valueBounds,
  type DraftContext,
} from '../../logic/editorDraft';
import type { EditorAvailability } from '../../logic/editorOptions';
import { levelLabel, systemName } from '../../names';
import type { EditorOption } from '../../types';
import styles from './Stanza.module.css';

export interface SlotEditorProps {
  id: string;
  tl: RoomTimeline;
  systemId: string;
  segment: ProgramSegment;
  availability: EditorAvailability;
  option: EditorOption;
  draft: OverrideCreate | null;
  /** the last save/reset failed */
  error: boolean;
  busy: boolean;
  onOption(option: EditorOption): void;
  onDraft(draft: OverrideCreate | null): void;
  onReset(): void;
  onDone(): void;
  onClose(): void;
  /** focus moves into the editor whenever this changes (the edited slot) */
  focusKey: string;
}

const POP = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
  transition: { duration: 0.45, ease: [0.3, 1.4, 0.5, 1] as const },
};

function MinusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Snaps to the next grid point before/after `minutes` (an off-grid edge moves onto the grid). */
function gridStep(minutes: number, step: number, direction: -1 | 1): number {
  return direction < 0 ? Math.ceil(minutes / step) * step - step : Math.floor(minutes / step) * step + step;
}

function ScopeSelector({
  options,
  value,
  onChange,
}: {
  options: readonly EditorOption[];
  value: EditorOption;
  onChange(option: EditorOption): void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = options[(options.indexOf(value) + delta + options.length) % options.length]!;
    onChange(next);
    const radio = e.currentTarget.querySelector<HTMLButtonElement>(`[data-option="${next}"]`);
    radio?.focus();
  };
  return (
    <div
      className={`${styles.track} ${styles.scopes}`}
      role="radiogroup"
      aria-label={t('clima.editor.scopeLabel')}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          tabIndex={o === value ? 0 : -1}
          data-option={o}
          className={styles.scope}
          onClick={() => {
            if (o !== value) onChange(o);
          }}
        >
          {t(`clima.editor.scope.${o}`)}
        </button>
      ))}
    </div>
  );
}

function ValueStepper({
  ctx,
  option,
  draft,
  onDraft,
}: {
  ctx: DraftContext;
  option: 'slot' | 'permanentValue';
  draft: OverrideCreate | null;
  onDraft(draft: OverrideCreate | null): void;
}) {
  if (ctx.programmedC == null) return null;
  const bounds = valueBounds(ctx.programmedC, ctx.system.capabilities.override);
  const current = currentDraftValue(ctx, draft);
  const bump = (delta: number) => onDraft(draftForValue(ctx, option, stepValue(current, delta, bounds)));
  return (
    <div className={styles.track}>
      <button
        type="button"
        className={styles.stepButton}
        aria-label={t('clima.editor.decrease')}
        disabled={current <= bounds.min + 1e-9}
        onClick={() => bump(-bounds.step)}
      >
        <MinusIcon />
      </button>
      <span className={`${styles.stepValue} num`} aria-live="polite">
        {t('clima.editor.value', { value: fmt.temp(current) })}
      </span>
      <button
        type="button"
        className={styles.stepButton}
        aria-label={t('clima.editor.increase')}
        disabled={current >= bounds.max - 1e-9}
        onClick={() => bump(bounds.step)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function TimesStepper({
  ctx,
  draft,
  onDraft,
}: {
  ctx: DraftContext;
  draft: OverrideCreate | null;
  onDraft(draft: OverrideCreate | null): void;
}) {
  const { system, segment } = ctx;
  const times = currentDraftTimes(ctx, draft);
  if (!system.program || !times || segment.day == null || segment.slotRef == null) return null;
  const step = system.capabilities.program.minuteStep;
  const b = timeBounds(system.program, segment.day, segment.slotRef, step, times);
  const from = hhmmToMinutes(times.from);
  const to = hhmmToMinutes(times.to);
  const edges = [
    { which: 'from' as const, value: from, min: b.fromMin, max: b.fromMax, fixed: b.fixedFrom },
    { which: 'to' as const, value: to, min: b.toMin, max: b.toMax, fixed: b.fixedTo },
  ];
  const move = (which: 'from' | 'to', next: number) => {
    const f = which === 'from' ? next : from;
    const e = which === 'to' ? next : to;
    onDraft(draftForTimes(ctx, minutesToHhmm(f), minutesToHhmm(e)));
  };
  return (
    <>
      {edges.map((edge) => {
        const earlier = gridStep(edge.value, step, -1);
        const later = gridStep(edge.value, step, 1);
        const label = t(`clima.editor.${edge.which}`);
        return (
          <div key={edge.which} className={`${styles.track} ${styles.timeGroup}`} role="group" aria-label={label}>
            <span className={styles.timeLabel} aria-hidden="true">
              {label}
            </span>
            <button
              type="button"
              className={styles.stepButton}
              aria-label={t('clima.editor.earlier', { which: label })}
              disabled={edge.fixed || earlier < edge.min}
              onClick={() => move(edge.which, earlier)}
            >
              <MinusIcon />
            </button>
            <span className={`${styles.timeValue} mono num`} aria-live="polite">
              {fmt.slotTime(minutesToHhmm(edge.value))}
            </span>
            <button
              type="button"
              className={styles.stepButton}
              aria-label={t('clima.editor.later', { which: label })}
              disabled={edge.fixed || later > edge.max}
              onClick={() => move(edge.which, later)}
            >
              <PlusIcon />
            </button>
          </div>
        );
      })}
    </>
  );
}

function notes(
  ctx: DraftContext,
  option: EditorOption,
  draft: OverrideCreate | null,
  levelsWarning: boolean,
): string[] {
  const { segment, system } = ctx;
  const out: string[] = [];
  const level =
    system.program?.representation === 'levels' && segment.levelId != null
      ? (system.program.levels?.find((l) => l.id === segment.levelId) ?? null)
      : null;
  if (option === 'permanentTimes') return [t('clima.editor.note.permanentTimes')];
  const value = currentDraftValue(ctx, draft);
  if (ctx.programmedC != null && Math.abs(value - ctx.programmedC) > 1e-9) {
    out.push(
      t('clima.editor.note.changed', {
        programmed: fmt.temp(ctx.programmedC),
        delta: fmt.signedTemp(value - ctx.programmedC),
      }),
    );
  } else if (option === 'slot') {
    out.push(t('clima.editor.note.slot', { to: fmt.slotTime(committedTimes(ctx)?.to ?? segment.slotTo ?? '') }));
  } else if (!level) {
    out.push(t('clima.editor.note.permanentSlot'));
  }
  if (option === 'permanentValue' && levelsWarning && level) {
    out.push(t('clima.editor.note.permanentLevel', { level: levelLabel(level) }));
  }
  return out;
}

/** Light panel under the thermogram that edits one program slot (value or times), with a live preview. */
export function SlotEditor({
  id,
  tl,
  systemId,
  segment,
  availability,
  option,
  draft,
  error,
  busy,
  onOption,
  onDraft,
  onReset,
  onDone,
  onClose,
  focusKey,
}: SlotEditorProps) {
  const ctx = draftContext(tl, systemId, segment, option);
  const times = committedTimes(ctx) ?? { from: segment.slotFrom ?? '', to: segment.slotTo ?? '' };

  // Focus the scope selector (or the first stepper button) when the editor opens on a slot.
  useEffect(() => {
    const root = document.getElementById(id);
    const target =
      root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      root?.querySelector<HTMLElement>('button:not(:disabled)');
    target?.focus();
  }, [id, focusKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <motion.div
      id={id}
      role="group"
      aria-label={t('clima.editor.label')}
      data-slot-editor=""
      className={styles.editor}
      onKeyDown={onKeyDown}
      initial={POP.initial}
      animate={POP.animate}
      exit={POP.exit}
      transition={POP.transition}
    >
      <div className={styles.editorText}>
        <div className={styles.editorTitle}>
          {t('clima.editor.title', {
            system: systemName(ctx.system),
            from: fmt.slotTime(times.from),
            to: fmt.slotTime(times.to),
          })}
        </div>
        {notes(ctx, option, draft, availability.levelsWarning).map((note) => (
          <div key={note} className={styles.editorNote}>
            {note}
          </div>
        ))}
        {error ? (
          <div className={styles.editorError} role="alert">
            {t('clima.editor.error')}
          </div>
        ) : null}
      </div>
      {availability.options.length > 1 ? (
        <ScopeSelector options={availability.options} value={option} onChange={onOption} />
      ) : null}
      {option === 'permanentTimes' ? (
        <TimesStepper ctx={ctx} draft={draft} onDraft={onDraft} />
      ) : (
        <ValueStepper ctx={ctx} option={option} draft={draft} onDraft={onDraft} />
      )}
      <button
        type="button"
        className={styles.reset}
        disabled={busy || (draft === null && segment.overrideId === null)}
        onClick={onReset}
      >
        {t('clima.editor.reset')}
      </button>
      <button type="button" className={styles.done} disabled={busy} onClick={onDone}>
        {t('clima.editor.done')}
      </button>
    </motion.div>
  );
}
