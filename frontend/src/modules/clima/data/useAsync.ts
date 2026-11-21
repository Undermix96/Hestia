/**
 * Loads data from the data source keyed by a string.
 *
 * - The previous data stays available while a new key (or a reload) loads,
 *   so charts can morph instead of flashing empty.
 * - The previous request is aborted and stale results are ignored.
 * - Every hook reloads when the data source notifies a change (`subscribe`).
 * - Errors that are not `DataSourceError` are wrapped as `unexpected`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataSource } from '../../../api/datasource/context';
import { DataSourceError } from '../../../api/datasource/types';

export type AsyncState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: DataSourceError };

export type AsyncResult<T> = AsyncState<T> & { reload(): void };

type Settled<T> =
  | { id: string; ok: true; data: T }
  | { id: string; ok: false; data: T | null; error: DataSourceError };

export function toDataSourceError(error: unknown): DataSourceError {
  if (error instanceof DataSourceError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new DataSourceError('unexpected', message);
}

/**
 * Runs `load` whenever `key` changes (null = nothing to load yet: stays loading).
 * `load` is read from the latest render, so it may close over current values.
 */
export function useAsync<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): AsyncResult<T> {
  const ds = useDataSource();
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => ds.subscribe(() => setVersion((v) => v + 1)), [ds]);

  const requestId = key === null ? null : `${version}|${key}`;

  useEffect(() => {
    if (requestId === null) return undefined;
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ id: requestId, ok: true, data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled((prev) => ({
          id: requestId,
          ok: false,
          data: prev?.data ?? null,
          error: toDataSourceError(error),
        }));
      },
    );
    return () => controller.abort();
  }, [requestId]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return useMemo((): AsyncResult<T> => {
    if (settled !== null && settled.id === requestId) {
      return settled.ok
        ? { status: 'ready', data: settled.data, error: null, reload }
        : { status: 'error', data: settled.data, error: settled.error, reload };
    }
    return { status: 'loading', data: settled?.data ?? null, error: null, reload };
  }, [settled, requestId, reload]);
}
