import { describe, expect, it } from 'vitest';
import {
  actionDotColor,
  actionFill,
  actionTextColor,
  IDLE_PATTERN,
  isActive,
  mix,
  PALETTE,
  radiatorColor,
} from '../../src/modules/clima/logic/colors';

describe('mix', () => {
  it('blends and clamps like the mockup', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('rgb(128,128,128)');
    expect(mix('#000000', '#FFFFFF', -1)).toBe('rgb(0,0,0)');
    expect(mix('#000000', '#FFFFFF', 2)).toBe('rgb(255,255,255)');
    expect(mix('#3A5A8C', '#C2622E', 0)).toBe('rgb(58,90,140)');
  });
});

describe('radiatorColor (radLo → radHi between 17 and 23 °C)', () => {
  it.each([
    [17, 'rgb(58,90,140)'],
    [18.5, 'rgb(92,92,117)'],
    [21, 'rgb(149,95,77)'],
    [23, 'rgb(194,98,46)'],
    [10, 'rgb(58,90,140)'],
    [30, 'rgb(194,98,46)'],
  ])('%s °C', (t, expected) => {
    expect(radiatorColor(t)).toBe(expected);
  });
});

describe('action colours', () => {
  it('fills', () => {
    expect(actionFill('heat')).toBe(PALETTE.heat);
    expect(actionFill('cool')).toBe(PALETTE.cool);
    expect(actionFill('dry')).toBe(PALETTE.dry);
    expect(actionFill('idle')).toBe(IDLE_PATTERN);
    expect(actionFill('off')).toBe('transparent');
    expect(actionFill(null)).toBe('transparent');
  });

  it('text and dots', () => {
    expect(actionTextColor('heat')).toBe(PALETTE.heat);
    expect(actionTextColor('cool')).toBe(PALETTE.cool);
    expect(actionTextColor('dry')).toBe(PALETTE.dry);
    expect(actionTextColor('idle')).toBe(PALETTE.muted);
    expect(actionTextColor(null)).toBe(PALETTE.muted);
    expect(actionDotColor('heat')).toBe(PALETTE.heat);
    expect(actionDotColor('cool')).toBe(PALETTE.cool);
    expect(actionDotColor('dry')).toBe(PALETTE.dry);
    expect(actionDotColor('off')).toBe(PALETTE.dotIdle);
    expect(actionDotColor(null)).toBe(PALETTE.dotIdle);
  });

  it('active actions pulse', () => {
    expect(['heat', 'cool', 'dry', 'idle', 'off', null].map((a) => isActive(a as never))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
