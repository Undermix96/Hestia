import { NavLink, useLocation } from 'react-router';
import type { RoomStatus } from '../../../../api/types';
import { withKeptSearch } from '../../../../app/keepSearch';
import { t } from '../../../../i18n';
import { enterClass } from '../../../../styles/motion';
import { degrees } from '../../components/chartTexts';
import { SystemStatusLine } from '../../components/SystemStatusLine';
import { isActive } from '../../logic/colors';
import { roomName } from '../../names';
import { stanzaPath } from '../../paths';
import { kindSpec } from '../../systemKinds';
import styles from './Stanza.module.css';

export interface RoomTabsProps {
  rooms: readonly RoomStatus[];
  activeRoomId: string;
}

/** One card per room with a sensor (links), then a dashed card for each room without one (not focusable). */
export function RoomTabs({ rooms, activeRoomId }: RoomTabsProps) {
  const { search } = useLocation();
  const byId = new Map(rooms.map((r) => [r.roomId, r]));
  const nameOf = (id: string | null) => {
    const room = id === null ? undefined : byId.get(id);
    return room ? roomName(room) : t('common.missingValue');
  };
  const withSensor = rooms.filter((r) => r.hasSensor);
  const withoutSensor = rooms.filter((r) => !r.hasSensor);
  return (
    <div className={`${styles.tabs} ${enterClass(1)}`} role="group" aria-label={t('clima.rooms.label')}>
      {withSensor.map((room) => (
        <NavLink
          key={room.roomId}
          to={withKeptSearch(stanzaPath(room.roomId), search)}
          end
          className={styles.tab ?? ''}
          data-active={room.roomId === activeRoomId}
        >
          <span className={styles.tabTitle}>
            {roomName(room)}
            <span className={`${styles.tabTemp} num`}>{degrees(room.temperatureC)}</span>
          </span>
          <span className={styles.tabStatus}>
            {room.systems.map((s) => (
              <SystemStatusLine
                key={s.systemId}
                status={s}
                shape={kindSpec(s.kind).dotShape}
                viaRoomName={s.viaRoomId === null ? null : nameOf(s.viaRoomId)}
                pulse={isActive(s.action)}
                gap={5}
              />
            ))}
          </span>
        </NavLink>
      ))}
      {withoutSensor.map((room) => (
        <span key={room.roomId} className={`${styles.tab} ${styles.tabSensorless}`} data-room={room.roomId}>
          {roomName(room)}
          <span className={styles.tabFollows}>{t('clima.room.noSensor', { room: nameOf(room.followsRoomId) })}</span>
        </span>
      ))}
    </div>
  );
}
