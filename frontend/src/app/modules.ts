/**
 * Module registry. Every top-level area of the app (Clima, Energia, Luci, ...)
 * is an `AppModule`: it declares its menu entries, its routes and an optional
 * status shown on the right of the header. Hidden modules are registered but
 * neither rendered in the menu nor routed.
 */
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import type { MessageKey } from '../i18n';
import { climaModule } from '../modules/clima/module';
import { energiaModule } from '../modules/energia/module';
import { luciModule } from '../modules/luci/module';

export interface ModuleNavItem {
  id: string;
  labelKey: MessageKey;
  /** Link target; a function is evaluated at render time (e.g. "last room shown"). */
  to: string | (() => string);
  /** The item is active for this path and every path below it. */
  activePrefix: string;
}

export interface AppModule {
  id: string;
  labelKey: MessageKey;
  visible: boolean;
  /** More than one item → rendered as a labelled group (clima). */
  nav: ModuleNavItem[];
  /** Mounted only when the module is visible. */
  routes: RouteObject[];
  /** Status shown after the date/time in the header while the module is active. */
  HeaderStatus?: ComponentType;
  /**
   * Notifies when a function `to` of a nav item may resolve differently
   * (e.g. the last room shown changed), so the header re-renders its links.
   */
  subscribeNav?(onChange: () => void): () => void;
}

export const modules: readonly AppModule[] = [climaModule, energiaModule, luciModule];

export function visibleModules(list: readonly AppModule[] = modules): AppModule[] {
  return list.filter((m) => m.visible);
}

/** Resolves a nav item's target path (without query). */
export function navItemTarget(item: ModuleNavItem): string {
  return typeof item.to === 'function' ? item.to() : item.to;
}

/** True when `pathname` is `prefix` or below it (segment-aware). */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return pathname.startsWith(base);
}

export function isNavItemActive(item: ModuleNavItem, pathname: string): boolean {
  return matchesPrefix(pathname, item.activePrefix);
}

/** The visible module owning `pathname` (through its nav items), if any. */
export function activeModule(pathname: string, list: readonly AppModule[] = modules): AppModule | null {
  return (
    visibleModules(list).find((m) => m.nav.some((item) => isNavItemActive(item, pathname))) ?? null
  );
}
