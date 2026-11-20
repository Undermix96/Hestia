import { t } from '../i18n';
import { VersionStatus } from './VersionStatus';

export function App() {
  return (
    <>
      <header className="header">
        <h1 className="header__title">{t('app.title')}</h1>
        <p className="header__tagline">{t('app.tagline')}</p>
      </header>
      <main className="main">
        <VersionStatus />
      </main>
    </>
  );
}
