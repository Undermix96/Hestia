/**
 * Message lookup with ICU MessageFormat (intl-messageformat).
 *
 * The single source of truth for the messages is `locales/it.json` at the
 * repository root (flat keys plus a reserved `meta` object). Italian is the
 * only language with content in M1; runtime loading of other languages comes
 * later (see docs/implementation-plan.md §9).
 */
import { IntlMessageFormat } from 'intl-messageformat';
import catalog from '../../../locales/it.json';

export type Catalog = typeof catalog;
export type MessageKey = Exclude<keyof Catalog, 'meta'>;
export type MessageValues = Record<string, string | number | boolean | null | undefined>;

/** Language of the messages (BCP 47 tag used for `<html lang>`). */
export const locale = 'it';
/** Locale passed to `Intl.*` and to intl-messageformat. */
export const intlLocale = 'it-IT';

const messages: Readonly<Record<string, unknown>> = catalog;
const compiled = new Map<string, IntlMessageFormat>();

/** In development and tests a broken message is a bug and must surface. */
const strict = import.meta.env.DEV || import.meta.env.MODE === 'test';

function messageOf(key: string): string | undefined {
  if (key === 'meta' || !Object.hasOwn(messages, key)) return undefined;
  const message = messages[key];
  return typeof message === 'string' ? message : undefined;
}

function compile(key: string, message: string): IntlMessageFormat {
  let formatter = compiled.get(key);
  if (!formatter) {
    formatter = new IntlMessageFormat(message, intlLocale);
    compiled.set(key, formatter);
  }
  return formatter;
}

/** Booleans become `'true'`/`'false'` (for ICU `select`); null/undefined are left out. */
function normalise(values: MessageValues | undefined): Record<string, string | number> | undefined {
  if (!values) return undefined;
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    out[name] = typeof value === 'boolean' ? String(value) : value;
  }
  return out;
}

function failure(key: string, error: unknown): string {
  if (strict) throw error instanceof Error ? error : new Error(String(error));
  console.error(`i18n: cannot format message "${key}"`, error);
  return key;
}

function format(key: string, values: MessageValues | undefined): string {
  const message = messageOf(key);
  if (message === undefined) return failure(key, new Error(`i18n: missing message "${key}"`));
  try {
    const result = compile(key, message).format<string>(normalise(values));
    return Array.isArray(result) ? result.join('') : String(result);
  } catch (error) {
    return failure(key, error);
  }
}

/** Formats the message `key` with ICU `values`. */
export function t(key: MessageKey, values?: MessageValues): string {
  return format(key, values);
}

/** Per-kind/dynamic keys: tries `key`, then `fallback`. */
export function tDynamic(key: string, fallback: MessageKey, values?: MessageValues): string {
  return format(hasMessage(key) ? key : fallback, values);
}

/** True when the catalog has a message for `key` (`meta` is not a message). */
export function hasMessage(key: string): boolean {
  return messageOf(key) !== undefined;
}
