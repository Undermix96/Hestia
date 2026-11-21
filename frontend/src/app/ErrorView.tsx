import type { ReactNode } from 'react';
import { DataSourceError } from '../api/datasource/types';
import { t, tDynamic } from '../i18n';
import styles from './ErrorView.module.css';

export interface ErrorViewProps {
  /** A `DataSourceError` shows its code's message; anything else is "unexpected". */
  error: unknown;
  /** Shows a "Riprova" button when given. */
  onRetry?: () => void;
  /** Extra content under the message (e.g. a link back). */
  children?: ReactNode;
}

/** Message key of an error: `error.<code>`, falling back to `error.unexpected`. */
// eslint-disable-next-line react-refresh/only-export-components
export function errorMessage(error: unknown): string {
  const code = error instanceof DataSourceError ? error.code : 'unexpected';
  return tDynamic(`error.${code}`, 'error.unexpected');
}

/** Error state of a screen or of the whole app. */
export function ErrorView({ error, onRetry, children }: ErrorViewProps) {
  return (
    <section className={styles.panel} role="alert" aria-labelledby="error-view-title">
      <h2 id="error-view-title" className={styles.title}>
        {t('error.title')}
      </h2>
      <p className={styles.message}>{errorMessage(error)}</p>
      {onRetry ? (
        <button type="button" className={styles.action} onClick={onRetry}>
          {t('error.retry')}
        </button>
      ) : null}
      {children}
    </section>
  );
}
