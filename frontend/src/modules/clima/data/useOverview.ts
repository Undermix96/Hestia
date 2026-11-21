import { useDataSource } from '../../../api/datasource/context';
import type { ClimaOverview, TimeRange } from '../../../api/types';
import { useAsync, type AsyncResult } from './useAsync';

/** Overview of every room for the Tutte screen. */
export function useOverview(range: TimeRange): AsyncResult<ClimaOverview> {
  const ds = useDataSource();
  return useAsync(`overview|${range}`, (signal) => ds.getOverview({ range }, signal));
}
