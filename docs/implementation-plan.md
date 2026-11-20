# Hestia: piano di implementazione

> Stato: **bozza in revisione**, decisioni aperte chiuse (20 novembre 2026). Rispetto all'handoff: niente pulsanti di modalità nella scheda «Corrente climatizzatori». Specifica di design: [`docs/design/HANDOFF.md`](design/HANDOFF.md).

## Contesto

Hestia è una dashboard web che si collega a Home Assistant (HA) sulla LAN per mostrare informazioni sulla casa. Gira in container Docker. La prima funzione è il modulo **Clima**, con due schermate: *Stanza* e *Tutte le stanze*. Il menu è modulare, così si possono aggiungere altre funzioni.

Il progetto è **pubblico**: deve adattarsi a configurazioni di HA molto diverse e lasciare all'utente la massima libertà. La configurazione della casa dell'autore è solo la **prima serie di adattatori**, non un presupposto del nucleo dell'applicazione.

## Decisioni prese

| Tema | Decisione |
|---|---|
| Architettura | Backend nel container: tiene il token di HA, si iscrive al WebSocket di HA ed espone l'API del contratto più gli aggiornamenti dal vivo via SSE. Il frontend non vede mai il token. |
| Frontend | React + TypeScript + Vite. Animazioni in CSS, con la libreria Motion dove serve coordinarle. Tipi generati dall'OpenAPI del backend. |
| Backend | Python + FastAPI. |
| Immagini | Monorepo con **due immagini** (`hestia-backend`, `hestia-frontend`), multi-arch amd64 + arm64. |
| Deploy | `docker-compose.yml` che usa solo le immagini pubbliche su GHCR (nessuna sezione `build:`). Le build avvengono solo nella GitHub Action. |
| Accesso | Solo LAN, nessun login. |
| Configurazione | Procedura di setup nella UI, con form generati dagli schemi degli adattatori. |
| Moduli | Energia e Luci nascosti; esiste già il registro dei moduli. |
| Lingue | Italiano e inglese. Altre lingue aggiungibili da terzi senza ricompilare. |
| Test | Automatici in CI: pytest e Vitest, più Playwright. |
| Ordine dei lavori | Prima la UI su dati simulati, poi il backend reale, poi la procedura di configurazione, gli override e la previsione. |
| Licenza | MIT. |
| Lingua | Codice, commenti e documentazione per contributor in inglese; README in inglese e italiano. |
| Nomi delle immagini | `ghcr.io/undermix96/hestia-backend` e `hestia-frontend`; il vecchio pacchetto `hestia` è deprecato. |
| Override temporanei | Solo sulla **fascia in corso**. Le fasce future si possono modificare solo in modo permanente (se l'adattatore lo supporta). |
| Modalità climatizzatori | **Nessun pulsante di modalità** (Caldo/Freddo/Deumidifica/Spento) nella UI: la modalità la decide il sistema domotico. Hestia la legge e la mostra. |
| Banda target nel termogramma | Con più impianti nella stessa stanza, **i caloriferi hanno la precedenza**. |

**Casa dell'autore (adattatori v1)**
- Caloriferi: un'entità `climate.*` per zona.
- Programmi: helper `schedule.*` nativo (on = comfort, off = eco), più un `input_number` per zona e livello. Le automazioni reagiscono solo al cambio di stato dello schedule.
- Split: `climate.*` nativi, programmati con schedule più `input_number` per il set point.
- Consumi: misuratore del totale casa più prese dedicate agli split.
- Esterno: sensore fisico. Sono previste anche le fonti `weather.*` di HA e Open-Meteo.
- Storico: InfluxDB 2.x alimentato da HA.
- Override: chi modifica sceglie ogni volta tra «solo questa fascia» e «permanente». Il permanente cambia il valore del livello e/o gli orari della fascia.
- Previsione: modello termico a un nodo con coefficienti stimati dallo storico.

---

## 0. Principi

1. **Il nucleo (core) è puro.** `hestia.core` contiene:
   - dominio e modello del programma;
   - isteresi e griglia temporale;
   - previsione;
   - macchina a stati degli override.

   Non importa HA, InfluxDB né HTTP; lo verifica `import-linter` in CI. Il core dialoga con l'esterno solo tramite **interfacce** (ports), una per famiglia di adattatori:

   | Interfaccia | Compito |
   |---|---|
   | `ProgramSource` | leggere il programma e scriverne le modifiche |
   | `OverrideStrategy` | applicare le modifiche temporanee |
   | `SystemDriver` | stato, azione, modalità e target dell'impianto |
   | `HistorySource` | serie storiche |
   | `OutdoorSource` | dati e previsioni esterne |
   | `PowerSource` | consumi |
   | `RoomSensor` | misure della stanza |

2. **Ogni adattatore dichiara le proprie capacità.** Una parte è fissa, l'altra si calcola all'avvio con `resolve_capabilities()`: per esempio, uno schedule definito in YAML risulta in sola lettura. La UI legge le capacità e si adatta:
   - quali opzioni mostra l'editor;
   - come disegna il programma: a livelli, valore per fascia, on/off, nessun programma.
3. **Ogni adattatore ha uno schema di configurazione.** È un modello Pydantic `Config` esportato come JSON Schema, con queste estensioni:
   - `x-ha-entity` (`{domain, device_class?, unit?, multiple?}`), per filtrare le entità selezionabili;
   - `x-i18n`, per le etichette tradotte;
   - `x-advanced`, per i campi avanzati;
   - `x-depends-on`, per i campi che dipendono da altri.

   La procedura di setup genera i form da questo schema.
4. **Il contratto nasce nei modelli Pydantic.** Da lì si genera `contract/openapi.json` e poi i tipi TS con `openapi-typescript`. La CI fallisce se i tipi non sono allineati.
5. **Fuso orario.**
   - Il server lavora in UTC e restituisce date ISO con offset.
   - Le fasce sono in ora locale (`zoneinfo`). Il fuso viene da HA o dalla configurazione; il predefinito è Europe/Rome.
   - La griglia a 30 minuti la calcola il server. Il frontend non ricava mai l'ora dall'indice del campione, come fa invece `hAt()` del mockup.
6. **Nessun testo visibile scritto nel codice.** Anche gli adattatori portano le proprie chiavi di traduzione.
7. **Progetto pubblico:** licenza MIT; codice e documentazione per contributor in inglese, README in inglese e italiano.

## 1. Modello di dominio generico

`RadiatorZone` e `AcUnit` dell'handoff diventano un concetto unico, **System**, distinto da `kind`.

```text
Room      { id, name, sensor?: RoomSensorBinding, followsRoomId?, systemIds[], displayTargetSystemId? }
System    { id, kind: 'radiator'|'ac'|'dehumidifier'|'vmc'|string, nameKey|name, roomIds[],
            driver: AdapterRef, program: AdapterRef, override: AdapterRef, power?: AdapterRef }
AdapterRef{ type: 'ha_schedule_levels', config: {...}, configVersion: n }
Program   { representation: 'levels'|'perSlot'|'onOff'|'none', levels?: Level[],
            days: Record<Weekday, Slot[]> }
Level     { id, labelKey|label, targetC }
Slot      { from:'HH:MM', to:'HH:MM', levelId?, targetC?, on?, ref: string /* opaco, dell'adattatore */ }
Override  { id, systemId, slotRef, scope: 'slot'|'until'|'permanentValue'|'permanentTimes',
            change: { deltaC? | targetC? | levelValue? | from?/to?/days? },
            status: 'pending'|'active'|'expired'|'reverted'|'failed', validFrom, validUntil? }
Capabilities: program {read, representation, writeLevelValues, writeSlotValue, writeTimes,
              dayScope:'perDay'|'all', minuteStep, maxSlotsPerDay}
              override {scopes[], futureSlots, step, minDelta, maxDelta, expiry:'external'|'hestia'}
              driver {modes[], readsAction, readsTarget, writesMode, writesTarget}
              history {maxLookbackDays, resolutionMin, actionHistory}
              outdoor {current, history, forecastHours}
              power {kind:'measured'|'estimated'|'none', energyTotals}
```

**Come si mappano i casi dell'handoff**
- La zona bagno è un System `radiator` con `roomIds: ['bagno','ripostiglio']`.
- Il ripostiglio è una Room senza sensore che segue il bagno (`followsRoomId`).
- Il soggiorno ha due System.
- Stanze e impianti sono in numero libero.
- `displayTargetSystemId` sceglie quale target disegnare nella fascia di comfort del termogramma. Se manca, decide la priorità per `kind`: **i caloriferi (`radiator`) vengono prima di tutto il resto**.
- `entryIndex` dell'handoff diventa `slotRef`, un riferimento opaco gestito dall'adattatore.

**Comportamenti nel core** (`core/behavior.py`)

| Comportamento | Descrizione |
|---|---|
| `thermostatic(hysteresis)` | isteresi configurabile per impianto; predefinita −0,3/+0,2 |
| `always_on_target` | caloriferi sempre attivi |
| `mode_based` | caldo / freddo / deumidifica / spento |
| `unknown` | comportamento non noto |

Servono a ricostruire le azioni quando il driver non le legge e a simulare le azioni future.

## 2. Famiglie di adattatori

| Famiglia | v1 (casa dell'autore) | Ondate successive |
|---|---|---|
| ProgramSource | `ha_schedule_levels`: schedule on/off, livello per stato, `input_number` per livello | `ha_schedule_data` (target nel campo `data` del blocco), `hacs_scheduler` (scheduler-component), `thermostat_native` (Tado, Netatmo, evohome, Better Thermostat), `hestia_managed` (programma salvato e applicato da Hestia), `template`, `none` |
| OverrideStrategy | `climate_direct` (`climate.set_temperature`, scadenza `external`) | `input_number_offset`, `service_call` (script o servizio con variabili template), `disabled` |
| SystemDriver | `ha_climate` (hvac_mode, hvac_action, temperature, current_temperature; modi da `hvac_modes`) | `template` (stato e azione da template, comandi via `service_call`) |
| RoomSensor | `ha_sensor` (T e UR) | `climate_current`, `template` |
| HistorySource | `influx2` (Flux) e `ha_recorder` (history e statistics via WS; predefinito, senza configurazione) | `influx1` (InfluxQL), `none` (solo dati live con buffer SQLite locale) |
| OutdoorSource | `ha_sensor` | `ha_weather` (`weather.get_forecasts`), `open_meteo`, `composite` (fonte attuale e storica separata da quella delle previsioni) |
| PowerSource | `sensor_power` (W; kWh per integrale) | `sensor_energy` (kWh `total_increasing`), `estimate` (kW nominali per azione), `none` |

**Modalità degli split.** La UI **non ha pulsanti di modalità**: la modalità (caldo, freddo, deumidifica, spento) la decide il sistema domotico. Hestia la legge dal driver e la usa per le etichette, il riassunto e la previsione. Il driver conserva `writesMode` nelle capacità solo per eventuali usi futuri.

**Modifiche permanenti e temporanee.**
- Le modifiche permanenti le gestisce sempre il ProgramSource (valori dei livelli, valore della fascia, orari).
- L'OverrideStrategy gestisce solo quelle temporanee.
- L'editor mostra le opzioni supportate da entrambi:

  | Opzione | Compare se |
  |---|---|
  | «solo questa fascia» | `override.scopes` include `slot` e la fascia è **quella in corso** |
  | «permanente: valore» | `writeLevelValues` o `writeSlotValue` |
  | «permanente: orari» | `writeTimes` |

- Con un programma a livelli, l'editor avvisa che la modifica vale per tutte le fasce di quel livello.

**Scadenza degli override** (`override.expiry`)
- `external`: a fine fascia il target lo rimette il sistema domotico (l'automazione dell'utente).
- `hestia`: a fine fascia è Hestia a chiamare `driver.set_target(valore del programma)`.
- Il valore predefinito lo suggerisce il ProgramSource: `ha_schedule_levels` → `external`, `hestia_managed` → `hestia`.

**Adattatore template.** Copre i casi non previsti senza scrivere codice.
- **Lettura:** template Jinja valutati da HA con la subscription WS `render_template`, quindi aggiornati dal vivo.
  - Per valori singoli (T, azione, target) il template restituisce uno scalare.
  - Per il programma restituisce un JSON `{representation, days:{mon:[{from,to,targetC|levelId|on}]}}`, validato con il contratto. Se non è valido produce un avviso visibile, mai un crash.
- **Scrittura:** `service_call` con dati template che ricevono variabili come `{{ target }}`, `{{ slot.from }}`, `{{ scope }}`.
- **Capacità:** le dichiara l'utente.
- **Anteprima:** nella procedura di setup, tramite `/api/ha/render-template`.
- **Requisito:** `render_template` richiede un token admin.

## 3. Registro, plugin e test di contratto

**Registro**
- Gli adattatori si registrano con `@adapter(family="program", id="ha_schedule_levels", api_version=1)`.
- Ogni classe dichiara:
  - `Config` (Pydantic);
  - `capabilities`;
  - `i18n_namespace`;
  - `config_migrations`.
- Il registro espone `list()`, `schema(id)` e `create(ref, ctx)`.
- `ctx` fornisce i servizi condivisi: `HaConnection`, client HTTP, orologio, logger, store.

**Plugin esterni**
1. **Entry point Python**, gruppo `hestia.adapters`. È la via consigliata: un'immagine derivata `FROM ghcr.io/undermix96/hestia-backend` con `uv pip install hestia-adapter-xyz`.
2. **Cartella `/data/plugins/*.py`**, caricata solo se `HESTIA_PLUGINS_DIR` è attivo. Esegue codice arbitrario e va documentata come tale.

Gli adattatori incompatibili con la versione maggiore dell'API vengono rifiutati con un messaggio chiaro.

**Kit di test** `hestia.testing` (in futuro pubblicabile come `hestia-sdk`)
- `FakeHomeAssistant`: server WS con stati, servizi, `schedule/list` e `schedule/update`, `render_template`, eventi e riavvio simulato.
- Fixture registrate per InfluxDB.
- Classi di contratto riusabili:
  - `ProgramSourceContract`: lettura e normalizzazione; scrittura e rilettura con i blocchi intatti; capacità coerenti (se `writeTimes` è falso, la scrittura solleva `NotSupported`); ora legale; idempotenza;
  - `OverrideStrategyContract`, `SystemDriverContract`, `OutdoorSourceContract`, `PowerSourceContract`;
  - `HistorySourceContract`: griglia, buchi a `null`, limiti di lookback.
- La CI le esegue su tutti gli adattatori inclusi; i plugin esterni le riusano.

**Documentazione**
- `docs/contributing/adapters.md`: guida passo passo con un esempio.
- `docs/adapters/<id>.md`: documentazione utente di ogni adattatore.
- `docs/architecture.md`.
- `examples/home-assistant/`: blueprint dell'automazione per la strategia v1 (ignora le transizioni da `unavailable`).

## 4. Struttura del repository

```text
Hestia/
├─ frontend/
│  ├─ src/app/                 router, Header, registro moduli (Clima visibile; Energia/Luci nascosti)
│  ├─ src/modules/clima/
│  │  ├─ screens/Stanza/       RoomTabs, Summary, Thermogram, SlotEditor, PowerCard, WeekProgram
│  │  ├─ screens/Tutte/        AllRoomsPanel, RoomRow, MiniThermo, ActionStrip, OutdoorRow
│  │  ├─ systemKinds/          radiator.ts, ac.ts, generic.ts (etichette, forma puntino, colori, ordine corsie)
│  │  ├─ lanes/                ProgramBar (levels|perSlot|onOff|none), ActionBar
│  │  ├─ thermogram/           costruzione path (port di NS.js), scale, cursore, tabella a11y
│  │  ├─ logic/                summaryFacts.ts, colors.ts
│  │  └─ store/                Zustand (range, stanza, cursore, bozza editor)
│  ├─ src/setup/               procedura di setup + schemaForm/ (renderer JSON Schema, HaEntityPicker,
│  │                           TemplateEditor con anteprima, CapabilityBadge)
│  ├─ src/api/                 schema.d.ts (generato), client, sse, datasource/{http, mock/neng}
│  ├─ src/i18n/  src/styles/tokens.css  tests/  e2e/  nginx/  Dockerfile
├─ backend/hestia/
│  ├─ core/                    domain, program, capabilities, behavior, timegrid, overrides,
│  │                           forecast/{model,simulate,fitter}            (nessun I/O)
│  ├─ ports/                   Protocol/ABC per famiglia + errori (NotSupported, StaleProgram)
│  ├─ adapters/
│  │  ├─ registry.py  loader.py  migrations.py
│  │  ├─ ha/                   connection (WS condiviso), entities, template_render
│  │  ├─ program/  override/  driver/  sensor/  history/  outdoor/  power/
│  ├─ app/                     SystemRuntime, StateStore, OverrideManager, ForecastService,
│  │                           LiveHub (SSE), Scheduler, ConfigStore (SQLite)
│  ├─ api/                     router: clima, systems, overrides, live, config, adapters, ha, i18n, system
│  ├─ testing/                 fake_ha, fixture, classi di contratto
│  ├─ locales/                 frammenti di traduzione degli adattatori (adapter.<id>.*)
│  └─ tests/  Dockerfile  pyproject.toml (uv, import-linter)
├─ contract/openapi.json       generato e versionato
├─ locales/                    it.json, en.json, locale.schema.json, README per traduttori
├─ examples/home-assistant/    blueprint e configurazioni d'esempio per strategia
├─ docs/{design, architecture.md, contributing/, adapters/}
├─ docker-compose.yml   .env.example   LICENSE   CONTRIBUTING.md
└─ .github/workflows/{tests.yml (riusabile), ci.yml, docker-build.yml}
```

## 5. Milestone

### M0: scheletro, CI e licenza (v0.1.0)

**Contenuto**
- Struttura delle cartelle.
- Backend con `/api/health` e `/api/version`; frontend minimo servito da nginx.
- Dockerfile reali per le due immagini.
- Workflow: test, build delle 2 immagini × 2 architetture, poi tag git e verifica (§7).
- `docker-compose.yml`, LICENSE (MIT), CONTRIBUTING; README in inglese e italiano.
- Regole di `import-linter` attive.
- `.dockerignore`: esclude `docs/`, `node_modules`, `.venv` e `dist`, include `locales/`.

**Verifica**
- `docker buildx imagetools inspect` mostra manifest amd64 e arm64 per entrambe le immagini.
- Il pull anonimo funziona per entrambi i pacchetti.
- `compose up` risponde su `/api/health` passando da nginx. L'arm64 si verifica solo tramite build e manifest (nessuna macchina arm64 per i test).

### M1: UI fedele ai mockup, guidata dalle capacità, su dati simulati (v0.2.0)

**Contenuto**
- Contratto generico (§1) in Pydantic, con i tipi TS generati.
- `MockDataSource`, port di `Neng.js`, con orologio fisso al 20/11/2026 08:30.
- **Scenari mock** selezionabili con `?scenario=`:

  | Scenario | Cosa simula |
  |---|---|
  | `home` | la casa dell'handoff |
  | `perSlot` | un target per ogni fascia |
  | `readonly` | programmi in sola lettura |
  | `noProgram` | nessun programma |
  | `manyRooms` | 10 stanze, 3 impianti in una stanza, deumidificatore come `kind` sconosciuto |

- Token CSS, font in self-hosting, Header con registro dei moduli.
- Le due schermate.
- Corsie generate dai System; `ProgramBar` per ogni rappresentazione del programma.
- `SlotEditor` limitato agli scope supportati.
- Animazioni: CSS e Motion; rispetta `prefers-reduced-motion`.
- Accessibilità di base: `role="img"` con `aria-label`, tabella nascosta, navigazione da tastiera.
- i18n ICU, con solo l'italiano ma l'infrastruttura completa.

**Verifica**
- Vitest su: costruzione dei path, `runs`, colori, `summaryFacts` (casi di HANDOFF §7 più varianti generiche), matrice capacità → editor.
- Playwright a 1400 px con orologio fisso sullo scenario `home`:
  - Stanza: 24 ore, 7 giorni, cursore;
  - Tutte le stanze: 24 ore e 7 giorni;
  - confronto manuale con `docs/design/screenshots`, poi baseline con tolleranza;
  - controllo axe.
- Gli altri scenari solo come smoke test.

### M2: core, framework degli adattatori e adattatori v1 in sola lettura (v0.3.0)

**Contenuto**
- `core` (program, timegrid, behavior), `ports`, `registry`.
- `HaConnection` (WS condiviso):
  - autenticazione, `subscribe_events`, `call_service` con `return_response`;
  - riconnessione con backoff e reidratazione dopo il riavvio di HA.
- Adattatori in sola lettura:
  - `ha_climate`, `ha_sensor`;
  - `ha_schedule_levels`: legge con `schedule/list`; per gli helper YAML usa `schedule.get_schedule` se esiste, e in quel caso è in sola lettura;
  - `influx2`, `ha_recorder` (chi non ha InfluxDB funziona senza configurare nulla);
  - outdoor `ha_sensor`, `sensor_power`.
- Configurazione in SQLite con migrazioni. Primo caricamento da `/data/config.yaml`, validato con gli schemi degli adattatori; la procedura di setup arriva in M3.
- `SystemRuntime` e `StateStore`; SSE con debounce di 1–2 s e heartbeat ogni 15 s.
- `TimelineBuilder` per gli aggregati delle due schermate.

**Verifica**
- Test di contratto di ogni adattatore v1 su `FakeHomeAssistant`.
- Core: giorni del cambio d'ora a marzo e ottobre 2026 (46 e 50 campioni); buchi a `null`.
- `influx2` contro un `influxdb:2` reale in CI.
- Nella casa reale: schede uguali ad HA; SSE con latenza sotto i 3 s attraverso nginx.

### M3: procedura di setup generata dagli schemi, inglese e lingue aggiuntive (v0.4.0)

**Passi della procedura**
1. **Connessioni.** HA, con le variabili d'ambiente che hanno la precedenza. Il test usa `get_config`, che fornisce anche lat/lon e fuso.
2. **Storico.** Scelta dell'adattatore e relativo form.
3. **Stanze.** In numero libero; ognuna con un sensore oppure «segue la stanza X».
4. **Impianti.** Kind, stanze servite, poi driver, programma, override e consumi, ognuno con il proprio form.
5. **Esterno.** Fonte dei valori attuali e fonte delle previsioni.
6. **Rete elettrica e tariffa.**
7. **Riepilogo.** Capacità risolte, avvisi e anteprima dei valori dal vivo.

**Componenti di supporto**
- `HaEntityPicker`, filtrato con `x-ha-entity`.
- `/api/config/validate`: prova a vuoto con gli errori campo per campo.

**Sicurezza**
- Il token è in sola scrittura: l'API restituisce solo `configured: true`.
- `HESTIA_SETUP_LOCKED=true` blocca le modifiche dalla UI.

**Lingue**
- Inglese completo.
- Lingue aggiuntive senza ricompilare, compresi i frammenti di traduzione dei plugin.

**Verifica**
- I JSON Schema sono validi.
- I segreti non compaiono mai nelle risposte.
- La migrazione della configurazione di un adattatore da v1 a v2 funziona.
- `schemaForm` gestisce tutti i costrutti usati: enum, oneOf, array, campi dipendenti, campi avanzati.
- Playwright con HA finto, negli scenari `home` e «minimo» (solo climate più recorder).

### M4: override, scritture e modalità (v0.5.0)

**OverrideManager nel core**
- Stati: pending → active → expired / reverted / failed.
- Riconciliazione all'avvio e alla riconnessione con HA.
- Con scadenza `hestia`, ripristina il valore del programma a fine fascia.
- Gli override temporanei si applicano solo alla fascia in corso (R4). Sulle fasce future l'editor offre solo le modifiche permanenti supportate.

**`climate_direct`**
- Al cambio permanente di un livello, se la fascia in corso usa quel livello, aggiorna subito anche il `climate`.

**Scritture di `ha_schedule_levels`**
- Valori dei livelli: `input_number.set_value`.
- Orari: `schedule/update`, con queste cautele:
  - rilegge e confronta prima di scrivere;
  - conserva name, icon e `data`;
  - controlla che i blocchi non si sovrappongano;
  - usa il formato `HH:MM:SS`, con `24:00:00` come fine giornata.

**Editor**
- L'editor mostra un'anteprima della differenza prima di confermare.
- Fascia in corso: «solo questa fascia» e le opzioni permanenti supportate. Fascia futura: solo le opzioni permanenti. Fascia conclusa: non cliccabile.

**Verifica**
- Contratti di scrittura e rilettura: gli altri blocchi restano intatti.
- Un override temporaneo su una fascia futura viene rifiutato (422).
- Riapplicazione dopo il riavvio di HA.
- Limiti ±4° e passo 0,5.
- Un helper YAML restituisce 409 e la UI nasconde le opzioni.
- Prova manuale su una zona reale, con la checklist nel README.

### M5: previsione e fonti meteo (v0.6.0)

**Modello termico generico**

`ΔT = Σ_s g_s·u_s − λ·T + μ·T_est + β`, dove `u_s` è la frazione di tempo in cui ogni impianto della stanza è in azione.
- Il segno atteso di ogni coefficiente dipende da `kind` e azione.
- Stima con `numpy.lstsq` e vincoli di segno.
- I coefficienti si accettano solo se ci sono almeno 5 giorni utili, R² supera la soglia e λ è compreso fra 0,005 e 0,1. Altrimenti si usano i coefficienti del mockup, con un avviso nella UI.
- Ricalcolo ogni notte e su richiesta.

**Simulazione**
- Usa `behavior` più il programma; senza programma mantiene lo stato attuale.
- `POST /api/forecast/rooms/{id}/preview` calcola la previsione sulla bozza dell'editor.

**Adattatori**
- `ha_weather`, `open_meteo`, `composite`.
- Se lo storico non ha le azioni (`actionHistory` falso), si ricostruiscono con l'isteresi e la qualità della previsione viene segnalata come ridotta.

**Verifica**
- Su dati sintetici il fit ritrova i coefficienti entro ±10%.
- Con pochi dati scatta il ripiego sui coefficienti del mockup.
- `OutdoorSourceContract` con risposte registrate.
- Backtest dell'errore medio assoluto a 2 ore, esposto in `/api/forecast/metrics`.

### M6: seconda ondata di adattatori ed ecosistema (v0.7.0)

**Adattatori**

| Famiglia | Nuovi adattatori |
|---|---|
| Programma | `template`, `ha_schedule_data`, `none` |
| Override | `service_call`, `input_number_offset` |
| Driver e sensori | `template`, `climate_current` |
| Consumi | `estimate`, `sensor_energy` |
| Storico | `influx1`, `none` |

**Ecosistema**
- Caricamento dei plugin (entry point e cartella).
- Documentazione completa per contributor.
- Plugin d'esempio.

**Verifica**
- Tutti i contratti passano.
- Un plugin esterno installato in un'immagine derivata durante la CI compare in `/api/adapters` e supera i propri contratti.

### M7: verso la 1.0 (v1.0.0)

**Contenuto**
- `hacs_scheduler` e `thermostat_native` (almeno uno, anche in sola lettura).
- `hestia_managed`, con un avviso: se il container è fermo, i cambi di fascia non avvengono.
- Accessibilità e contrasti.
- Layout tablet.
- Avviso se le versioni di frontend e backend non coincidono.
- Documentazione utente bilingue.

**Verifica**
- Checklist dell'handoff completa.
- Test end-to-end negli scenari `home` e «minimo».
- Una settimana di uso reale.

## 6. API (tutte sotto `/api`)

| Metodo | Percorso | Note |
|---|---|---|
| GET | `/health`, `/version`, `/modules` | |
| GET | `/rooms`, `/rooms/{id}/series?from&to` | come nell'handoff |
| GET | `/systems`, `/systems/{id}` | sostituiscono `/zones` e `/ac-units`: kind, stato, capacità risolte, programma, storico delle azioni |
| GET/PUT | `/systems/{id}/program` | PUT solo con `writeTimes`/`writeSlotValue`; il body include la versione letta; 409 se il programma è cambiato nel frattempo |
| PUT | `/systems/{id}/levels/{levelId}` | solo con `writeLevelValues` |
| PATCH | `/systems/{id}` | `{targetC}`, se il driver lo supporta (nessun cambio di modalità dalla UI) |
| POST/DELETE | `/overrides`, `/overrides/{id}` | scope validato sulle capacità; 422 con codice se non supportato |
| GET | `/outdoor?from&to`, `/grid?from&to` | |
| GET/POST | `/forecast/rooms/{id}?hours=`, `/forecast/rooms/{id}/preview`, `/forecast/metrics`, `/forecast/refit` | |
| GET | `/clima/rooms/{id}/timeline?range=24h\|7d`, `/clima/overview?range=` | dati aggregati per la UI |
| GET | `/live` (SSE) | eventi `snapshot`, `room`, `system`, `power`, `override`, `config`, `forecast`, `warning` |
| GET | `/adapters`, `/adapters/{family}/{id}/schema` | elenco, versione API, JSON Schema, capacità statiche, namespace di traduzione |
| GET/PUT/POST | `/config`, `/config/status`, `/config/validate` | segreti in sola scrittura; prova a vuoto |
| POST | `/setup/test/{connection}` | ha, influx, … |
| GET/POST | `/ha/entities?domain=&device_class=&unit=`, `/ha/services`, `/ha/render-template` | |
| GET | `/i18n/locales`, `/i18n/{lang}` | unisce file aggiuntivi, lingue integrate e frammenti degli adattatori |

## 7. CI

**Workflow**
- `tests.yml` (riusabile, `workflow_call`):
  - backend: ruff, mypy, import-linter, pytest (core, contratti di tutti gli adattatori, API), con service container `influxdb:2`;
  - frontend: eslint, tsc, vitest, controllo dei tipi generati rispetto a `openapi.json`, Playwright sugli scenari mock.
- `ci.yml`: su push e PR richiama `tests.yml`.
- `docker-build.yml`: avvio manuale, solo da `main`.

**Job di `docker-build.yml`**
1. `version`: stesso calcolo di vX.Y.Z di oggi.
2. `tests`: richiama `tests.yml`.
3. `build`: matrice `[backend, frontend]` con QEMU e buildx:
   - `platforms: linux/amd64,linux/arm64`;
   - cache gha separata per componente;
   - immagini `ghcr.io/<owner>/hestia-backend` e `hestia-frontend`;
   - stessi tag di oggi: vX.Y.Z, X.Y.Z, X.Y, sha, latest.
4. `release`: crea il tag git solo dopo che entrambe le build sono riuscite.
5. `verify`: pull anonimo di entrambi i pacchetti.

**Ottimizzazioni e note**
- Frontend: lo stage Node usa `--platform=$BUILDPLATFORM`, perché l'output statico è uguale per tutte le architetture.
- Backend: `python:3.12-slim` con uv e wheel di numpy per arm64, senza scipy.
- Alla prima release vanno resi pubblici entrambi i pacchetti.
- Il vecchio pacchetto `hestia` va segnato come deprecato.

## 8. docker-compose e nginx

**`docker-compose.yml`** (solo `image:`)
- **backend:**
  - volume `hestia-data:/data` (config, database, `locales/`, plugin);
  - `env_file: .env` (`HA_URL`, `HA_TOKEN` e `INFLUX_*`, tutti facoltativi);
  - healthcheck;
  - nessuna porta pubblicata.
- **frontend:**
  - `BACKEND_URL=http://backend:8000`;
  - porta 8080;
  - `depends_on` con `service_healthy`.

**nginx** (immagine `nginx-unprivileged`)
- Serve i file statici, con fallback della SPA e cache lunga sugli asset con hash.
- Inoltra `/api/` al backend.
- Per `/api/live`: `proxy_buffering off`, `proxy_read_timeout 1h`, HTTP/1.1. Il backend invia comunque `X-Accel-Buffering: no`.
- Essendo l'unico punto d'ingresso, non serve CORS.

## 9. i18n

**File di lingua**
- JSON piatti con messaggi ICU (`intl-messageformat`) e un oggetto `meta` (`{name, fallback}`).
- Ordine di ricerca di una traduzione:
  1. `/data/locales` (lingue aggiunte dall'utente);
  2. lingue integrate;
  3. frammenti degli adattatori;
  4. lingua di fallback dichiarata;
  5. `en`.
- Le chiavi degli adattatori stanno nel namespace `adapter.<id>.*`; gli schemi di configurazione le richiamano con `x-i18n`.

**Formati**
- Numeri con `Intl.NumberFormat` e una cifra decimale: in italiano la virgola.
- Date con `Intl.DateTimeFormat` e il fuso della configurazione.

**Riassunto a parole**
- `summaryFacts()` produce fatti generici per kind; ogni fatto ha un messaggio ICU per kind e uno `generic` di fallback.
- La grammatica (select, plural, `Intl.ListFormat`) resta nei file di lingua.

## 10. Rischi e domande aperte

- **R1. Token admin.** Serve per `schedule/*` e `render_template`. Il test di connessione lo segnala e, senza admin, le capacità si riducono.
- **R2. `schedule/update` riscrive l'intero programma**, senza controllo di versione in HA.
  - Prima di scrivere, si rilegge e si confronta: se il programma è cambiato, 409.
  - Si conservano name, icon e `data`.
  - Gli helper YAML restano in sola lettura.
- **R3. Riavvio di HA.** Lo schedule passa da `unavailable` a on/off, l'automazione rimette il target e cancella l'override.
  - Con scadenza `external`, Hestia riapplica l'override alla riconnessione.
  - Il blueprint ignora le transizioni da `unavailable`.
- **R4. Override su una fascia futura:** ci sarebbe una gara con l'automazione dell'utente. **Deciso:** gli override temporanei valgono solo per la fascia in corso (`futureSlots: false` in v1).
- **R5. Esplosione delle combinazioni di capacità.**
  - Matrice di test dell'editor e scenari mock.
  - L'intersezione delle capacità si calcola in un solo punto (`core/capabilities.py`).
- **R6. I plugin da cartella eseguono codice arbitrario.** Vanno attivati esplicitamente; la via consigliata è l'entry point. Semver sull'API degli adattatori, con controllo di `api_version`.
- **R7. Migrazioni della configurazione degli adattatori.** Si usano `configVersion` e funzioni di migrazione, con backup automatico.
- **R8. Copertura del JSON Schema.** Si supporta un sottoinsieme documentato; un test fallisce se un adattatore usa costrutti non supportati.
- **R9. Modalità degli split.** **Deciso:** nessun pulsante di modalità nella UI; Hestia legge la modalità dal sistema domotico e non la scrive.
- **R10. Naming in InfluxDB.** L'integrazione HA usa:
  - come measurement, l'unità di misura (`°C`, `%`, `W`);
  - come tag, `entity_id` senza dominio;
  - come field, `value`.

  `climate.*` finisce in `climate.xxx` o in `default_measurement`, e i suoi attributi diventano field (`hvac_action_str`).
  - Mitigazione: `influx2.discover()` con `schema.measurements` e `tagValues`, salvando la mappatura per ogni entità.
  - Il recorder di HA ha una retention limitata; le sue statistics non contengono gli attributi.
- **R11. Ora legale.**
  - Le fasce che cadono in un'ora inesistente si accorciano.
  - L'ora ripetuta segue l'orologio.
  - Nelle query si usa `aggregateWindow(location:)`.
  - È un test di contratto obbligatorio per ProgramSource e HistorySource.
- **R12. Template.** Rischi: costo delle subscription, errori dell'utente, JSON non valido. Mitigazioni: validazione, avvisi via SSE, limite al numero di template.
- **R13. Previsione con pochi dati.** Si espongono le metriche e si usa il fallback.
- **R14. Sicurezza in LAN senza login.**
  - Token in sola scrittura.
  - `HESTIA_SETUP_LOCKED`.
  - Documentare un reverse proxy con autenticazione per chi ne ha bisogno.
- **R15. SSE dietro altri proxy** (Traefik, Nginx Proxy Manager): documentare la configurazione.
- **R16. Build arm64 sotto QEMU:** mitigazioni in §7.
- **R17. Versione minima di HA** (`schedule.get_schedule`, `weather.get_forecasts`, `data` nei blocchi): fissarla in M2. Ogni adattatore dichiara la propria in `resolve_capabilities()`.
- **R18. Decisioni di progetto:** tutte prese (licenza MIT, lingua, nomi delle immagini, precedenza dei caloriferi): vedi «Decisioni prese».

## File di riferimento

- [`docs/design/HANDOFF.md`](design/HANDOFF.md)
- [`docs/design/reference-src/Neng.js`](design/reference-src/Neng.js), [`NS.js`](design/reference-src/NS.js), [`T.js`](design/reference-src/T.js)
- [`docs/design/mockup/`](design/mockup/)
- [`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml)
