// Thermogram interaction: keyboard cursor and tooltip, pointer cursor, Esc; lanes (ProgramBar, ActionBar).
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDataSource } from '../../../src/api/datasource';
import type { RoomTimeline, SystemLane } from '../../../src/api/types';
import { ActionBar } from '../../../src/modules/clima/lanes/ActionBar';
import { ProgramBar } from '../../../src/modules/clima/lanes/ProgramBar';
import { resetClimaStore, useClimaStore } from '../../../src/modules/clima/store/climaStore';
import { catalog, editor, renderRoom, segmentButton, slider, thermogram, tooltip } from './renderStanza';

const tooltipText = () => tooltip()!.textContent;

describe('thermogram cursor', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('starts at now on focus and moves with the arrow keys', async () => {
    await renderRoom('home');
    expect(tooltip()).toBeNull();
    fireEvent.focus(slider());
    expect(slider()).toHaveAttribute('aria-valuenow', '48');
    expect(slider()).toHaveAttribute('aria-valuemax', '51');
    expect(tooltipText()).toContain('adesso · 08:30');

    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(slider()).toHaveAttribute('aria-valuenow', '50');
    expect(slider()).toHaveAttribute('aria-valuetext', 'previsione · 09:30: stanza 21,3°');
    const text = tooltipText();
    for (const part of [
      'previsione · 09:30',
      '21,3° · 49%',
      'target 21,0°',
      'non programmato',
      'spento',
      '7,1° · 81%',
    ]) {
      expect(text).toContain(part);
    }

    fireEvent.keyDown(slider(), { key: 'ArrowLeft', shiftKey: true });
    expect(slider()).toHaveAttribute('aria-valuenow', '48');
    fireEvent.keyDown(slider(), { key: 'PageUp' });
    expect(slider()).toHaveAttribute('aria-valuenow', '40');
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(slider()).toHaveAttribute('aria-valuenow', '0');
    expect(tooltipText()).toContain('ore 08:30');
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider()).toHaveAttribute('aria-valuenow', '51');

    fireEvent.keyDown(slider(), { key: 'Escape' });
    expect(tooltip()).toBeNull();
    expect(useClimaStore.getState().cursorIndex).toBeNull();
  });

  it('flips the tooltip to the left of the cursor past 60% of the width', async () => {
    await renderRoom('home');
    fireEvent.focus(slider());
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(tooltip()).toHaveAttribute('data-side', 'right');
    expect(tooltip()!.style.transform).toBe('translateX(14px)');
    for (let i = 0; i < 31; i += 1) fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    // (31 + 0.5) / 52 = 0.606 > 0.6
    expect(tooltip()).toHaveAttribute('data-side', 'left');
    expect(tooltip()!.style.transform).toBe('translateX(calc(-100% - 14px))');
  });

  it('shows the day of past samples in 7 days', async () => {
    useClimaStore.getState().setRange('7d');
    await renderRoom('home');
    fireEvent.focus(slider());
    fireEvent.keyDown(slider(), { key: 'Home' });
    expect(tooltipText()).toContain('ven 13 · 08:30');
  });

  it('follows the pointer over the chart and hides on leave', async () => {
    await renderRoom('home');
    const plot = slider().parentElement!;
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 520,
      height: 500,
      right: 520,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(plot, { clientX: 505 });
    expect(useClimaStore.getState().cursorIndex).toBe(50);
    expect(tooltipText()).toContain('previsione · 09:30');
    fireEvent.pointerLeave(plot);
    expect(tooltip()).toBeNull();
  });

  it('Esc on the slider closes an open editor first', async () => {
    await renderRoom('home');
    fireEvent.click(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    expect(editor()).not.toBeNull();
    fireEvent.focus(slider());
    fireEvent.keyDown(slider(), { key: 'Escape' });
    expect(useClimaStore.getState().selection).toBeNull();
    expect(useClimaStore.getState().cursorIndex).toBe(48);
  });

  it('lets Tab reach tabs, range buttons, editable segments and the slider', async () => {
    await renderRoom('home');
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
    );
    expect(focusable.some((el) => el.textContent?.startsWith('Soggiorno'))).toBe(true);
    expect(within(thermogram()).getByRole('button', { name: catalog['clima.range.24h'] })).toBeInTheDocument();
    expect(focusable).toContain(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    expect(focusable).toContain(slider());
  });
});

describe('lanes', () => {
  let tl: RoomTimeline;
  const lane = (id: string): SystemLane => tl.lanes.find((l) => l.systemId === id)!;
  const caps = (id: string) => tl.systems.find((s) => s.id === id)!.capabilities;

  beforeEach(async () => {
    tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
  });

  it('ProgramBar: buttons for editable segments only, labels when wide enough', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ProgramBar
        lane={lane('z-soggiorno')}
        capabilities={caps('z-soggiorno')}
        count={52}
        range="24h"
        selectedKey={null}
        editorId="editor"
        onSelect={onSelect}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Caloriferi, fascia 06:00–23:00, 21,0°: modifica');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(buttons[0]).not.toHaveAttribute('aria-controls');
    // 4 segments: three past ones are hidden spans; labels only where width > 6%
    const segments = Array.from(container.querySelectorAll('[class*="segment"]'));
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.textContent)).toEqual(['21,0°', '', '18,5°', '21,0°']);
    expect(segments[0]).toHaveAttribute('aria-hidden', 'true');
    expect((segments[0] as HTMLElement).style.left).toBe('0%');
    expect((segments[0] as HTMLElement).style.width).toBe('55.769%');
    expect((segments[0] as HTMLElement).style.background).toBe('rgb(149, 95, 77)');
    fireEvent.click(buttons[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('ProgramBar: selected segment gets the ring class and aria-controls', () => {
    const seg = lane('z-soggiorno').segments.at(-1)!;
    render(
      <ProgramBar
        lane={lane('z-soggiorno')}
        capabilities={caps('z-soggiorno')}
        count={52}
        range="24h"
        selectedKey={seg.key}
        editorId="editor"
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/selected/);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'editor');
  });

  it('ProgramBar: a lane without program says so', () => {
    render(
      <ProgramBar
        lane={{ ...lane('z-soggiorno'), representation: 'none', segments: [] }}
        capabilities={caps('z-soggiorno')}
        count={52}
        range="24h"
        selectedKey={null}
        editorId="editor"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(catalog['clima.lane.noProgram'])).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ActionBar: runs split at now, forecast at half opacity', () => {
    const { container } = render(<ActionBar actions={lane('ac-soggiorno').action} nowIndex={48} />);
    const runs = Array.from(container.querySelectorAll<HTMLElement>('span'));
    expect(runs.length).toBeGreaterThan(2);
    const forecast = runs.filter((r) => r.className.includes('forecast'));
    expect(forecast.length).toBeGreaterThan(0);
    expect(forecast.every((r) => parseFloat(r.style.left) >= (48 / 52) * 100 - 1e-6)).toBe(true);
    expect(runs.every((r) => r.className.includes('m-grow'))).toBe(true);
  });
});
