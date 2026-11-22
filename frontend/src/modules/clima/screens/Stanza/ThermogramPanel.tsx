import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDataSource } from '../../../../api/datasource/context';
import type { ProgramSegment, RoomTimeline, SystemLane } from '../../../../api/types';
import { t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { enterClass } from '../../../../styles/motion';
import { AxisLabels } from '../../components/AxisLabels';
import { LegendSwatch } from '../../components/LegendSwatch';
import { RangeSelector } from '../../components/RangeSelector';
import { slotAttr } from '../../lanes/segmentText';
import { editorAvailability, type EditorAvailability } from '../../logic/editorOptions';
import { findSelectedSegment } from '../../logic/segments';
import { roomName } from '../../names';
import { useClimaStore } from '../../store/climaStore';
import { sortByLaneOrder } from '../../systemKinds';
import { axisTicks } from '../../thermogram/axis';
import { SlotEditor } from './SlotEditor';
import { ThermogramLabels, ThermogramPlot } from './ThermogramPlot';
import { ThermogramTable } from './ThermogramTable';
import styles from './Stanza.module.css';

export interface ThermogramPanelProps {
  tl: RoomTimeline;
  /** full summary sentence, read with the chart */
  summary: string;
  /** the preview of the current draft could not be computed */
  previewError: boolean;
}

function TopLegend() {
  return (
    <div className={styles.legend}>
      <LegendSwatch variant="line" label={t('clima.legend.measured')} />
      <LegendSwatch variant="dotted" label={t('clima.legend.forecast')} />
      <LegendSwatch variant="dashed" label={t('clima.legend.target')} />
      <LegendSwatch variant="band" label={t('clima.legend.comfort')} />
      <LegendSwatch variant="humidity" label={t('clima.legend.humidity')} />
      <LegendSwatch variant="line" color="var(--c-out)" label={t('clima.legend.outdoor')} />
    </div>
  );
}

function BottomLegend({ lanes }: { lanes: readonly SystemLane[] }) {
  const hasDry = lanes.some((l) => l.action.includes('dry'));
  return (
    <div className={styles.bottomLegend}>
      <LegendSwatch variant="block" background="var(--c-heat)" label={t('clima.legend.heat')} />
      <LegendSwatch variant="block" background="var(--c-cool)" label={t('clima.legend.cool')} />
      {hasDry ? <LegendSwatch variant="block" background="var(--c-dry)" label={t('clima.legend.dry')} /> : null}
      <LegendSwatch variant="block" background="var(--pattern-idle)" label={t('clima.legend.idle')} />
      <LegendSwatch variant="off" label={t('clima.legend.off')} />
      <span className={styles.legendNote}>{t('clima.legend.note')}</span>
    </div>
  );
}

function isBlank(el: Element | null): boolean {
  return el === null || el === document.body || el === document.documentElement;
}

/** The thermogram: legend, range selector, charts and lanes, axis, slot editor and the hidden data table. */
export function ThermogramPanel({ tl, summary, previewError }: ThermogramPanelProps) {
  const ds = useDataSource();
  const range = useClimaStore((s) => s.range);
  const setRange = useClimaStore((s) => s.setRange);
  const cursorIndex = useClimaStore((s) => s.cursorIndex);
  const setCursor = useClimaStore((s) => s.setCursor);
  const selection = useClimaStore((s) => s.selection);
  const editorOption = useClimaStore((s) => s.editorOption);
  const draft = useClimaStore((s) => s.draft);
  const select = useClimaStore((s) => s.select);
  const setEditorOption = useClimaStore((s) => s.setEditorOption);
  const setDraft = useClimaStore((s) => s.setDraft);
  const closeEditor = useClimaStore((s) => s.closeEditor);

  const editorId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<{ el: HTMLElement | null; slot: string } | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const wasOpen = useRef(false);
  const [busy, setBusy] = useState(false);
  const [errorSlot, setErrorSlot] = useState<string | null>(null);

  const lanes = useMemo(() => sortByLaneOrder(tl.lanes), [tl]);
  const systems = useMemo(() => new Map(tl.systems.map((s) => [s.id, s])), [tl]);
  const tz = tl.clock.timeZone;

  const ticks = useMemo(
    () =>
      axisTicks(tl.grid, tz).map((tick) => ({
        key: `${tick.kind}|${tick.index}`,
        text:
          tick.kind === 'now'
            ? t('clima.axis.now')
            : tick.kind === 'day'
              ? fmt.dayLabel(tick.iso, tz)
              : fmt.time(tick.iso, tz),
        leftPct: tick.leftPct.toFixed(2),
        isNow: tick.kind === 'now',
        edge: tick.kind,
      })),
    [tl.grid, tz],
  );

  const hasProgram = lanes.some((l) => l.representation !== 'none');
  const anyEditable = lanes.some((lane) => {
    const system = systems.get(lane.systemId);
    return (
      system !== undefined &&
      lane.segments.some((seg) => editorAvailability(seg, system.capabilities, lane.representation).clickable)
    );
  });

  // The open editor: its segment is found again after a draft split it at now.
  const selLane = selection ? lanes.find((l) => l.systemId === selection.systemId) : undefined;
  const selSystem = selection ? systems.get(selection.systemId) : undefined;
  const selSegment = selLane && selection ? findSelectedSegment(selLane, selection) : null;
  const availability =
    selSegment && selLane && selSystem
      ? editorAvailability(selSegment, selSystem.capabilities, selLane.representation)
      : null;
  const editorOpen = availability?.clickable === true && selSegment !== null;
  const option =
    availability && editorOption && availability.options.includes(editorOption)
      ? editorOption
      : (availability?.defaultOption ?? null);
  const selectedSlot = selSegment && selLane ? slotAttr(selLane.systemId, selSegment) : null;
  const selectedKeys = useMemo(() => {
    const keys = new Map<string, string>();
    if (editorOpen && selLane && selSegment) keys.set(selLane.systemId, selSegment.key);
    return keys;
  }, [editorOpen, selLane, selSegment]);

  // Return the focus to the edited segment when the editor closes. The segment's button is re-created when the
  // timeline reloads (keys change after an edit), so the focus is moved again until the user focuses elsewhere.
  const canMoveFocus = (active: Element | null) =>
    isBlank(active) || !active?.isConnected || active.closest('[data-slot-editor]') !== null;
  const focusSlot = (slot: string) => {
    panelRef.current?.querySelector<HTMLElement>(`button[data-slot="${slot}"]`)?.focus();
  };
  const retryFocus = () => {
    const slot = pendingFocus.current;
    if (slot === null) return;
    const active = document.activeElement;
    if (canMoveFocus(active)) focusSlot(slot);
    else if (!(active instanceof HTMLElement && active.dataset['slot'] === slot)) pendingFocus.current = null;
  };

  useEffect(() => {
    if (wasOpen.current && !editorOpen && returnFocus.current) {
      const { el, slot } = returnFocus.current;
      if (canMoveFocus(document.activeElement)) {
        if (el?.isConnected) el.focus();
        else focusSlot(slot);
        pendingFocus.current = slot;
      }
      returnFocus.current = null;
    }
    wasOpen.current = editorOpen;
  }, [editorOpen]);

  useEffect(retryFocus, [tl]);

  const onSelect = (lane: SystemLane, seg: ProgramSegment, avail: EditorAvailability, button: HTMLButtonElement) => {
    if (editorOpen && selSegment?.key === seg.key && selLane?.systemId === lane.systemId) {
      closeEditor();
      return;
    }
    if (seg.slotRef == null || seg.day == null || seg.state === 'past') return;
    returnFocus.current = { el: button, slot: slotAttr(lane.systemId, seg) };
    pendingFocus.current = null;
    setErrorSlot(null);
    select(
      { systemId: lane.systemId, segmentKey: seg.key, slotRef: seg.slotRef, day: seg.day, state: seg.state },
      avail.defaultOption,
    );
  };

  const onDone = async () => {
    if (draft === null) {
      closeEditor();
      return;
    }
    setBusy(true);
    try {
      await ds.createOverride(draft);
      setErrorSlot(null);
      closeEditor();
    } catch {
      setErrorSlot(selectedSlot);
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    setDraft(null);
    const overrideId = selSegment?.overrideId ?? null;
    if (overrideId === null) return;
    setBusy(true);
    try {
      await ds.deleteOverride(overrideId);
      setErrorSlot(null);
    } catch {
      setErrorSlot(selectedSlot);
    } finally {
      setBusy(false);
    }
  };

  const onPanelKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && editorOpen) {
      e.preventDefault();
      closeEditor();
    }
  };

  const chartLabel = t('clima.thermogram.ariaLabel', {
    room: roomName(tl.room),
    range: t(`clima.range.description.${tl.grid.range}`),
    summary,
  });

  return (
    <section
      ref={panelRef}
      className={`${styles.panel} ${styles.thermoPanel} ${enterClass(2)}`}
      aria-label={t('clima.thermogram.label')}
      onKeyDown={onPanelKeyDown}
    >
      <div className={styles.topBar}>
        <TopLegend />
        <div className={styles.topRight}>
          {hasProgram ? (
            <span className={styles.hint}>
              {anyEditable ? t('clima.thermogram.hint') : t('clima.thermogram.hintReadonly')}
            </span>
          ) : null}
          <RangeSelector value={range} onChange={setRange} size="stanza" />
        </div>
      </div>
      <div className={styles.body}>
        <ThermogramLabels tl={tl} lanes={lanes} />
        <ThermogramPlot
          tl={tl}
          lanes={lanes}
          systems={systems}
          chartLabel={chartLabel}
          cursorIndex={cursorIndex}
          onCursor={setCursor}
          onEscape={() => (editorOpen ? closeEditor() : setCursor(null))}
          selectedKeys={selectedKeys}
          editorId={editorId}
          onSelect={onSelect}
        />
      </div>
      <AxisLabels ticks={ticks} className={styles.axisRow ?? ''} />
      <BottomLegend lanes={lanes} />
      <AnimatePresence onExitComplete={retryFocus}>
        {editorOpen && selLane && selSegment && availability && option ? (
          <SlotEditor
            key="slot-editor"
            id={editorId}
            tl={tl}
            systemId={selLane.systemId}
            segment={selSegment}
            availability={availability}
            option={option}
            draft={draft}
            error={previewError || (errorSlot !== null && errorSlot === selectedSlot)}
            busy={busy}
            focusKey={selectedSlot ?? ''}
            onOption={setEditorOption}
            onDraft={setDraft}
            onReset={() => void onReset()}
            onDone={() => void onDone()}
            onClose={closeEditor}
          />
        ) : null}
      </AnimatePresence>
      <ThermogramTable tl={tl} lanes={lanes} />
    </section>
  );
}
