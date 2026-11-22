# Hestia translations

This folder holds the built-in languages of Hestia: `it.json` (Italian, the
default) and `en.json` (English).

> Status: **M1 complete**. `it.json` is the single catalog of the UI: every
> user-visible text, including the names of the mock rooms and systems
> (`mock.*`), is a message there. `en.json` only has its `meta` object for now.
> The frontend bundles `it.json` at build time (`frontend/src/i18n/index.ts`), and
> a unit test (`frontend/tests/clima/catalog.test.ts`) fails on a key the code uses
> but the file lacks, and on a key nothing uses. The English translation, a
> `locale.schema.json` and runtime loading of extra languages (the lookup order
> below) arrive in M3 (see [`docs/implementation-plan.md`](../docs/implementation-plan.md) §5 and §9).

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
  "module.clima.stanza": "Stanza",
  "clima.tutte.openRoomLabel": "Apri la stanza {room}"
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

## Lookup order

Planned for M3: when looking up a message, Hestia will try, in order:

1. `/data/locales/<lang>.json` (languages added by the user, no rebuild needed);
2. the built-in languages in this folder;
3. adapter translation fragments;
4. the fallback language declared in `meta.fallback`;
5. `en`.

## Adding a language

1. Copy `it.json` (the complete catalog until `en.json` is filled in M3) to
   `<lang>.json` (for example `de.json`) and translate every value,
   keeping the keys and the ICU placeholders (`{count}`, `{name}`, ...) unchanged.
2. Set `meta.name` and, if useful, `meta.fallback`.
3. From M3, to try it without rebuilding, put the file in the `locales/` folder of the
   `hestia-data` volume (`/data/locales/` inside the backend container).
4. To ship it with Hestia, open a pull request adding the file here
   (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
