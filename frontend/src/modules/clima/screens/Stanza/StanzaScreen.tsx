import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import type { RoomTimeline } from '../../../../api/types';
import { ErrorView } from '../../../../app/ErrorView';
import { KeepSearchNavigate } from '../../../../app/keepSearch';
import { t } from '../../../../i18n';
import { enterClass } from '../../../../styles/motion';
import { useRoomTimeline } from '../../data/useRoomTimeline';
import { summaryFacts, summaryInputFromTimeline } from '../../logic/summaryFacts';
import { roomName, systemName } from '../../names';
import { CLIMA_STANZA_PATH, stanzaPath } from '../../paths';
import { useClimaStore } from '../../store/climaStore';
import { PowerCard } from './PowerCard';
import { RoomTabs } from './RoomTabs';
import { Summary } from './Summary';
import { renderSummary } from './summaryText';
import { ThermogramPanel } from './ThermogramPanel';
import { WeekProgram } from './WeekProgram';
import styles from './Stanza.module.css';

/** Room a sensorless room redirects to: the room it follows, else the first room with a sensor. */
function redirectTarget(tl: RoomTimeline): string | null {
  if (tl.room.hasSensor) return null;
  const followed = tl.rooms.find((r) => r.roomId === tl.room.followsRoomId && r.hasSensor);
  return followed?.roomId ?? tl.rooms.find((r) => r.hasSensor)?.roomId ?? null;
}

/** Placeholder blocks with the final sizes while the first timeline loads. */
function StanzaSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <h1 className="visually-hidden">{t('module.clima.stanza')}</h1>
      <p className="visually-hidden" role="status">
        {t('common.loading')}
      </p>
      <div className={`${styles.skeletonTabs} ${enterClass(1)}`} />
      <div className={`${styles.skeletonSummary} ${enterClass(1)}`} />
      <div className={`${styles.panel} ${styles.skeletonThermo} ${enterClass(2)}`} />
      <div className={styles.bottomRow}>
        <div className={`${styles.panel} ${styles.skeletonCard} ${enterClass(3)}`} />
        <div className={`${styles.panel} ${styles.skeletonWeek} ${enterClass(3)}`} />
      </div>
    </div>
  );
}

function StanzaContent({ tl, previewError }: { tl: RoomTimeline; previewError: boolean }) {
  const text = useMemo(
    () =>
      renderSummary(
        summaryFacts(summaryInputFromTimeline(tl, { room: roomName, system: systemName })),
        tl.clock.timeZone,
      ),
    [tl],
  );
  return (
    <>
      <h1 className="visually-hidden">{t('clima.stanza.title', { room: roomName(tl.room) })}</h1>
      <RoomTabs rooms={tl.rooms} activeRoomId={tl.room.id} />
      <Summary text={text} />
      <ThermogramPanel tl={tl} summary={text.full} previewError={previewError} />
      <div className={styles.bottomRow}>
        <PowerCard tl={tl} />
        <WeekProgram tl={tl} />
      </div>
    </>
  );
}

/** `/clima/stanza/:roomId`: one room on the thermogram, with its program and the house power. */
export function StanzaScreen() {
  const { roomId } = useParams();
  const range = useClimaStore((s) => s.range);
  const lastRoomId = useClimaStore((s) => s.lastRoomId);
  const draft = useClimaStore((s) => s.draft);
  const setLastRoom = useClimaStore((s) => s.setLastRoom);
  const setOutdoorNow = useClimaStore((s) => s.setOutdoorNow);
  const closeEditor = useClimaStore((s) => s.closeEditor);
  const setCursor = useClimaStore((s) => s.setCursor);

  // Another room closes the editor at once, not only once its timeline has loaded (setLastRoom).
  useEffect(() => {
    if (roomId !== useClimaStore.getState().lastRoomId) closeEditor();
  }, [roomId, closeEditor]);

  // Leaving the screen discards the editor and its draft, and the cursor.
  useEffect(
    () => () => {
      closeEditor();
      setCursor(null);
    },
    [closeEditor, setCursor],
  );

  // A draft belongs to the room shown last: never preview it on another room.
  const timeline = useRoomTimeline(roomId, range, lastRoomId === roomId ? draft : null);
  const tl = timeline.data !== null && timeline.data.room.id === roomId ? timeline.data : null;
  const redirect = tl ? redirectTarget(tl) : null;

  useEffect(() => {
    if (tl && tl.room.hasSensor) setLastRoom(tl.room.id);
  }, [tl, setLastRoom]);

  useEffect(() => {
    if (tl) setOutdoorNow({ temperatureC: tl.outdoor.nowC, humidityPct: tl.outdoor.nowHumidityPct });
  }, [tl, setOutdoorNow]);

  if (timeline.status === 'error' && timeline.error.code === 'not_found') {
    return <KeepSearchNavigate to={CLIMA_STANZA_PATH} replace />;
  }
  if (tl && !tl.room.hasSensor) {
    return <KeepSearchNavigate to={redirect === null ? CLIMA_STANZA_PATH : stanzaPath(redirect)} replace />;
  }
  // While another room loads, the previous one stays on screen so the charts can morph.
  const shown = timeline.data;
  if (timeline.status === 'error' && (shown === null || draft === null)) {
    return (
      <>
        <h1 className="visually-hidden">{t('module.clima.stanza')}</h1>
        <ErrorView error={timeline.error} onRetry={timeline.reload} />
      </>
    );
  }
  if (shown === null || !shown.room.hasSensor) return <StanzaSkeleton />;
  return <StanzaContent tl={shown} previewError={timeline.status === 'error'} />;
}
