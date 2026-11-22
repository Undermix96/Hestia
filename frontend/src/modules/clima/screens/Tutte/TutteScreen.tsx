import { useEffect } from 'react';
import { ErrorView } from '../../../../app/ErrorView';
import { t } from '../../../../i18n';
import { enterClass } from '../../../../styles/motion';
import { useOverview } from '../../data/useOverview';
import { useClimaStore } from '../../store/climaStore';
import { AllRoomsPanel } from './AllRoomsPanel';
import styles from './Tutte.module.css';

/** "Tutte le stanze": every room on one panel with a shared time cursor. */
export function TutteScreen() {
  const range = useClimaStore((s) => s.range);
  const setRange = useClimaStore((s) => s.setRange);
  const setOutdoorNow = useClimaStore((s) => s.setOutdoorNow);
  const setCursor = useClimaStore((s) => s.setCursor);
  const overview = useOverview(range);
  const data = overview.data;

  useEffect(() => {
    if (data) setOutdoorNow({ temperatureC: data.outdoor.nowC, humidityPct: data.outdoor.nowHumidityPct });
  }, [data, setOutdoorNow]);

  // The cursor does not follow the user to another screen.
  useEffect(() => () => setCursor(null), [setCursor]);

  return (
    <>
      <h1 className="visually-hidden">{t('clima.tutte.title')}</h1>
      {overview.status === 'error' ? <ErrorView error={overview.error} onRetry={overview.reload} /> : null}
      {data !== null ? (
        <AllRoomsPanel overview={data} range={range} onRangeChange={setRange} />
      ) : overview.status === 'loading' ? (
        <section
          className={`${styles.panel} ${styles.skeleton} ${enterClass(2)}`}
          aria-label={t('clima.tutte.label')}
          aria-busy="true"
        >
          <span className="visually-hidden">{t('common.loading')}</span>
        </section>
      ) : null}
    </>
  );
}
