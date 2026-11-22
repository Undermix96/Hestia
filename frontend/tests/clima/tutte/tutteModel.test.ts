import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../../src/api/datasource';
import { cursorWhen } from '../../../src/modules/clima/components/chartTexts';
import { linkRoomId, outdoorText, roomNames, rowChartLabel } from '../../../src/modules/clima/screens/Tutte/tutteModel';
import { sampleAt } from '../../../src/modules/clima/thermogram/samples';

describe('tutteModel', () => {
  it('formats the cursor readout per phase and range', async () => {
    const ds = new MockDataSource('home');
    const day = await ds.getOverview({ range: '24h' });
    const tz = day.clock.timeZone;
    expect(cursorWhen(day.grid, 48, tz)).toBe('adesso · 08:30');
    expect(cursorWhen(day.grid, 47, tz)).toBe('ore 08:00');
    expect(cursorWhen(day.grid, 51, tz)).toBe('previsione · 10:00');

    const week = await ds.getOverview({ range: '7d' });
    expect(cursorWhen(week.grid, week.grid.nowIndex - 48, tz)).toBe('gio 19 · 08:30');
    expect(cursorWhen(week.grid, week.grid.nowIndex + 1, tz)).toBe('previsione · 09:00');
  });

  it('links sensorless rooms to the room they follow', async () => {
    const overview = await new MockDataSource('manyRooms').getOverview({ range: '24h' });
    const byId = new Map(overview.rows.map((r) => [r.room.id, r]));
    expect(linkRoomId(byId.get('soggiorno')!)).toBe('soggiorno');
    expect(linkRoomId(byId.get('ripostiglio')!)).toBe('bagno');
    expect(linkRoomId(byId.get('lavanderia')!)).toBe('bagno2');
  });

  it('labels a row chart with the values now', async () => {
    const overview = await new MockDataSource('home').getOverview({ range: '24h' });
    const names = roomNames(overview.rows.map((r) => r.room));
    const bagno = overview.rows.find((r) => r.room.id === 'bagno')!;
    expect(rowChartLabel(bagno, overview.grid.nowIndex, names)).toBe('Bagno: 20,4°, target 23,0°, caloriferi scalda');
  });

  it('reads measured before forecast and formats missing values', () => {
    expect(sampleAt([1, null], [null, 2], 0)).toBe(1);
    expect(sampleAt([1, null], [null, 2], 1)).toBe(2);
    expect(sampleAt([null], [null], 0)).toBeNull();
    expect(outdoorText(5.93, 83.3)).toBe('5,9° · 83%');
    expect(outdoorText(null, null)).toBe('—° · —%');
  });
});
