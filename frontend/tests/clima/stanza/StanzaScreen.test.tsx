// The Stanza screen on every mock scenario: tabs, summary, lanes, legends, power card, week program, redirects.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockDataSource } from '../../../src/api/datasource';
import { DataSourceError, type DataSource } from '../../../src/api/datasource/types';
import { resetClimaStore, useClimaStore } from '../../../src/modules/clima/store/climaStore';
import { catalog, renderRoom, renderStanza, segmentButtons, thermogram } from './renderStanza';

const tabs = () => screen.getByRole('group', { name: catalog['clima.rooms.label'] });
const power = () => screen.getByRole('region', { name: catalog['clima.power.label'] });
const week = () => screen.getByRole('region', { name: catalog['clima.week.label'] });
const summary = () => screen.getByRole('region', { name: catalog['clima.stanza.summaryLabel'] });
const laneLabels = () => Array.from(thermogram().querySelectorAll('[class*="laneName"]')).map((el) => el.textContent);

describe('StanzaScreen', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  describe('home', () => {
    it('renders the tabs, the summary and the thermogram of soggiorno', async () => {
      await renderRoom('home');

      const links = within(tabs()).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual([
        'Soggiorno21,8°caloriferi standbyclima scalda',
        'Corridoio19,2°clima scalda',
        'Camera18,1°caloriferi standby',
        'Cameretta19,8°caloriferi standby',
        'Bagno20,4°caloriferi scalda',
      ]);
      expect(links[0]).toHaveAttribute('aria-current', 'page');
      expect(links[0]!.getAttribute('href')).toBe('/clima/stanza/soggiorno?scenario=home');
      // the sensorless room is a dashed card, not a link nor focusable
      const ripostiglio = within(tabs()).getByText('Ripostiglio');
      expect(ripostiglio.closest('a')).toBeNull();
      expect(ripostiglio).toHaveTextContent('nessun sensore · segue Bagno');

      expect(summary()).toHaveTextContent(
        'Soggiorno è a 21,8°. I caloriferi sono fermi: la stanza è sopra il target di 21,0°. Il climatizzatore scalda verso 21,5°. Alle 08:45 il climatizzatore si spegne.',
      );
      expect(summary()).toHaveTextContent('Umidità 47% · fuori 5,9° e 83%.');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stanza · Soggiorno');

      expect(laneLabels()).toEqual(['Caloriferi', 'Climatizzatore']);
      const chart = within(thermogram()).getByRole('img');
      expect(chart.getAttribute('aria-label')).toBe(
        `Termogramma di Soggiorno, ultime 24 ore e previsione di 2 ore. ${summary().querySelector('p')!.textContent}`,
      );
      expect(within(thermogram()).getByText(catalog['clima.thermogram.hint'])).toBeInTheDocument();
      for (const key of [
        'clima.legend.measured',
        'clima.legend.forecast',
        'clima.legend.target',
        'clima.legend.comfort',
        'clima.legend.humidity',
        'clima.legend.outdoor',
        'clima.legend.heat',
        'clima.legend.cool',
        'clima.legend.idle',
        'clima.legend.off',
      ] as const) {
        expect(within(thermogram()).getAllByText(catalog[key]).length).toBeGreaterThan(0);
      }
      // no dry sample in home: no dry legend entry
      expect(within(thermogram()).queryByText(catalog['clima.legend.dry'])).toBeNull();
      const axis = Array.from(thermogram().querySelectorAll('[data-edge]')).map((el) => el.textContent);
      expect(axis).toEqual(['adesso', '12:00', '16:00', '20:00', '00:00', '04:00']);
    });

    it('renders the hidden data table with one row per sample', async () => {
      await renderRoom('home');
      const table = within(thermogram()).getByRole('table');
      expect(within(table).getByText(/^Valori di Soggiorno/)).toBeInTheDocument();
      expect(within(table).getAllByRole('row')).toHaveLength(53);
      expect(within(table).getByRole('columnheader', { name: 'Azione · Climatizzatore' })).toBeInTheDocument();
      expect(within(table).getByRole('rowheader', { name: '09:30 (previsione)' })).toBeInTheDocument();
    });

    it('shows the house power and the split mode as plain text', async () => {
      await renderRoom('home');
      expect(within(power()).getByRole('heading', { level: 2 })).toHaveTextContent('Corrente climatizzatori');
      expect(power()).toHaveTextContent('1,3 kW');
      expect(power()).toHaveTextContent('8,8 kWh');
      expect(power()).toHaveTextContent('≈ € 2,5');
      expect(power()).toHaveTextContent('Novembre: 79 kWh · € 22,10 · i caloriferi non sono misurati');
      expect(power()).toHaveTextContent('Modalità climatizzatore · Soggiorno');
      expect(within(power()).getByText('Caldo')).toBeInTheDocument();
      expect(within(power()).queryAllByRole('button')).toHaveLength(0);
    });

    it('shows the week program with today in bold', async () => {
      await renderRoom('home');
      expect(within(week()).getByRole('heading', { level: 2 })).toHaveTextContent(
        'Programma della settimana · Soggiorno',
      );
      expect(week()).toHaveTextContent('caloriferi + climatizzatore');
      const rows = within(week()).getAllByRole('listitem');
      expect(rows.map((r) => r.firstElementChild!.textContent)).toEqual([
        'Lun',
        'Mar',
        'Mer',
        'Gio',
        'Ven',
        'Sab',
        'Dom',
      ]);
      expect(rows[4]).toHaveAttribute('aria-current', 'date');
      expect(rows[4]!.firstElementChild!.className).toMatch(/weekToday/);
      // radiator values on slots of at least 3 h: 00-06 (18,5) and 06-23 (21,0)
      expect(rows[0]).toHaveTextContent('18,521,0');
      expect(week()).toHaveTextContent('0006121824');
    });

    it('describes shared zones and single systems in the week sources', async () => {
      await renderRoom('home', 'bagno');
      expect(week()).toHaveTextContent('caloriferi, insieme a Ripostiglio');
    });

    it('redirects a room without sensor to the room it follows, keeping the scenario', async () => {
      renderStanza('/clima/stanza/ripostiglio?scenario=home', new MockDataSource('home'));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/clima/stanza/bagno?scenario=home'),
      );
      await screen.findByText(/^Bagno è a/);
      expect(useClimaStore.getState().lastRoomId).toBe('bagno');
    });

    it('redirects an unknown room to the Stanza index', async () => {
      renderStanza('/clima/stanza/attico?scenario=home', new MockDataSource('home'));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/clima/stanza/soggiorno?scenario=home'),
      );
    });

    it('records the room and the outdoor conditions in the store', async () => {
      await renderRoom('home', 'camera');
      const state = useClimaStore.getState();
      expect(state.lastRoomId).toBe('camera');
      expect(state.outdoorNow?.temperatureC).toBeCloseTo(5.9, 1);
    });

    it('shows a busy skeleton while loading and an error view on failure', async () => {
      const failing: DataSource = {
        kind: 'mock',
        scenario: 'home',
        timeZone: 'Europe/Rome',
        now: () => new Date('2026-11-20T08:30:00+01:00'),
        getRooms: () => Promise.resolve([]),
        getOverview: () => Promise.reject(new DataSourceError('network', 'down')),
        getRoomTimeline: () => Promise.reject(new DataSourceError('network', 'down')),
        createOverride: () => Promise.reject(new DataSourceError('network', 'down')),
        deleteOverride: () => Promise.reject(new DataSourceError('network', 'down')),
        subscribe: () => () => {},
      };
      const { view } = renderStanza('/clima/stanza/soggiorno', failing);
      expect(view.container.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(await screen.findByRole('alert')).toHaveTextContent(catalog['error.network']);
      expect(screen.getByRole('button', { name: catalog['error.retry'] })).toBeInTheDocument();
    });
  });

  it('readonly: no editable segment and the read-only hint', async () => {
    await renderRoom('readonly');
    expect(segmentButtons()).toHaveLength(0);
    expect(within(thermogram()).getByText(catalog['clima.thermogram.hintReadonly'])).toBeInTheDocument();
    expect(within(thermogram()).queryByText(catalog['clima.thermogram.hint'])).toBeNull();
  });

  it('noProgram: lanes without program, no hint, mode as text', async () => {
    await renderRoom('noProgram');
    expect(within(thermogram()).getAllByText(catalog['clima.lane.noProgram'])).toHaveLength(2);
    expect(segmentButtons()).toHaveLength(0);
    expect(within(thermogram()).queryByText(catalog['clima.thermogram.hint'])).toBeNull();
    expect(within(thermogram()).queryByText(catalog['clima.thermogram.hintReadonly'])).toBeNull();
    expect(within(power()).getByText('Spento')).toBeInTheDocument();
    expect(week()).toHaveTextContent('Caloriferi: nessun programma');
    expect(week()).toHaveTextContent('Climatizzatore: nessun programma');
    expect(within(week()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('perSlot: current radiator slot is editable', async () => {
    await renderRoom('perSlot');
    expect(segmentButtons().length).toBeGreaterThan(0);
    expect(segmentButtons().every((b) => b.dataset['state'] !== 'past')).toBe(true);
  });

  it('manyRooms: 10 wrapping tabs, three lanes with the generic dehumidifier', async () => {
    await renderRoom('manyRooms');
    expect(within(tabs()).getAllByRole('link')).toHaveLength(8);
    expect(tabs().children).toHaveLength(10);
    expect(within(tabs()).getByText('Lavanderia')).toHaveTextContent('nessun sensore · segue Bagno di servizio');
    expect(laneLabels()).toEqual(['Caloriferi', 'Climatizzatore', 'Deumidificatore']);
    expect(summary()).toHaveTextContent('Deumidificatore: nessuna fascia attiva adesso.');
    expect(power()).toHaveTextContent('i caloriferi non sono misurati · Deumidificatore: non misurato');
    // the dehumidifier dries in the past: the dry legend entry appears
    expect(within(thermogram()).getByText(catalog['clima.legend.dry'])).toBeInTheDocument();
  });

  it('switches to 7 days from the range selector', async () => {
    await renderRoom('home');
    const sevenDays = within(thermogram()).getByRole('button', { name: catalog['clima.range.7d'] });
    fireEvent.click(sevenDays);
    await waitFor(() => expect(within(tabs()).getAllByRole('link')[0]).toHaveTextContent('Soggiorno21,5°'));
    expect(sevenDays).toHaveAttribute('aria-pressed', 'true');
    const axis = Array.from(thermogram().querySelectorAll('[data-edge]')).map((el) => el.textContent);
    expect(axis).toEqual(['adesso', 'sab 14', 'dom 15', 'lun 16', 'mar 17', 'mer 18', 'gio 19']);
  });
});
