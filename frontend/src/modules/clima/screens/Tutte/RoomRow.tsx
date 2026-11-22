import { Link } from 'react-router';
import type { OverviewRow } from '../../../../api/types';
import { useKeptSearchLink } from '../../../../app/keepSearch';
import { t } from '../../../../i18n';
import { degrees } from '../../components/chartTexts';
import { SystemStatusLine } from '../../components/SystemStatusLine';
import { isActive } from '../../logic/colors';
import { stanzaPath } from '../../paths';
import { kindSpec } from '../../systemKinds';
import { linkRoomId, nameOf, viaRoomName, type RoomNames } from './tutteModel';
import styles from './Tutte.module.css';

/** Left cell of a room row: name, temperature now, one status line per system, link to the room. */
export function RoomRow({ row, names }: { row: OverviewRow; names: RoomNames }) {
  const targetId = linkRoomId(row);
  const href = useKeptSearchLink(stanzaPath(targetId));
  const sensor = row.room.hasSensor;
  return (
    <div className={`${styles.row} ${styles.roomRow}`} data-testid={`tutte-row-${row.room.id}`}>
      <span className={styles.roomHead}>
        <span className={styles.roomName}>{nameOf(names, row.room.id)}</span>
        <span className={`num ${styles.roomTemp}`}>{degrees(row.status.temperatureC)}</span>
      </span>
      {row.status.systems.map((status) => (
        <SystemStatusLine
          key={status.systemId}
          status={status}
          shape={kindSpec(status.kind).dotShape}
          viaRoomName={viaRoomName(row, status, names)}
          pulse={sensor && isActive(status.action)}
          gap={6}
          className={styles.status ?? ''}
        />
      ))}
      <Link
        to={href}
        className={styles.open}
        aria-label={t('clima.tutte.openRoomLabel', { room: nameOf(names, targetId) })}
      >
        {t('clima.tutte.openRoom')}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
