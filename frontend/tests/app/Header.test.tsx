import { act, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import catalog from '../../../locales/it.json';
import { DataSourceProvider } from '../../src/api/datasource/context';
import { appRoutes } from '../../src/app/router';
import { resetClimaStore, useClimaStore } from '../../src/modules/clima/store/climaStore';
import { fakeDataSource } from './fakeDataSource';

function renderApp(path: string) {
  const router = createMemoryRouter(appRoutes(), { initialEntries: [path] });
  render(
    <DataSourceProvider value={fakeDataSource()}>
      <RouterProvider router={router} />
    </DataSourceProvider>,
  );
  return router;
}

// The screens themselves (D/E) are not under test here: only the shell around them.
const nav = () => screen.getByRole('navigation', { name: catalog['nav.label'] });

describe('Header', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('shows Hestia and the Clima group with two links', async () => {
    renderApp('/clima/tutte');
    await screen.findByRole('banner');

    expect(within(nav()).getByText(catalog['app.name'])).toBeInTheDocument();
    const group = within(nav()).getByRole('group', { name: catalog['module.clima.name'] });
    const links = within(group).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      catalog['module.clima.stanza'],
      catalog['module.clima.tutte'],
    ]);
    expect(within(nav()).getAllByRole('link')).toHaveLength(2);
  });

  it('does not render the hidden modules', async () => {
    renderApp('/clima/tutte');
    await screen.findByRole('banner');
    expect(within(nav()).queryByText(catalog['module.energia.name'])).toBeNull();
    expect(within(nav()).queryByText(catalog['module.luci.name'])).toBeNull();
  });

  it('marks the active link from the route', async () => {
    renderApp('/clima/tutte');
    await screen.findByRole('banner');
    expect(screen.getByRole('link', { name: catalog['module.clima.tutte'] })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: catalog['module.clima.stanza'] })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('Stanza is active for any room and links to the last room shown', async () => {
    renderApp('/clima/stanza/camera?scenario=perSlot');
    const stanza = await screen.findByRole('link', { name: catalog['module.clima.stanza'] });
    expect(stanza).toHaveAttribute('aria-current', 'page');
    expect(stanza).toHaveAttribute('href', '/clima/stanza?scenario=perSlot');

    act(() => useClimaStore.getState().setLastRoom('camera'));
    expect(stanza).toHaveAttribute('href', '/clima/stanza/camera?scenario=perSlot');
    expect(screen.getByRole('link', { name: catalog['module.clima.tutte'] })).toHaveAttribute(
      'href',
      '/clima/tutte?scenario=perSlot',
    );
  });

  it('shows the data source clock and the outdoor status once known', async () => {
    renderApp('/clima/tutte');
    await screen.findByRole('banner');
    const header = screen.getByRole('banner');
    expect(header).toHaveTextContent('ven 20 nov · 08:30');
    expect(screen.queryByTestId('clima-header-status')).toBeNull();

    act(() => useClimaStore.getState().setOutdoorNow({ temperatureC: 5.94, humidityPct: 82.6 }));
    expect(screen.getByTestId('clima-header-status')).toHaveTextContent('fuori 5,9° · 83%');
  });

  it('has a skip link to the main landmark', async () => {
    renderApp('/clima/tutte');
    await screen.findByRole('banner');
    expect(screen.getByRole('link', { name: catalog['app.skipToContent'] })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('routes', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('/ redirects to the first room with a sensor, keeping ?scenario', async () => {
    const router = renderApp('/?scenario=perSlot&other=1');
    await waitFor(() => expect(router.state.location.pathname).toBe('/clima/stanza/soggiorno'));
    expect(router.state.location.search).toBe('?scenario=perSlot');
  });

  it('/clima/stanza opens the last room shown', async () => {
    useClimaStore.getState().setLastRoom('camera');
    const router = renderApp('/clima/stanza?source=mock');
    await waitFor(() => expect(router.state.location.pathname).toBe('/clima/stanza/camera'));
    expect(router.state.location.search).toBe('?source=mock');
  });

  it('unknown paths show the not-found page with a link back', async () => {
    renderApp('/nowhere?scenario=readonly');
    expect(await screen.findByRole('heading', { name: catalog['notFound.title'] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: catalog['notFound.back'] })).toHaveAttribute(
      'href',
      '/clima?scenario=readonly',
    );
  });
});
