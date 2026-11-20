/**
 * Minimal message lookup for M0.
 *
 * Every user-visible string lives in a locale file (Italian is the default).
 * M1 replaces this with full ICU message formatting and server-provided
 * locales; the `t(key, params)` call shape is meant to stay the same.
 */
import it from './it.json';

export type MessageKey = keyof typeof it;
export type MessageParams = Record<string, string | number>;

const messages: Record<MessageKey, string> = it;

export const locale = 'it';

export function t(key: MessageKey, params?: MessageParams): string {
  const template = messages[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
