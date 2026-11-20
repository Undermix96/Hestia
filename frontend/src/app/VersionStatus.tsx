import { useEffect, useState } from 'react';
import { fetchVersion } from '../api/version';
import { t } from '../i18n';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; version: string }
  | { kind: 'error' };

/** Status line showing whether the backend answers `/api/version`. */
export function VersionStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchVersion(controller.signal)
      .then((info) => setState({ kind: 'ok', version: info.version }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, []);

  let text: string;
  switch (state.kind) {
    case 'loading':
      text = t('status.loading');
      break;
    case 'ok':
      text = t('status.ok', { version: state.version });
      break;
    case 'error':
      text = t('status.error');
      break;
  }

  return (
    <p
      className="status"
      data-state={state.kind}
      role="status"
      aria-label={t('status.label')}
    >
      <span className="status__dot" aria-hidden="true" />
      {text}
    </p>
  );
}
