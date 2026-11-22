import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { t } from '../i18n';
import { Header } from './Header';
import styles from './Layout.module.css';
import type { AppModule } from './modules';

/** Shown in the main area while a lazily loaded screen's code arrives. */
function ScreenLoading() {
  return (
    <p className="visually-hidden" role="status">
      {t('common.loading')}
    </p>
  );
}

/** Page container shared by every screen: skip link, header, main content (screens may be lazy). */
export function Layout({ modules }: { modules: readonly AppModule[] }) {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        {t('app.skipToContent')}
      </a>
      <div className={styles.container}>
        <Header modules={modules} />
        <main id="main" className={styles.main} tabIndex={-1}>
          <Suspense fallback={<ScreenLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </>
  );
}
