/**
 * Keeps the dev query parameters (`?scenario`, `?source`) across in-app
 * navigation, so a scenario chosen in the URL survives links and redirects.
 */
import { createElement } from 'react';
import { Navigate, useLocation } from 'react-router';

/** Query parameters that every in-app link and redirect carries over. */
export const KEPT_SEARCH_PARAMS = ['scenario', 'source'] as const;

/**
 * Returns `to` with the kept parameters of `currentSearch` appended.
 * Parameters already present in `to` win; a `#hash` in `to` is preserved.
 */
export function withKeptSearch(to: string, currentSearch: string): string {
  const current = new URLSearchParams(currentSearch);
  const hashAt = to.indexOf('#');
  const hash = hashAt >= 0 ? to.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? to.slice(0, hashAt) : to;
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '');

  for (const name of KEPT_SEARCH_PARAMS) {
    const value = current.get(name);
    if (value !== null && !params.has(name)) params.set(name, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ''}${hash}`;
}

/** `to` with the kept parameters of the current location. */
export function useKeptSearchLink(to: string): string {
  const { search } = useLocation();
  return withKeptSearch(to, search);
}

/** `<Navigate>` that keeps `?scenario`/`?source`. */
export function KeepSearchNavigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const target = useKeptSearchLink(to);
  return createElement(Navigate, { to: target, replace });
}
