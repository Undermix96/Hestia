import { Link } from 'react-router';
import { t } from '../i18n';
import errorStyles from './ErrorView.module.css';
import { useKeptSearchLink } from './keepSearch';

/** Fallback for unknown paths. */
export function NotFound() {
  const back = useKeptSearchLink('/clima');
  return (
    <section className={errorStyles.panel} aria-labelledby="not-found-title">
      <h1 id="not-found-title" className={errorStyles.title}>
        {t('notFound.title')}
      </h1>
      <Link to={back} className={errorStyles.action}>
        {t('notFound.back')}
      </Link>
    </section>
  );
}
