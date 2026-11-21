import { useRouteError } from 'react-router';
import { ErrorView } from './ErrorView';
import styles from './Layout.module.css';

/** Error boundary of the router: an exception while rendering a route. */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className={styles.container}>
      <main id="main" className={styles.main}>
        <ErrorView error={error} onRetry={() => window.location.reload()} />
      </main>
    </div>
  );
}
