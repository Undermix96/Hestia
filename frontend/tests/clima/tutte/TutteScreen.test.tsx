import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import catalog from '../../../../locales/it.json';
import { MockDataSource } from '../../../src/api/datasource';
import { DataSourceProvider } from '../../../src/api/datasource/context';
import { DataSourceError, type DataSource, type ScenarioId } from '../../../src/api/datasource/types';
import { TutteScreen } from '../../../src/modules/clima/screens/Tutte/TutteScreen';
import { resetClimaStore, useClimaStore } from '../../../src/modules/clima/store/climaStore';

function StanzaProbe() {
  const location = useLocation();
  return <p data-testid="stanza-probe">{`${location.pathname}${location.search}`}</p>;
}

function renderTutte(ds: DataSource, path = '/clima/tutte?scenario=home') {
  const router = createMemoryRouter(
    [
      { path: '/clima/tutte', element: <TutteScreen /> },
      { path: '/clima/stanza/:roomId', element: <StanzaProbe /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <DataSourceProvider value={ds}>
      <RouterProvider router={router} />
    </DataSourceProvider>,
  );
  return router;
}

async function renderScenario(scenario: ScenarioId) {
  renderTutte(new MockDataSource(scenario), `/clima/tutte?scenario=${scenario}`);
  await screen.findByTestId('tutte-readout');
}

const panel = () => screen.getByRole('region', { name: catalog['clima.tutte.label'] });
const readout = () => screen.getByTestId('tutte-readout').textContent;
const values = (roomId: string) => screen.getByTestId(`tutte-values-${roomId}`);
const valueTexts = (roomId: string) => Array.from(values(roomId).children).map((c) => c.textContent);
const roomRows = () => panel().querySelectorAll('[data-testid^="tutte-row-"]');
const strips = (roomId: string) => within(screen.getByTestId(`tutte-chart-${roomId}`)).queryAllByTestId('tutte-strip');
const slider = () => screen.getByRole('slider', { name: catalog['clima.cursor.slider'] });

describe('TutteScreen', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('renders one row per room in every scenario', async () => {
    const expected: Record<ScenarioId, number> = { home: 6, perSlot: 6, readonly: 6, noProgram: 6, manyRooms: 10 };
    for (const [scenario, count] of Object.entries(expected) as [ScenarioId, number][]) {
      resetClimaStore();
      await renderScenario(scenario);
      expect(roomRows()).toHaveLength(count);
      // One mini chart per room with a sensor, each a labelled image.
      const sensorRooms = scenario === 'manyRooms' ? 8 : 5;
      expect(within(panel()).getAllByRole('img')).toHaveLength(sensorRooms);
      cleanup();
    }
  });

  it('shows the expected values at now in home 24h', async () => {
    await renderScenario('home');
    expect(readout()).toBe('adesso · 08:30');
    expect(valueTexts('soggiorno')).toEqual(['21,8°', 'target 21,0°', 'caloriferi standby', 'clima scalda']);
    expect(valueTexts('corridoio')).toEqual(['19,2°', 'target 20,5°', 'clima scalda']);
    expect(valueTexts('camera')).toEqual(['18,1°', 'target 18,0°', 'caloriferi standby']);
    expect(valueTexts('cameretta')).toEqual(['19,8°', 'target 19,0°', 'caloriferi standby']);
    expect(valueTexts('bagno')).toEqual(['20,4°', 'target 23,0°', 'caloriferi scalda']);
    expect(valueTexts('ripostiglio')).toEqual(['—', 'nessun sensore']);
    expect(screen.getByTestId('tutte-outdoor-cursor').textContent).toBe('5,9° · 83%');

    const soggiorno = screen.getByTestId('tutte-row-soggiorno');
    expect(within(soggiorno).getByText('Soggiorno')).toBeInTheDocument();
    expect(within(soggiorno).getByText('21,8°')).toBeInTheDocument();
    expect(strips('soggiorno')).toHaveLength(2);
    expect(
      within(panel()).getByRole('img', { name: 'Soggiorno: 21,8°, target 21,0°, caloriferi standby e clima scalda' }),
    ).toBeInTheDocument();
  });

  it('renders the axis labels of both ranges', async () => {
    await renderScenario('home');
    const axisTexts = () =>
      Array.from(panel().querySelectorAll('[aria-hidden="true"].mono span')).map((s) => s.textContent);
    expect(axisTexts()).toEqual(['adesso', '12:00', '16:00', '20:00', '00:00', '04:00']);

    fireEvent.click(screen.getByRole('button', { name: catalog['clima.range.7d'] }));
    await waitFor(() => expect(axisTexts()[1]).toBe('sab 14'));
    expect(axisTexts()).toEqual(['adesso', 'sab 14', 'dom 15', 'lun 16', 'mar 17', 'mer 18', 'gio 19']);
    expect(valueTexts('soggiorno')[0]).toBe('21,5°');
  });

  it('renders the sensorless follower row with the followed zone strip', async () => {
    await renderScenario('home');
    const row = screen.getByTestId('tutte-row-ripostiglio');
    expect(within(row).getByText('Ripostiglio')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('caloriferi scalda (con Bagno)')).toBeInTheDocument();
    // No pulse on a sensorless row.
    expect(row.querySelector('.m-pulse')).toBeNull();

    const chart = screen.getByTestId('tutte-chart-ripostiglio');
    expect(within(chart).queryByRole('img')).toBeNull();
    expect(within(chart).getByText('Nessun sensore di temperatura · segue Bagno')).toBeInTheDocument();
    expect(strips('ripostiglio')).toHaveLength(1);
    // Same strip as the bagno zone.
    expect(strips('ripostiglio')[0]!.innerHTML).toBe(strips('bagno')[0]!.innerHTML);

    const link = within(row).getByRole('link', { name: 'Apri la stanza Bagno' });
    fireEvent.click(link);
    expect(await screen.findByTestId('stanza-probe')).toHaveTextContent('/clima/stanza/bagno?scenario=home');
  });

  it('links each room to its Stanza page keeping the scenario', async () => {
    await renderScenario('home');
    const links = within(panel()).getAllByRole('link');
    expect(links).toHaveLength(6);
    expect(links[0]).toHaveAttribute('href', '/clima/stanza/soggiorno?scenario=home');
    expect(links[0]).toHaveAccessibleName('Apri la stanza Soggiorno');
  });

  it('handles manyRooms: three strips in one row and an unknown kind', async () => {
    await renderScenario('manyRooms');
    expect(strips('soggiorno')).toHaveLength(3);
    const row = screen.getByTestId('tutte-row-soggiorno');
    expect(within(row).getByText(/^Deumidificatore /)).toBeInTheDocument();
    expect(valueTexts('soggiorno')).toHaveLength(5);
    expect(valueTexts('lavanderia')).toEqual(['—', 'nessun sensore']);
    expect(screen.getByTestId('tutte-chart-lavanderia')).toHaveTextContent('segue Bagno di servizio');
  });

  it('moves the shared cursor with the keyboard', async () => {
    await renderScenario('home');
    const s = slider();
    act(() => s.focus());
    expect(useClimaStore.getState().cursorIndex).toBe(48);
    expect(s).toHaveAttribute('aria-valuenow', '48');
    expect(s).toHaveAttribute('aria-valuetext', 'adesso · 08:30');
    expect(screen.getByTestId('tutte-cursor-line')).toHaveStyle({ left: '93.27%' });

    fireEvent.keyDown(s, { key: 'ArrowLeft' });
    expect(readout()).toBe('ore 08:00');
    expect(s).toHaveAttribute('aria-valuenow', '47');

    fireEvent.keyDown(s, { key: 'ArrowRight' });
    fireEvent.keyDown(s, { key: 'ArrowRight' });
    expect(readout()).toBe('previsione · 09:00');
    // The right column follows the cursor (the soggiorno split is off after 08:45).
    expect(valueTexts('soggiorno')[3]).toBe('clima spento');

    fireEvent.keyDown(s, { key: 'Home' });
    expect(readout()).toBe('ore 08:30');
    expect(useClimaStore.getState().cursorIndex).toBe(0);

    fireEvent.keyDown(s, { key: 'End' });
    expect(useClimaStore.getState().cursorIndex).toBe(51);

    fireEvent.keyDown(s, { key: 'Escape' });
    expect(useClimaStore.getState().cursorIndex).toBeNull();
    expect(readout()).toBe('adesso · 08:30');
    expect(screen.queryByTestId('tutte-cursor-line')).toBeNull();
  });

  it('shows past days in the 7d readout', async () => {
    useClimaStore.getState().setRange('7d');
    await renderScenario('home');
    const s = slider();
    act(() => s.focus());
    fireEvent.keyDown(s, { key: 'PageUp' });
    expect(readout()).toBe('gio 19 · 08:30');
  });

  it('updates the hidden table with the cursor', async () => {
    await renderScenario('home');
    const table = screen.getByRole('table');
    expect(within(table).getByText(catalog['clima.tutte.table.caption'])).toBeInTheDocument();
    const soggiorno = within(table).getByRole('row', { name: /Soggiorno/ });
    expect(soggiorno).toHaveTextContent('21,8');
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 6 + 1);
  });

  it('sets the outdoor reading of the header', async () => {
    await renderScenario('home');
    expect(useClimaStore.getState().outdoorNow?.temperatureC).toBeCloseTo(5.9, 1);
  });

  it('shows the error view with a retry', async () => {
    const ds = new MockDataSource('home');
    let fail = true;
    const failing: DataSource = {
      kind: ds.kind,
      scenario: ds.scenario,
      timeZone: ds.timeZone,
      now: () => ds.now(),
      getRooms: (signal) => ds.getRooms(signal),
      getRoomTimeline: (q, signal) => ds.getRoomTimeline(q, signal),
      getOverview: (q, signal) =>
        fail ? Promise.reject(new DataSourceError('network', 'down')) : ds.getOverview(q, signal),
      createOverride: (body) => ds.createOverride(body),
      deleteOverride: (id) => ds.deleteOverride(id),
      subscribe: (listener) => ds.subscribe(listener),
    };
    renderTutte(failing);
    expect(await screen.findByRole('alert')).toHaveTextContent(catalog['error.network']);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: catalog['error.retry'] }));
    expect(await screen.findByTestId('tutte-readout')).toHaveTextContent('adesso · 08:30');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
