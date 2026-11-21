import { useDataSource } from '../../../api/datasource/context';
import type { OverrideCreate, RoomTimeline, TimeRange } from '../../../api/types';
import { useAsync, type AsyncResult } from './useAsync';

/**
 * Timeline of one room for the Stanza screen. A non-null `draft` is previewed
 * (the mock applies it from now on without storing it).
 */
export function useRoomTimeline(
  roomId: string | undefined,
  range: TimeRange,
  draft: OverrideCreate | null,
): AsyncResult<RoomTimeline> {
  const ds = useDataSource();
  const key = roomId === undefined ? null : `timeline|${roomId}|${range}|${JSON.stringify(draft)}`;
  return useAsync(key, (signal) =>
    ds.getRoomTimeline({ roomId: roomId ?? '', range, draft }, signal),
  );
}
