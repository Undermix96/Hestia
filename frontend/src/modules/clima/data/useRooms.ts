import { useDataSource } from '../../../api/datasource/context';
import type { RoomView } from '../../../api/types';
import { useAsync, type AsyncResult } from './useAsync';

/** All rooms in configuration order. */
export function useRooms(): AsyncResult<RoomView[]> {
  const ds = useDataSource();
  return useAsync('rooms', (signal) => ds.getRooms(signal));
}
