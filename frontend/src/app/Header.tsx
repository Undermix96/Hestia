import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router';
import { t } from '../i18n';
import { fmt } from '../i18n/format';
import { MOTION } from '../styles/motion';
import { withKeptSearch } from './keepSearch';
import styles from './Header.module.css';
import {
  activeModule,
  isNavItemActive,
  navItemTarget,
  visibleModules,
  type AppModule,
  type ModuleNavItem,
} from './modules';
import { useNow } from './useNow';

/**
 * Resolved targets of every visible nav item, re-read when a module says
 * they may have changed (`subscribeNav`). A string, so React compares by value.
 */
function useNavTargets(list: readonly AppModule[]): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribes = list.flatMap((m) => (m.subscribeNav ? [m.subscribeNav(onChange)] : []));
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    },
    [list],
  );
  const snapshot = () =>
    JSON.stringify(list.map((m) => m.nav.map((item) => navItemTarget(item))));
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function NavItemLink({ item, pathname, search }: { item: ModuleNavItem; pathname: string; search: string }) {
  const active = isNavItemActive(item, pathname);
  return (
    <Link
      to={withKeptSearch(navItemTarget(item), search)}
      className={styles.link}
      aria-current={active ? 'page' : undefined}
    >
      {t(item.labelKey)}
    </Link>
  );
}

function ModuleNav({ module, pathname, search }: { module: AppModule; pathname: string; search: string }) {
  const links = module.nav.map((item) => (
    <NavItemLink key={item.id} item={item} pathname={pathname} search={search} />
  ));
  if (module.nav.length <= 1) return <>{links}</>;
  const labelId = `nav-group-${module.id}`;
  return (
    <span className={styles.group} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.groupLabel}>
        {t(module.labelKey)}
      </span>
      {links}
    </span>
  );
}

/** Logo, module menu (visible modules only), date/time and the active module's status. */
export function Header({ modules }: { modules: readonly AppModule[] }) {
  const { pathname, search } = useLocation();
  const { now, timeZone } = useNow();
  const shown = useMemo(() => visibleModules(modules), [modules]);
  useNavTargets(shown);
  const current = activeModule(pathname, modules);
  const Status = current?.HeaderStatus;

  return (
    <header className={`${styles.header} ${MOTION.enter}`}>
      <nav className={styles.nav} aria-label={t('nav.label')}>
        <span className={styles.logo}>{t('app.name')}</span>
        {shown.map((m) => (
          <ModuleNav key={m.id} module={m} pathname={pathname} search={search} />
        ))}
      </nav>
      <span className={`${styles.status} mono num`}>
        <span>
          {t('header.dateTime', {
            date: fmt.headerDate(now, timeZone),
            time: fmt.time(now.toISOString(), timeZone),
          })}
        </span>
        {Status ? (
          <span className={styles.moduleStatus}>
            <Status />
          </span>
        ) : null}
      </span>
    </header>
  );
}
