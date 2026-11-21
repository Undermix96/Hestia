import { useEffect, useState } from 'react';
import { useDataSource } from '../api/datasource/context';

/** How often the header clock is refreshed. */
const REFRESH_MS = 15_000;

/**
 * Wall clock of the data source (the mock returns its fixed clock) and the
 * IANA zone to display it in. Refreshed periodically for real sources.
 */
export function useNow(refreshMs: number = REFRESH_MS): { now: Date; timeZone: string } {
  const ds = useDataSource();
  const [now, setNow] = useState(() => ds.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = ds.now();
      setNow((prev) => (prev.getTime() === next.getTime() ? prev : next));
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [ds, refreshMs]);

  return { now, timeZone: ds.timeZone };
}
