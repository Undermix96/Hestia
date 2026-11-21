/**
 * The Clima module: two menu entries (Stanza, Tutte le stanze), its routes and
 * the outdoor status in the header.
 */
import type { AppModule } from '../../app/modules';
import { KeepSearchNavigate } from '../../app/keepSearch';
import { ClimaHeaderStatus } from './ClimaHeaderStatus';
import { CLIMA_STANZA_PATH, CLIMA_TUTTE_PATH, stanzaPath } from './paths';
import { StanzaIndex } from './routes/StanzaIndex';
import { StanzaScreen } from './screens/Stanza/StanzaScreen';
import { TutteScreen } from './screens/Tutte/TutteScreen';
import { useClimaStore } from './store/climaStore';

export const climaModule: AppModule = {
  id: 'clima',
  labelKey: 'module.clima.name',
  visible: true,
  nav: [
    {
      id: 'stanza',
      labelKey: 'module.clima.stanza',
      to: () => stanzaPath(useClimaStore.getState().lastRoomId),
      activePrefix: CLIMA_STANZA_PATH,
    },
    {
      id: 'tutte',
      labelKey: 'module.clima.tutte',
      to: CLIMA_TUTTE_PATH,
      activePrefix: CLIMA_TUTTE_PATH,
    },
  ],
  routes: [
    { path: 'clima', element: <KeepSearchNavigate to={CLIMA_STANZA_PATH} replace /> },
    { path: 'clima/stanza', element: <StanzaIndex /> },
    { path: 'clima/stanza/:roomId', element: <StanzaScreen /> },
    { path: 'clima/tutte', element: <TutteScreen /> },
  ],
  HeaderStatus: ClimaHeaderStatus,
  subscribeNav(onChange) {
    return useClimaStore.subscribe((state, prev) => {
      if (state.lastRoomId !== prev.lastRoomId) onChange();
    });
  },
};
