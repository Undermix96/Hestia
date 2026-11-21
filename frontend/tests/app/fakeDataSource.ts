import { DataSourceError, type DataSource } from '../../src/api/datasource/types';
import type { RoomView } from '../../src/api/types';

export const FAKE_NOW_ISO = '2026-11-20T08:30:00+01:00';

function room(id: string, hasSensor: boolean, followsRoomId: string | null = null): RoomView {
  return {
    id,
    name: null,
    nameKey: `mock.room.${id}`,
    hasSensor,
    followsRoomId,
    systemIds: [],
    displayTargetSystemId: null,
  };
}

export const FAKE_ROOMS: RoomView[] = [
  room('soggiorno', true),
  room('camera', true),
  room('ripostiglio', false, 'camera'),
];

/** Minimal data source for shell tests: fixed clock and a room list; the rest is unavailable. */
export function fakeDataSource(rooms: RoomView[] = FAKE_ROOMS): DataSource {
  const unavailable = () => Promise.reject(new DataSourceError('no_data_source', 'fake'));
  return {
    kind: 'mock',
    scenario: 'home',
    timeZone: 'Europe/Rome',
    now: () => new Date(FAKE_NOW_ISO),
    getRooms: () => Promise.resolve(rooms.map((r) => ({ ...r }))),
    getRoomTimeline: unavailable,
    getOverview: unavailable,
    createOverride: unavailable,
    deleteOverride: unavailable,
    subscribe: () => () => {},
  };
}
