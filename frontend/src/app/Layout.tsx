import { Outlet } from 'react-router';
import { t } from '../i18n';
import { Header } from './Header';
import styles from './Layout.module.css';
import type { AppModule } from './modules';

/** Page container shared by every screen: skip link, header, main content. */
export function Layout({ modules }: { modules: readonly AppModule[] }) {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        {t('app.skipToContent')}
      </a>
      <div className={styles.container}>
        <Header modules={modules} />
        <main id="main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
