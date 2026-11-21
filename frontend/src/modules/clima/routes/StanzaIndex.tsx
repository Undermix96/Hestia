import { DataSourceError } from '../../../api/datasource/types';
import type { RoomView } from '../../../api/types';
import { ErrorView } from '../../../app/ErrorView';
import { KeepSearchNavigate } from '../../../app/keepSearch';
import { t } from '../../../i18n';
import { useRooms } from '../data/useRooms';
import { stanzaPath } from '../paths';
import { useClimaStore } from '../store/climaStore';

/** Room the Stanza index opens: the last room shown if it still exists, else the first room with a sensor. */
// eslint-disable-next-line react-refresh/only-export-components
export function defaultRoomId(rooms: readonly RoomView[], lastRoomId: string | null): string | null {
  const last = lastRoomId === null ? undefined : rooms.find((r) => r.id === lastRoomId);
  if (last?.hasSensor) return last.id;
  return rooms.find((r) => r.hasSensor)?.id ?? rooms[0]?.id ?? null;
}

/** `/clima/stanza`: redirects to the default room. */
export function StanzaIndex() {
  const rooms = useRooms();
  const lastRoomId = useClimaStore((s) => s.lastRoomId);

  if (rooms.status === 'error') return <ErrorView error={rooms.error} onRetry={rooms.reload} />;
  if (rooms.status === 'loading') {
    return (
      <p className="visually-hidden" role="status">
        {t('common.loading')}
      </p>
    );
  }
  const roomId = defaultRoomId(rooms.data, lastRoomId);
  if (roomId === null) return <ErrorView error={new DataSourceError('not_found', 'no rooms')} />;
  return <KeepSearchNavigate to={stanzaPath(roomId)} replace />;
}
