// Renders the Stanza screen on a MockDataSource scenario with a memory router (Stanza index + screen + a location probe).
/* eslint-disable react-refresh/only-export-components -- test helper: never hot-reloaded */
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { expect } from 'vitest';
import catalog from '../../../../locales/it.json';
import { MockDataSource } from '../../../src/api/datasource';
import { DataSourceProvider } from '../../../src/api/datasource/context';
import type { DataSource, ScenarioId } from '../../../src/api/datasource/types';
import { StanzaIndex } from '../../../src/modules/clima/routes/StanzaIndex';
import { StanzaScreen } from '../../../src/modules/clima/screens/Stanza/StanzaScreen';
import { useClimaStore } from '../../../src/modules/clima/store/climaStore';

export { catalog };

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

export function renderStanza(path: string, ds: DataSource) {
  const router = createMemoryRouter(
    [
      { path: '/clima/stanza', element: <StanzaIndex /> },
      {
        path: '/clima/stanza/:roomId',
        element: (
          <>
            <StanzaScreen />
            <LocationProbe />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const view = render(
    <DataSourceProvider value={ds}>
      <RouterProvider router={router} />
    </DataSourceProvider>,
  );
  return { router, ds, view };
}

/** Renders `/clima/stanza/<roomId>?scenario=<scenario>` and waits for the thermogram. */
export async function renderRoom(
  scenario: ScenarioId,
  roomId = 'soggiorno',
  ds: DataSource = new MockDataSource(scenario),
) {
  const result = renderStanza(`/clima/stanza/${roomId}?scenario=${scenario}`, ds);
  await screen.findByRole('region', { name: catalog['clima.thermogram.label'] });
  // the screen records the room once its data is shown (this also closes any editor): wait for it
  await waitFor(() => expect(useClimaStore.getState().lastRoomId).toBe(roomId));
  return result;
}

export const thermogram = () => screen.getByRole('region', { name: catalog['clima.thermogram.label'] });
export const slider = () => screen.getByRole('slider', { name: catalog['clima.cursor.slider'] });
export const tooltip = () => screen.queryByTestId('cursor-tooltip');
export const editor = () => screen.queryByRole('group', { name: catalog['clima.editor.label'] });
/** Buttons of the editable program segments, in lane order. */
export const segmentButtons = () => Array.from(thermogram().querySelectorAll<HTMLButtonElement>('button[data-slot]'));
export const segmentButton = (systemId: string, day: string, slotRef: string) => {
  const button = thermogram().querySelector<HTMLButtonElement>(`button[data-slot="${systemId}|${day}|${slotRef}"]`);
  if (!button) throw new Error(`No segment button ${systemId}|${day}|${slotRef}`);
  return button;
};
