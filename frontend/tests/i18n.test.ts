import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';

describe('t()', () => {
  it('returns the message for a key', () => {
    expect(t('app.title')).toBe('Hestia');
  });

  it('interpolates named parameters', () => {
    expect(t('status.ok', { version: '0.1.0' })).toContain('0.1.0');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('status.ok', {})).toContain('{version}');
  });
});
