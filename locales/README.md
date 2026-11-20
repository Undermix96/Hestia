# Hestia translations

This folder holds the built-in languages of Hestia: `it.json` (Italian, the
default) and `en.json` (English).

> Status: **M0**. The files only contain the `meta` object; the messages will be
> added starting from milestone M1, and runtime loading of extra languages
> arrives in M3 (see [`docs/implementation-plan.md`](../docs/implementation-plan.md) §9).

## File format

Each language is a **flat JSON object** whose keys are message ids and whose
values are [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
strings (rendered with `intl-messageformat`). A reserved `meta` object
describes the language:

```json
{
  "meta": {
    "name": "Italiano",
    "fallback": "en"
  },
  "clima.room.title": "Stanza",
  "clima.summary.heatingOn": "{count, plural, one {# calorifero acceso} other {# caloriferi accesi}}"
}
```

| Field | Meaning |
|---|---|
| `meta.name` | Name of the language, written in the language itself. |
| `meta.fallback` | Language used for missing keys (optional; `en` is always the last resort). |

Rules:

- Keys are flat strings with dot-separated namespaces (no nested objects except `meta`).
- Grammar (plural, select, lists) belongs in the messages, not in the code.
- Do not format numbers or dates in messages by hand: the UI uses
  `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- Adapter messages live in the `adapter.<id>.*` namespace; configuration
  schemas reference them through `x-i18n`.

A `locale.schema.json` describing this format will be added together with the
first real messages.

## Lookup order

When looking up a message, Hestia tries, in order:

1. `/data/locales/<lang>.json` (languages added by the user, no rebuild needed);
2. the built-in languages in this folder;
3. adapter translation fragments;
4. the fallback language declared in `meta.fallback`;
5. `en`.

## Adding a language

1. Copy `en.json` to `<lang>.json` (for example `de.json`) and translate every value,
   keeping the keys and the ICU placeholders (`{count}`, `{name}`, ...) unchanged.
2. Set `meta.name` and, if useful, `meta.fallback`.
3. To try it without rebuilding, put the file in the `locales/` folder of the
   `hestia-data` volume (`/data/locales/` inside the backend container).
4. To ship it with Hestia, open a pull request adding the file here
   (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
