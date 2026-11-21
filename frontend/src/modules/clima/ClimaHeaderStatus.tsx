import { t } from '../../i18n';
import { fmt } from '../../i18n/format';
import { useClimaStore } from './store/climaStore';

/**
 * Clima status in the header: outdoor temperature and humidity now, published
 * to the store by the clima screens. Renders nothing until they are known.
 */
export function ClimaHeaderStatus() {
  const outdoor = useClimaStore((s) => s.outdoorNow);
  if (outdoor === null) return null;
  const missing = t('common.missingValue');
  return (
    <span data-testid="clima-header-status">
      {t('header.outdoor', {
        temperature: outdoor.temperatureC === null ? missing : fmt.temp(outdoor.temperatureC),
        humidity: outdoor.humidityPct === null ? missing : fmt.pct(outdoor.humidityPct),
      })}
    </span>
  );
}
