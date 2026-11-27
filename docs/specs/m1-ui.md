# Hestia M1 implementation spec (v0.2.0): UI faithful to the mockups, capability-driven, on simulated data

Historical implementation spec of M1, written 2026-11-21 for the engineers implementing tasks A-F in
parallel; M1 was released as `v0.2.0`. Differences found while building are in the "Deviations" sections
at the end. Code comments cite this file as "spec §n". Decisions D1–D14 are in
[`DECISIONS.md`](../../DECISIONS.md); work state is in Heph. References to "plan §5 M1" point to a section
that has since moved to Heph.

Source documents (read-only): `docs/implementation-plan.md` (§1, §2, §4, §5 M1, §6, §9),
`docs/design/HANDOFF.md`, `docs/design/mockup/N-Stanza.dc.html`, `docs/design/mockup/N-Tutte.dc.html`
(source of truth for markup, styles and logic; the `<script data-dc-script>` block at the bottom of each),
`docs/design/reference-src/{Neng.js,NS.js,T.js}`, `docs/design/screenshots/*.png`.

---

## 0. Global decisions and rules

The global decisions D1–D14 of this spec are recorded in [`DECISIONS.md`](../../DECISIONS.md).

Project rules (repeat): code/comments/contributor docs in English; **no user-visible text in code** (every
string via `t()`; mock room/system/level names are i18n keys under `mock.*`); backend `mypy --strict`, ruff lint
+ format, import-linter (core pure); API payloads camelCase on the wire.

Accepted visual deviations from the mockups (do not "fix" them): D7 weekend rows, D14 clock, "segue Bagno" instead
of "segue il bagno" (room names are data, articles are not generated), `(con Bagno)` instead of `(con bagno)`,
no mode chips (D9), no Energia/Luci/+ modulo (D13), editor has an extra scope selector (§7.6).

---

## 1. Backend contract (task A)

### 1.1 Files

```
backend/hestia/core/base.py          DomainModel
backend/hestia/core/literals.py      Literal aliases and patterns
backend/hestia/core/program.py       Level, Slot, WeekDays, Program (+ validators, minutes())
backend/hestia/core/capabilities.py  *Capabilities models
backend/hestia/core/domain.py        AdapterRef, Hysteresis, Room, System
backend/hestia/core/overrides.py     OverrideChange, OverrideCreate, Override
backend/hestia/api/schemas.py        ApiModel(DomainModel), ApiError   (edit)
backend/hestia/api/errors.py         DataSourceUnavailableError + handler
backend/hestia/api/clima_models.py   UI aggregates
backend/hestia/api/clima.py          router: /rooms, /clima/rooms/{room_id}/timeline, /clima/overview
backend/hestia/api/overrides.py      router: POST /overrides, DELETE /overrides/{override_id}
backend/hestia/main.py               include routers, install handler (edit)
backend/tests/test_contract_models.py
backend/tests/test_clima_api.py
contract/openapi.json                regenerated
```

### 1.2 Core models (exact)

```python
# backend/hestia/core/base.py
"""Base class for the domain value models shared by the core and the API contract."""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class DomainModel(BaseModel):
    """snake_case in Python, camelCase on the wire; immutable."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)
```

```python
# backend/hestia/core/literals.py
from typing import Annotated, Final, Literal
from pydantic import Field

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAYS: Final[tuple[Weekday, ...]] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
SystemKind = str                      # known values: KNOWN_SYSTEM_KINDS; any string is valid
KNOWN_SYSTEM_KINDS: Final = ("radiator", "ac", "dehumidifier", "vmc")
SystemBehavior = Literal["thermostatic", "always_on_target", "mode_based", "unknown"]
Mode = Literal["heat", "cool", "heat_cool", "auto", "dry", "fan_only", "off"]
Action = Literal["heat", "cool", "dry", "idle", "off"]
ProgramRepresentation = Literal["levels", "perSlot", "onOff", "none"]
OverrideScope = Literal["slot", "until", "permanentValue", "permanentTimes"]
TemporaryOverrideScope = Literal["slot", "until"]
OverrideStatus = Literal["pending", "active", "expired", "reverted", "failed"]
OverrideExpiry = Literal["external", "hestia"]
DayScope = Literal["perDay", "all"]
PowerKind = Literal["measured", "estimated", "none"]
TimeRange = Literal["24h", "7d"]
SegmentState = Literal["past", "current", "future"]

ClockTime = Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]            # 00:00-23:59
SlotEnd = Annotated[str, Field(pattern=r"^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$")]    # 00:00-24:00
Identifier = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9_-]*$")]
```

```python
# backend/hestia/core/program.py
def minutes(value: str) -> int:
    """'HH:MM' -> minutes since midnight ('24:00' -> 1440)."""

class Level(DomainModel):
    id: Identifier
    label: str | None = None          # user-provided label (config)
    label_key: str | None = None      # i18n key (adapters, mock)
    target_c: float

class Slot(DomainModel):
    from_: ClockTime = Field(alias="from")
    to: SlotEnd
    level_id: str | None = None       # representation 'levels'
    target_c: float | None = None     # representation 'perSlot'
    on: bool | None = None            # representation 'onOff'
    ref: str = Field(min_length=1)    # opaque, adapter-owned; unique within its day
    # model_validator(after): minutes(from_) < minutes(to)

class WeekDays(DomainModel):
    mon: list[Slot]; tue: list[Slot]; wed: list[Slot]; thu: list[Slot]
    fri: list[Slot]; sat: list[Slot]; sun: list[Slot]

class Program(DomainModel):
    representation: ProgramRepresentation
    levels: list[Level] | None = None
    days: WeekDays
    version: str                      # opaque token for optimistic concurrency (409 in M4)
    # model_validator(after):
    #  - every day: slots sorted by from, non-overlapping (prev.to <= next.from), refs unique per day
    #  - 'levels': levels non-empty, unique ids; every slot.level_id is set and exists
    #  - 'perSlot': levels is None; every slot.target_c is set
    #  - 'onOff': levels is None; every slot.on is set
    #  - 'none': levels is None; every day is empty
    #  Gaps between slots are allowed (a gap = "not programmed").
```

```python
# backend/hestia/core/capabilities.py
class ProgramCapabilities(DomainModel):
    read: bool
    representation: ProgramRepresentation
    write_level_values: bool
    write_slot_value: bool
    write_times: bool
    day_scope: DayScope
    minute_step: int = Field(ge=1, le=60)
    max_slots_per_day: int | None = None

class OverrideCapabilities(DomainModel):
    scopes: list[TemporaryOverrideScope]   # temporary scopes only; permanent ones come from ProgramCapabilities
    future_slots: bool                     # reserved: M1 UI ignores it (D10)
    step: float                            # 0.5
    min_delta: float                       # -4.0
    max_delta: float                       # 4.0
    expiry: OverrideExpiry

class DriverCapabilities(DomainModel):
    modes: list[Mode]
    reads_action: bool
    reads_target: bool
    writes_mode: bool
    writes_target: bool

class PowerCapabilities(DomainModel):
    kind: PowerKind
    energy_totals: bool

class HistoryCapabilities(DomainModel):
    max_lookback_days: int | None = None
    resolution_min: int
    action_history: bool

class OutdoorCapabilities(DomainModel):
    current: bool
    history: bool
    forecast_hours: int

class SystemCapabilities(DomainModel):
    program: ProgramCapabilities
    override: OverrideCapabilities
    driver: DriverCapabilities
    power: PowerCapabilities

class SourceCapabilities(DomainModel):
    history: HistoryCapabilities
    outdoor: OutdoorCapabilities
```

```python
# backend/hestia/core/domain.py   (config-level entities; NOT exported on the wire in M1)
from pydantic import JsonValue

class AdapterRef(DomainModel):
    type: str = Field(min_length=1)          # adapter id, e.g. 'ha_schedule_levels'
    config: dict[str, JsonValue]
    config_version: int = Field(ge=1)

class Hysteresis(DomainModel):
    below_c: float = Field(default=0.3, ge=0)  # comfort low  = target - below_c (action starts below)
    above_c: float = Field(default=0.2, ge=0)  # comfort high = target + above_c (action stops above)

class Room(DomainModel):
    id: Identifier
    name: str | None = None
    name_key: str | None = None
    sensor: AdapterRef | None = None          # RoomSensorBinding of plan §1
    follows_room_id: str | None = None
    system_ids: list[str]
    display_target_system_id: str | None = None

class System(DomainModel):
    id: Identifier
    kind: SystemKind
    name: str | None = None
    name_key: str | None = None
    room_ids: list[str] = Field(min_length=1)
    behavior: SystemBehavior
    hysteresis: Hysteresis
    driver: AdapterRef
    program: AdapterRef
    override: AdapterRef
    power: AdapterRef | None = None
```
`Room`/`System`/`AdapterRef` stay internal until the M3 config API (adapter configs carry entity ids and,
later, secrets). They are still validated by tests.

```python
# backend/hestia/core/overrides.py
class OverrideChange(DomainModel):
    delta_c: float | None = None
    target_c: float | None = None
    level_value_c: float | None = None
    from_: ClockTime | None = Field(default=None, alias="from")
    to: SlotEnd | None = None
    days: list[Weekday] | None = None

class OverrideCreate(DomainModel):
    system_id: str
    slot_ref: str
    day: Weekday                               # day of the slot occurrence (refs are unique per day)
    scope: OverrideScope
    change: OverrideChange
    valid_until: AwareDatetime | None = None   # only for scope 'until'
    # model_validator(after), exactly these fields set in change:
    #  slot           -> exactly one of target_c / delta_c
    #  until          -> target_c, and valid_until is set
    #  permanentValue -> exactly one of level_value_c (levels) / target_c (perSlot)
    #  permanentTimes -> from_ and to (from_ < to); days optional

class Override(DomainModel):
    id: str
    system_id: str
    slot_ref: str
    day: Weekday
    scope: OverrideScope
    change: OverrideChange
    status: OverrideStatus
    valid_from: AwareDatetime
    valid_until: AwareDatetime | None = None
```
(Deviation from plan §1: `day` added to `Override`, because `Slot.ref` is unique per day, not per week.)

Rule for all contract models: **only nullable fields get a default (`None`)**, plus `Hysteresis` numeric
defaults. openapi-typescript treats fields with a default as present (`defaultNonNullable`), so TS sees
`levelId: string | null` (verified with 7.13.0). Input and output schemas therefore coincide and FastAPI emits no
`-Input`/`-Output` duplicates (a test asserts it).

### 1.3 API schemas (edit `api/schemas.py`)

```python
from typing import Literal
from hestia.core.base import DomainModel

class ApiModel(DomainModel):
    """Base class for API-only request/response bodies (same camelCase config as the domain)."""

class ApiError(ApiModel):
    code: str        # machine code; known: 'no_data_source', 'not_found', 'unsupported_scope', 'stale_program', 'validation_error'
    message: str     # English, for logs/developers; the UI maps `code` to an i18n key
```
`ApiModel` becomes frozen through inheritance; existing `HealthResponse`/`VersionResponse` still work.

### 1.4 UI aggregates (`api/clima_models.py`, all `ApiModel`)

```python
class ClockInfo(ApiModel):
    now: AwareDatetime            # mock: 2026-11-20T08:30:00+01:00
    time_zone: str                # IANA, e.g. 'Europe/Rome'

class TimeGrid(ApiModel):
    range: TimeRange
    step_minutes: int             # 30
    count: int                    # 24h: 52, 7d: 360
    now_index: int                # sample containing clock.now; 24h: 48, 7d: 336
    t: list[AwareDatetime]        # len == count; t[i] = start of sample i (ISO with offset)
    end: AwareDatetime            # t[count-1] + step

class RoomView(ApiModel):
    id: str
    name: str | None = None
    name_key: str | None = None
    has_sensor: bool
    follows_room_id: str | None = None
    system_ids: list[str]
    display_target_system_id: str | None = None

class AdapterTypes(ApiModel):
    driver: str
    program: str
    override: str
    power: str | None = None

class SystemState(ApiModel):      # at clock.now
    mode: Mode | None = None
    action: Action | None = None
    target_c: float | None = None

class SystemView(ApiModel):
    id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    room_ids: list[str]
    primary_room_id: str          # first of room_ids with a sensor (else room_ids[0])
    behavior: SystemBehavior
    hysteresis: Hysteresis
    capabilities: SystemCapabilities
    program: Program | None = None   # effective program (permanent changes applied); None if not readable
    state: SystemState
    adapters: AdapterTypes

class SystemStatus(ApiModel):     # one system as seen from one room, at clock.now
    system_id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    action: Action | None = None
    mode: Mode | None = None
    target_c: float | None = None
    via_room_id: str | None = None   # set when this room is not the system's primary room (shared zone)

class RoomStatus(ApiModel):
    room_id: str
    name: str | None = None
    name_key: str | None = None
    has_sensor: bool
    follows_room_id: str | None = None
    temperature_c: float | None = None
    humidity_pct: float | None = None
    systems: list[SystemStatus]

class RoomClimateSeries(ApiModel):   # all lists have len == grid.count
    measured_c: list[float | None]            # value for i <= now_index, else None
    forecast_c: list[float | None]            # value for i >= now_index, else None (both set at now_index)
    measured_humidity_pct: list[float | None]
    forecast_humidity_pct: list[float | None]

class TargetSeries(ApiModel):        # comfort band of the thermogram, len == grid.count
    target_c: list[float | None]
    comfort_low_c: list[float | None]          # target - hysteresis.below_c of the source system
    comfort_high_c: list[float | None]         # target + hysteresis.above_c
    source_system_ids: list[str | None]

class ProgramSegment(ApiModel):      # one run of one slot occurrence with one effective value, clipped to the grid
    key: str                         # stable: f"{system_id}|{day or 'gap'}|{slot_ref or 'gap'}|{start_index}"
    start_index: int                 # inclusive
    end_index: int                   # exclusive
    start: AwareDatetime             # grid.t[start_index]
    end: AwareDatetime               # start of sample end_index (grid.end when end_index == count)
    slot_ref: str | None = None      # None = gap ("not programmed")
    day: Weekday | None = None
    slot_from: str | None = None     # 'HH:MM' of the slot definition (not clipped)
    slot_to: str | None = None       # 'HH:MM' (may be '24:00')
    level_id: str | None = None
    target_c: float | None = None    # effective value (overrides/draft applied)
    programmed_target_c: float | None = None  # value of the program without temporary overrides
    on: bool | None = None
    state: SegmentState              # past: end_index <= now_index; current: start <= now_index < end; future: start > now_index
    edited: bool                     # a committed override or the preview draft changes it (never true when past)
    override_id: str | None = None   # committed override affecting it (None for the draft)

class NextProgramChange(ApiModel):
    at: AwareDatetime
    change: Literal["target", "on", "off"]
    target_c: float | None = None

class SystemSeries(ApiModel):
    system_id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    target_c: list[float | None]      # effective target/set per sample (None = not programmed / off)
    action: list[Action | None]       # None = no action info (e.g. no program and no driver data)
    mode: list[Mode | None]

class SystemLane(SystemSeries):
    representation: ProgramRepresentation
    segments: list[ProgramSegment]
    next_change: NextProgramChange | None = None   # first program change strictly after clock.now within 24 h

class OutdoorSeries(ApiModel):
    measured_c: list[float | None]
    forecast_c: list[float | None]
    measured_humidity_pct: list[float | None]
    forecast_humidity_pct: list[float | None]
    now_c: float | None = None
    now_humidity_pct: float | None = None

class PowerSummary(ApiModel):
    kind: Literal["measured", "estimated", "mixed", "none"]
    now_kw: float | None = None
    last24h_kwh: float | None = None
    last24h_cost: float | None = None
    month: int                       # 1-12 (local month of clock.now)
    month_kwh: float | None = None
    month_cost: float | None = None
    currency: str                    # 'EUR'
    tariff_per_kwh: float | None = None
    measured_system_ids: list[str]
    unmeasured_kinds: list[str]      # distinct kinds whose power.kind == 'none', e.g. ['radiator']

class RoomTimeline(ApiModel):        # GET /api/clima/rooms/{room_id}/timeline?range=
    clock: ClockInfo
    grid: TimeGrid
    room: RoomView
    rooms: list[RoomStatus]          # every room in configuration order (room tabs)
    climate: RoomClimateSeries
    target: TargetSeries
    lanes: list[SystemLane]          # systems serving the room, lane order (§5.1)
    outdoor: OutdoorSeries
    power: PowerSummary              # house level, range-independent
    systems: list[SystemView]        # same order as lanes
    overrides: list[Override]        # committed, for the room's systems
    sources: SourceCapabilities

class OverviewRow(ApiModel):
    room: RoomView
    status: RoomStatus
    climate: RoomClimateSeries | None = None   # None without sensor
    target: TargetSeries | None = None
    systems: list[SystemSeries]                # every system serving the room (shared zones included)

class ClimaOverview(ApiModel):       # GET /api/clima/overview?range=
    clock: ClockInfo
    grid: TimeGrid
    rows: list[OverviewRow]          # every room in configuration order
    outdoor: OutdoorSeries
    sources: SourceCapabilities
```

### 1.5 Routes (M1 stubs, final signatures)

```python
# api/errors.py
NO_DATA_SOURCE: Final = "no_data_source"
class DataSourceUnavailableError(Exception):
    """Raised by endpoints whose data source arrives in M2."""
async def data_source_unavailable_handler(request: Request, exc: Exception) -> JSONResponse:
    body = ApiError(code=NO_DATA_SOURCE,
                    message="No data source is configured yet: real data arrives in M2; the UI uses its mock data source.")
    return JSONResponse(status_code=503, content=body.model_dump(by_alias=True))
def install_error_handlers(app: FastAPI) -> None: ...
NO_DATA_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    503: {"model": ApiError, "description": "No data source until M2."}}
```

| Method | Path | operation_id | Params | Response model | M1 behaviour |
|---|---|---|---|---|---|
| GET | `/api/rooms` | `getRooms` | | `list[RoomView]` | 503 |
| GET | `/api/clima/rooms/{room_id}/timeline` | `getRoomTimeline` | `range_: Annotated[TimeRange, Query(alias="range")] = "24h"` | `RoomTimeline` | 503 |
| GET | `/api/clima/overview` | `getClimaOverview` | same `range` | `ClimaOverview` | 503 |
| POST | `/api/overrides` | `createOverride` | body `OverrideCreate`, `status_code=201` | `Override` | 503 |
| DELETE | `/api/overrides/{override_id}` | `deleteOverride` | `status_code=204, response_class=Response`, returns `None` | | 503 |

Routers: `api/clima.py` (`tags=["clima"]`), `api/overrides.py` (`tags=["overrides"]`), mounted with
`prefix="/api"` in `create_app()`, which also calls `install_error_handlers(app)`.

### 1.6 Backend tests (A)

- `test_clima_api.py`: each of the 5 routes answers 503 with body `{"code": "no_data_source", "message": <str>}`;
  `GET /api/clima/overview?range=1y` answers 422.
- `test_contract_models.py`: camelCase round trip (`Slot` dumps `from`, `levelId`; `TimeGrid` dumps `nowIndex`,
  `stepMinutes`); `Slot` rejects `"24:00"` as `from`, `"6:00"`, `from >= to`; `Program` validator cases (overlap,
  missing level, `none` with slots, unknown level id); `OverrideCreate` scope/change matrix; `Room`/`System`
  construct with an `AdapterRef`; OpenAPI document contains schemas `RoomTimeline`, `ClimaOverview`, `ProgramSegment`,
  `Override`, `OverrideCreate`, `ApiError`, `SystemCapabilities`, and **no schema name ends with `-Input` or
  `-Output`**; `ProgramSegment` properties are camelCase (`startIndex`, `slotFrom`, `programmedTargetC`).
- Existing tests keep passing; `uv run python -m hestia.export_openapi` regenerates `contract/openapi.json`.

### 1.7 TS generation and CI (A)

`frontend/package.json`:
```json
"scripts": {
  "gen:api": "openapi-typescript ../contract/openapi.json -o src/api/schema.d.ts",
  "check:api": "openapi-typescript ../contract/openapi.json -o src/api/schema.d.ts --check"
},
"overrides": { "openapi-typescript": { "typescript": "$typescript" } }
```
The `overrides` entry is required: openapi-typescript 7.13.0 declares `peer typescript ^5.x` and the repo is on
TS 6.0.3 (ERESOLVE otherwise; generation verified to work with TS 6). Add the override **before** installing.

`.github/workflows/tests.yml`, frontend job, right after "Install dependencies":
```yaml
      - name: Generated API types are up to date
        run: npm run check:api
```
`frontend/eslint.config.js`: add `'src/api/schema.d.ts'` to `globalIgnores`.

### 1.8 Dependencies (A; exact install commands, from `frontend/`)

All versions exist and were published at least ~2 weeks before 21 Nov 2026; the lockfile pins them.
```
npm pkg set overrides.openapi-typescript.typescript='$typescript'
npm install react-router@8.5.1 zustand@5.1.0 motion@14.10.1 intl-messageformat@12.1.4 \
            @fontsource-variable/albert-sans@5.3.0 @fontsource-variable/martian-mono@5.3.0
npm install -D openapi-typescript@7.13.0 @axe-core/playwright@4.14.0
```
| Package | Use |
|---|---|
| `react-router` 8.5.1 | `createBrowserRouter`, `RouterProvider`, `NavLink`, `Navigate`, `Outlet`, `useParams`, `useNavigate`, `useLocation`, `createMemoryRouter` (tests) — all verified exported by 8.5.1 |
| `zustand` 5.1.0 | clima store |
| `motion` 14.10.1 | `motion/react`: `motion`, `AnimatePresence`, `MotionConfig`, `useReducedMotion` (SlotEditor) |
| `intl-messageformat` 12.1.4 | ICU messages (`import { IntlMessageFormat } from 'intl-messageformat'`) |
| `@fontsource-variable/albert-sans` 5.3.0 | `import '@fontsource-variable/albert-sans/wght.css'` → family `'Albert Sans Variable'` |
| `@fontsource-variable/martian-mono` 5.3.0 | `import '@fontsource-variable/martian-mono/wght.css'` → family `'Martian Mono Variable'` (wght 100-800) |
| `openapi-typescript` 7.13.0 (dev) | type generation |
| `@axe-core/playwright` 4.14.0 (dev) | axe in e2e |

No data-fetching or chart library: SVG paths are hand-built (ports of NS.js/T.js).

---

## 2. Frontend architecture

### 2.1 Tree (final M1 state)

```
frontend/src/
  main.tsx                         boot: fonts, css, createDataSource(), render <App/>          (B)
  app/
    App.tsx                        providers + RouterProvider                                    (B)
    router.tsx                     createAppRouter(modules) → createBrowserRouter                (B)
    Layout.tsx                     page container, skip link, <Header/>, <main><Outlet/></main>  (B)
    Header.tsx  Header.module.css  logo, module nav (visible modules), date/time + module status  (B)
    modules.ts                     AppModule type + registry list                                (B)
    NotFound.tsx  RouteError.tsx  ErrorView.tsx                                                   (B)
    useNow.ts                      wall clock from the data source                               (B)
    keepSearch.ts                  helpers that preserve ?scenario&source in links/redirects     (B)
    motion.tsx                     AppMotionConfig, usePrefersReducedMotion                      (B)
  modules/
    energia/module.ts  luci/module.ts   hidden modules (visible:false, no routes)                 (B)
    clima/
      module.tsx                   clima AppModule: nav items, routes, HeaderStatus              (B)
      types.ts                     shared UI types (EditorOption, SegmentSelection, OutdoorNow)  (A)
      names.ts                     roomName/systemName/systemShortName/systemLowerName           (B)
      store/climaStore.ts                                                                         (B)
      data/useAsync.ts useRooms.ts useRoomTimeline.ts useOverview.ts                              (B)
      components/                  shared clima UI primitives                                    (B)
        RangeSelector.tsx  SystemStatusLine.tsx  StatusDot.tsx  LegendSwatch.tsx
        NowLine.tsx  ForecastHatch.tsx  AxisLabels.tsx  VisuallyHidden.tsx  components.module.css
      routes/StanzaIndex.tsx       /clima/stanza → redirect to default room                      (B)
      systemKinds/ types.ts radiator.ts ac.ts generic.ts index.ts                                 (C)
      logic/  runs.ts colors.ts summaryFacts.ts editorOptions.ts editorDraft.ts weekProgram.ts
              segments.ts cursor.ts                                                               (C)
      thermogram/ scales.ts paths.ts axis.ts tableRows.ts                                         (C)
      lanes/ ProgramBar.tsx ActionBar.tsx SystemLane.tsx lanes.module.css                         (D)
      screens/Stanza/ StanzaScreen.tsx ... (§7.1)                                                 (D; B creates placeholder)
      screens/Tutte/  TutteScreen.tsx ... (§7.2)                                                  (E; B creates placeholder)
  api/
    schema.d.ts                    generated                                                      (A)
    types.ts                       contract aliases                                               (A)
    datasource/
      types.ts                     DataSource interface, errors, ScenarioId                       (A)
      context.tsx                  DataSourceProvider/useDataSource                               (A)
      index.ts                     createDataSource (A: stub → C: real)                           (C)
      http.ts                      HttpDataSource                                                 (C)
      mock/MockDataSource.ts  mock/clock.ts  mock/aggregate.ts  mock/overrides.ts  mock/programs.ts
      mock/neng/ rng.ts grid.ts outdoor.ts simulate.ts
      mock/scenarios/ types.ts capabilities.ts builders.ts home.ts perSlot.ts readonly.ts
                      noProgram.ts manyRooms.ts index.ts                                          (C)
  lib/time.ts                      tz helpers (Intl-based)                                        (C)
  i18n/index.ts  i18n/format.ts                                                                   (B)
  styles/tokens.css  global.css  motion.css  motion.ts                                            (B)
locales/it.json                    full Italian catalog (§6.4)                                    (B)
```
Deleted in M1 (B): `src/app/VersionStatus.tsx`, `src/api/version.ts`, `src/i18n/it.json`,
`tests/VersionStatus.test.tsx`.

### 2.2 Libraries and conventions

- Styling: **CSS Modules** (`*.module.css`, built into Vite) for components; global `tokens.css`, `global.css`,
  `motion.css`. Inline `style` only for data-driven values (left/width %, colours computed from data, `d`).
- Every colour used in CSS is a token from §7.0; JS-computed colours come from `logic/colors.ts` (`PALETTE`).
- Numbers in the UI use the `num` class (`font-variant-numeric: tabular-nums`); mono text uses the `mono` class.
- Never use the system time zone: always pass `clock.timeZone` (data) or `ds.timeZone` (header).

### 2.3 Foundations written by A (verbatim)

```ts
// src/api/types.ts
import type { components } from './schema';
type Schemas = components['schemas'];
export type ApiError = Schemas['ApiError'];
export type Level = Schemas['Level'];
export type Slot = Schemas['Slot'];
export type WeekDays = Schemas['WeekDays'];
export type Program = Schemas['Program'];
export type ProgramCapabilities = Schemas['ProgramCapabilities'];
export type OverrideCapabilities = Schemas['OverrideCapabilities'];
export type DriverCapabilities = Schemas['DriverCapabilities'];
export type PowerCapabilities = Schemas['PowerCapabilities'];
export type HistoryCapabilities = Schemas['HistoryCapabilities'];
export type OutdoorCapabilities = Schemas['OutdoorCapabilities'];
export type SystemCapabilities = Schemas['SystemCapabilities'];
export type SourceCapabilities = Schemas['SourceCapabilities'];
export type Hysteresis = Schemas['Hysteresis'];
export type OverrideChange = Schemas['OverrideChange'];
export type OverrideCreate = Schemas['OverrideCreate'];
export type Override = Schemas['Override'];
export type ClockInfo = Schemas['ClockInfo'];
export type TimeGrid = Schemas['TimeGrid'];
export type RoomView = Schemas['RoomView'];
export type AdapterTypes = Schemas['AdapterTypes'];
export type SystemState = Schemas['SystemState'];
export type SystemView = Schemas['SystemView'];
export type SystemStatus = Schemas['SystemStatus'];
export type RoomStatus = Schemas['RoomStatus'];
export type RoomClimateSeries = Schemas['RoomClimateSeries'];
export type TargetSeries = Schemas['TargetSeries'];
export type ProgramSegment = Schemas['ProgramSegment'];
export type NextProgramChange = Schemas['NextProgramChange'];
export type SystemSeries = Schemas['SystemSeries'];
export type SystemLane = Schemas['SystemLane'];
export type OutdoorSeries = Schemas['OutdoorSeries'];
export type PowerSummary = Schemas['PowerSummary'];
export type RoomTimeline = Schemas['RoomTimeline'];
export type OverviewRow = Schemas['OverviewRow'];
export type ClimaOverview = Schemas['ClimaOverview'];

export type TimeRange = TimeGrid['range'];
export type Weekday = keyof WeekDays;
export type Mode = NonNullable<SystemState['mode']>;
export type Action = NonNullable<SystemState['action']>;
export type ProgramRepresentation = Program['representation'];
export type OverrideScope = Override['scope'];
export type TemporaryOverrideScope = OverrideCapabilities['scopes'][number];
export type SegmentState = ProgramSegment['state'];
export type SystemBehavior = SystemView['behavior'];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const satisfies readonly Weekday[];
export const TIME_RANGES = ['24h', '7d'] as const satisfies readonly TimeRange[];
```

```ts
// src/api/datasource/types.ts
import type { ClimaOverview, Override, OverrideCreate, RoomTimeline, RoomView, TimeRange } from '../types';

export type DataSourceKind = 'mock' | 'http';
export type ScenarioId = 'home' | 'perSlot' | 'readonly' | 'noProgram' | 'manyRooms';
export const SCENARIO_IDS = ['home', 'perSlot', 'readonly', 'noProgram', 'manyRooms'] as const satisfies readonly ScenarioId[];
export const DEFAULT_SCENARIO: ScenarioId = 'home';

export type DataSourceErrorCode = 'no_data_source' | 'not_found' | 'invalid_change' | 'network' | 'unexpected';
export class DataSourceError extends Error {
  readonly code: DataSourceErrorCode;
  readonly status: number | null;
  constructor(code: DataSourceErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'DataSourceError';
    this.code = code;
    this.status = status;
  }
}

export interface RoomTimelineQuery {
  roomId: string;
  range: TimeRange;
  /** Editor draft to preview (mock: applied like a committed override, not stored). http ignores it in M1. */
  draft?: OverrideCreate | null;
}
export interface OverviewQuery { range: TimeRange }

export interface DataSource {
  readonly kind: DataSourceKind;
  readonly scenario: ScenarioId | null;      // null for http
  /** IANA zone for wall-clock display (mock: 'Europe/Rome'). Data formatting uses clock.timeZone. */
  readonly timeZone: string;
  /** Wall clock (mock: fixed 2026-11-20T08:30:00+01:00). */
  now(): Date;
  getRooms(signal?: AbortSignal): Promise<RoomView[]>;
  getRoomTimeline(query: RoomTimelineQuery, signal?: AbortSignal): Promise<RoomTimeline>;
  getOverview(query: OverviewQuery, signal?: AbortSignal): Promise<ClimaOverview>;
  createOverride(body: OverrideCreate): Promise<Override>;
  deleteOverride(overrideId: string): Promise<void>;
  /** Called after any change to stored data (create/delete override). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
```

```tsx
// src/api/datasource/context.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { DataSource } from './types';
const DataSourceContext = createContext<DataSource | null>(null);
export function DataSourceProvider({ value, children }: { value: DataSource; children: ReactNode }) {
  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useDataSource(): DataSource {
  const ds = useContext(DataSourceContext);
  if (!ds) throw new Error('useDataSource() used outside <DataSourceProvider>');
  return ds;
}
```

```ts
// src/api/datasource/index.ts  (A writes this stub; C replaces the body, keeping the signature)
import type { DataSource } from './types';
export function createDataSource(search: string = window.location.search): DataSource {
  void search;
  throw new Error('createDataSource: implemented by M1 task C');
}
```

```ts
// src/modules/clima/types.ts
import type { SegmentState, Weekday } from '../../api/types';
export type EditorOption = 'slot' | 'permanentValue' | 'permanentTimes';
export interface SegmentSelection {
  systemId: string;
  segmentKey: string;
  slotRef: string;
  day: Weekday;
  state: Exclude<SegmentState, 'past'>;
}
export interface OutdoorNow { temperatureC: number | null; humidityPct: number | null }
```

---

## 3. DataSource behaviour (C)

### 3.1 Selection (`src/api/datasource/index.ts`)

```ts
export interface DataSourceParams { source: DataSourceKind; scenario: ScenarioId; warnings: string[] }
export function parseDataSourceParams(search: string, envDefault?: string): DataSourceParams;
export function createDataSource(search: string = window.location.search): DataSource;
```
- `source`: `?source=http` → `'http'`; `?source=mock` → `'mock'`; else `import.meta.env.VITE_DATA_SOURCE`
  (`'mock' | 'http'`, unset → `'mock'`). M2 flips the default.
- `scenario`: `?scenario=<id>` if in `SCENARIO_IDS`, else `'home'` and a warning string (logged with
  `console.warn` by `createDataSource`). Ignored for http.
- Called once in `main.tsx`; the instance lives for the page lifetime (scenario changes need a reload).

### 3.2 HttpDataSource (`http.ts`)

`fetch` with `Accept: application/json`, `signal` passed through. Paths: `GET /api/rooms`,
`GET /api/clima/rooms/${encodeURIComponent(roomId)}/timeline?range=${range}`, `GET /api/clima/overview?range=`,
`POST /api/overrides` (JSON body), `DELETE /api/overrides/${id}`. Non-2xx: parse `ApiError` if possible and throw
`DataSourceError` with code: `'no_data_source'` when body.code is that (503), `'not_found'` for 404,
`'invalid_change'` for 409/422, else `'unexpected'`; fetch rejection (not abort) → `'network'`. Abort errors are
re-thrown untouched. `now()` = `new Date()`; `timeZone` = `Intl.DateTimeFormat().resolvedOptions().timeZone`;
`subscribe` keeps listeners and fires them after a successful create/delete; `draft` is ignored.

### 3.3 MockDataSource contract

```ts
export class MockDataSource implements DataSource {
  constructor(scenario: ScenarioId, options?: { now?: string /* ISO */; timeZone?: string })
  // kind 'mock'; scenario; timeZone 'Europe/Rome'; now() → new Date(MOCK_NOW_ISO)
}
// mock/clock.ts
export const MOCK_NOW_ISO = '2026-11-20T08:30:00+01:00';
export const MOCK_TIME_ZONE = 'Europe/Rome';
```
- All methods resolve asynchronously (`await Promise.resolve()` first) and honour `signal` (reject with
  `DOMException('Aborted','AbortError')` if aborted). Results are deep-frozen-safe plain objects (no shared
  mutable references between calls).
- `getRooms()` → `RoomView[]` in config order.
- `getRoomTimeline({roomId, range, draft})`: unknown id → `DataSourceError('not_found')`. Computes (with caching
  keyed by `range + overridesVersion + JSON(draft)`) the simulation of every sensor room for that range with
  committed overrides **plus the draft**, and builds the aggregate (§4.6).
- `getOverview({range})`: same simulation without draft.
- `createOverride(body)`: validates (§4.7); invalid → `DataSourceError('invalid_change', ...)`. Replaces an
  existing committed override with the same `(systemId, day, slotRef, scope)`; returns the stored `Override`
  (`id` = `ovr-<n>` incrementing, `status: 'active'`, `validFrom` = `grid now` ISO, `validUntil` = end of the
  current occurrence for `slot`, `null` otherwise); bumps `overridesVersion`; notifies subscribers.
- `deleteOverride(id)`: unknown → `not_found`; removes; bumps version; notifies.
- State (overrides) lives in the instance only; a reload resets it.

### 3.4 Editor flow (how drafts recompute the forecast)

1. Click an editable segment → `store.select(selection)`; editor opens with the default option (§5.6).
2. Each ±/time step builds an `OverrideCreate` with `logic/editorDraft.ts` and calls `store.setDraft(draft)`
   (a draft equal to the programmed value/times is stored as `null`).
3. `useRoomTimeline(roomId, range, draft)` refetches `getRoomTimeline({..., draft})`; the mock applies the draft to
   samples `k >= nowIndex` (past unchanged), so measured/forecast/actions/segments update immediately, like the
   mockup. Previous data stays on screen while the new one loads (path morph).
4. "Fatto": if a draft exists → `ds.createOverride(draft)`; then `store.closeEditor()`. Subscribers (all hooks)
   refetch, so Tutte also reflects the change.
5. "Ripristina": if a draft exists → `setDraft(null)`; else if the selected segment has `overrideId` →
   `ds.deleteOverride(overrideId)`. Editor stays open.
6. Esc / clicking the selected segment again / changing room or range → `closeEditor()` (draft discarded).

---

## 4. MockDataSource: faithful port of Neng.js (C)

### 4.1 Grid (`mock/neng/grid.ts`)

```ts
export interface MockGrid {
  range: TimeRange; count: number; nowIndex: number; stepMinutes: 30;
  startMs: number;                 // epoch ms of sample 0
  warmup: 96;                      // samples simulated before sample 0
  /** epoch ms of sample k, k in [-96, count) */ msAt(k: number): number;
}
export function buildGrid(range: TimeRange, nowIso: string): MockGrid;
```
Port of `setRange`: 24h → PAST 48, FUT 4 (count 52, nowIndex 48); 7d → PAST 336, FUT 24 (count 360, nowIndex
336). `msAt(k) = nowMs + (k - nowIndex) * 30 min`. Sample 0 for 24h = 2026-11-19T08:30+01:00; for 7d =
2026-11-13T08:30+01:00. Grid ISO strings via `isoWithOffset(ms, tz)` (§4.9).

Local time helpers per sample (from `lib/time.ts`): `h(k)` = local hour + minute/60 (exactly the mockup's
`hAt(k)`, values are multiples of 0.5), `weekday(k)`, `dayOffset(k)` = local calendar days between sample k and
the local date of now (exactly the mockup's `dAt`).

### 4.2 RNG and outdoor (`mock/neng/rng.ts`, `outdoor.ts`)

```ts
export function rng(seed: number): () => number {   // verbatim port
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
export interface OutdoorSim { T: number[]; H: number[] }   // len == count
export function simulateOutdoor(grid: MockGrid, seed = 77): OutdoorSim;
```
Per range (re-run for each range, like `setRange`), `g = rng(77)`, for i in `[0, count)` in order:
```
t = 6.5 + (d < 0 ? -d * 0.3 : 0) + 4.4 * Math.sin((h - 9) / 24 * 2 * Math.PI) + (i < nowIndex ? (g() - 0.5) * 0.6 : 0)
H = Math.min(97, 90 - (t - 3) * 2.3 + (i < nowIndex ? (g() - 0.5) * 4 : 0))
```
with `h = h(i)`, `d = dayOffset(i)`. Keep the operand order exactly (bitwise parity with the oracle).
`OutdoorSeries`: `measuredC[i] = i <= nowIndex ? T[i] : null`, `forecastC[i] = i >= nowIndex ? T[i] : null`, same for
humidity; `nowC = T[nowIndex]`, `nowHumidityPct = H[nowIndex]`.

### 4.3 Room simulation (`mock/neng/simulate.ts`)

```ts
export interface SimSystemInput {
  def: MockSystemDef;                  // §4.5
  /** effective value at sample k (program + permanent changes + slot overrides + draft; overrides only for k >= nowIndex) */
  valueAt(k: number): { targetC: number | null; on: boolean | null; slot: SlotOccurrence | null; overrideId: string | null; draft: boolean };
}
export interface SlotOccurrence { day: Weekday; ref: string; from: string; to: string; levelId: string | null; startMs: number; endMs: number }
export interface SimSystemOutput {
  systemId: string;
  target: (number | null)[]; action: (Action | null)[]; mode: (Mode | null)[];
  slot: (SlotOccurrence | null)[]; overrideId: (string | null)[]; draft: boolean[];   // all len == count
}
export interface RoomSimOutput { roomId: string; T: number[]; H: number[]; systems: SimSystemOutput[] }
export function simulateRoom(room: MockRoomDef, systems: SimSystemInput[], grid: MockGrid, outdoor: OutdoorSim): RoomSimOutput;
```
Port of `sim(ri, st)`; `systems` are the systems whose **primary room** is this room, in lane order (§5.1).
```
g = rng(room.sensor.seed * 13 + 1); T = null; per-system state: rh=false (always_on_target), ah=false (mode_based)
for k = -96 .. count-1:
  i = max(0, k); h = h(k); fut = k >= nowIndex; to = outdoor.T[i]
  for each system s: (target, on, slot) = valueAt(k)
     always_on_target: rt_s = target (null if no program value and no constantTargetC)
     mode_based:       as_s = (mode == 'off' || target == null) ? null : target
     unknown:          on_s = on === true
  if T == null: T = (first non-null of [rt_s for radiators in order] , then [as_s for mode_based in order]) || 20
       // exactly `rt || as || 20`; use `||` semantics
  always_on_target: if rt != null { if (T < rt - below) rh = true; else if (T > rt + above) rh = false } else rh = false
                    action = rt == null ? null : (rh ? 'heat' : 'idle')
  mode_based:       a = 'off'
                    if as != null:
                       if mode == 'cool': a = T > as + 0.3 ? 'cool' : 'idle'        // ah untouched
                       elif mode == 'dry': a = 'dry'                                // ah untouched
                       else: { if (T < as - below) ah = true; else if (T > as + above) ah = false; a = ah ? 'heat' : 'idle' }
                    else ah = false
                    action = a
  unknown:          action = on_s ? 'dry' : 'off'      // M1 mock rule for unknown kinds (dehumidifier)
  // temperature step: keep this exact accumulation order (bitwise parity with the oracle)
  inc = 0
  for always_on_target systems (lane order): inc += rh_s ? 0.42 : 0
  for mode_based systems (lane order):       inc += a_s === 'heat' ? 0.38 : 0
  for mode_based systems (lane order):       inc -= a_s === 'cool' ? 0.35 : 0
  inc += fut ? 0 : (g() - 0.5) * 0.05
  inc -= (T - (to * 0.35 + 12)) * room.sensor.loss
  T += inc
  // humidity (after the temperature step; g() order: T noise first, then humidity noise)
  hu = room.sensor.humidityBase + 2 * Math.sin((h - 4) / 24 * 2 * Math.PI) + (fut ? 0 : (g() - 0.5) * 1.5)
  if room.sensor.bathroom: { if (h >= 7.5 && h < 8.5) hu += 14 - (h - 7.5) * 6; if (h >= 20 && h < 21) hu += 10 - (h - 20) * 6 }
  for mode_based systems: if a_s === 'heat' hu -= 1.5
  for mode_based and unknown systems: if a_s === 'dry' hu -= 5
  if k >= 0: push T, hu; per system push target (rt/as/null), action, mode (def.mode), slot, overrideId, draft
```
`below`/`above` = the system's `hysteresis` (0.3 / 0.2 everywhere in M1). Effects apply only to the primary room
(M1 simplification). Note `(0 + a) === a`, so this generic loop is bitwise identical to the mockup for one radiator +
one split. The stored T at sample k is the value **after** step k (as in the mockup).

### 4.4 Programs (`mock/programs.ts`)

```ts
export function slotAt(program: Program, weekday: Weekday, minuteOfDay: number): Slot | null;  // slot with from <= m < to
export function levelTarget(program: Program, levelId: string): number;
export function effectiveProgram(base: Program, overrides: StoredChange[]): Program;  // permanent changes applied (version bumped)
export function nextChange(lane: SimSystemOutput & { def: MockSystemDef }, grid: MockGrid, programAfterNow: Program): NextProgramChange | null;
export function isFullCoverage(day: Slot[]): boolean;  // slots contiguous from 00:00 to 24:00
```
Value of a system at sample k (`valueAt`): local weekday/minute of `msAt(k)` → slot of the **base program** for
`k < nowIndex`, of the **effective program** (permanent changes) for `k >= nowIndex`; value = level target
(`levels`), `slot.targetC` (`perSlot`), `slot.on` (`onOff`, target null); no slot → target null (gap). For
`representation 'none'`: `constantTargetC` (or null), no slot. Then, for `k >= nowIndex`, a `slot` override (or
draft) whose `(systemId, day, ref)` matches the occurrence and whose occurrence contains `nowIndex` replaces the target
until the occurrence ends. `overrideId` is set on every sample whose value a committed override changed (permanent
ones included); `draft` likewise for the draft.

`nextChange` (port of `nextChange()` in NS.js, generalised to days): candidates are slot starts and, for
representations with gaps, slot ends, in `(now, now + 24 h]`, read from the effective program (+ slot overrides):
- slot start of a full-coverage program (`levels`/`perSlot`) → `{change: 'target', targetC: value of that slot}`
  (emitted even if the value is unchanged, like the mockup);
- slot start in a gap program → `{change: 'on', targetC}` (`onOff`: targetC null); slot end not followed
  immediately by another slot → `{change: 'off'}`;
- mode_based systems with mode `'off'` produce no candidates; `none` produces none.
Earliest candidate wins; ties keep the first in this order: slot starts of the day in order, then ends.
Expected for `home`: soggiorno split → 08:45 `off`; corridoio → 09:00 `off`; camera → 21:00 target 19.5;
cameretta → 19:00 target 20.0; bagno → 09:00 target 20.0.

### 4.5 Scenario definitions (`mock/scenarios/*`)

```ts
// scenarios/types.ts
export interface MockSensorDef { seed: number; loss: number; humidityBase: number; bathroom: boolean }
export interface MockRoomDef {
  id: string; nameKey: string; sensor: MockSensorDef | null;
  followsRoomId: string | null; displayTargetSystemId: string | null;
}
export type MockBehavior = 'always_on_target' | 'mode_based' | 'unknown';
export interface MockPowerDef { kwActive: number; kwIdle: number; kwhIdlePerSample: number }
export interface MockSystemDef {
  id: string; kind: string; name: string | null; nameKey: string | null;
  roomIds: string[];                      // primary room = first with a sensor
  behavior: MockBehavior;
  hysteresis: { belowC: number; aboveC: number };      // 0.3 / 0.2
  mode: Mode | null;                      // mode_based only
  program: Program;
  constantTargetC: number | null;         // used when program.representation === 'none'
  capabilities: SystemCapabilities;
  adapters: AdapterTypes;
  power: MockPowerDef | null;             // null → power.kind 'none' (not measured)
}
export interface MockScenario {
  id: ScenarioId; rooms: MockRoomDef[]; systems: MockSystemDef[];
  outdoorSeed: 77; tariffPerKwh: 0.28; currency: 'EUR'; month: { kwh: 79; cost: 22.1 };
  sources: SourceCapabilities;            // history {maxLookbackDays: 30, resolutionMin: 30, actionHistory: true}, outdoor {current: true, history: true, forecastHours: 12}
}
export function getScenario(id: ScenarioId): MockScenario;   // scenarios/index.ts; returns a fresh deep copy
```

```ts
// scenarios/builders.ts
export function hm(hours: number): string;   // 8.75 → '08:45', 24 → '24:00'
/** Neng `rad` list [[startHour, targetC], ...] → full-coverage slots of one day; slot k = [start_k, start_{k+1}) (last → 24). */
export function fullDaySlots(day: Weekday, entries: [number, number][], rep: 'levels' | 'perSlot', levelIdOf?: (t: number) => string): Slot[];
/** Neng `ac` list [[from, to, targetC], ...] → slots with gaps. */
export function gapDaySlots(day: Weekday, entries: [number, number, number][], rep: 'levels' | 'perSlot', levelIdOf?: (t: number) => string): Slot[];
export function onOffDaySlots(day: Weekday, entries: [number, number][]): Slot[];   // [from, to] on-slots
export function week(build: (day: Weekday) => Slot[]): WeekDays;
/** Weekend variant used by perSlot: on sat/sun a slot starting at 06:00 starts at 07:30 and the previous slot ends at 07:30. */
export function weekendShift(entries: [number, number][]): [number, number][];
```
Slot `ref` = `${day}-${index}` (index within the day). `Program.version` = `'mock-1'` (bumped on permanent
change). Levels: `{ id, label: null, labelKey: 'mock.level.<id>', targetC }`.

Capability presets (`scenarios/capabilities.ts`):

| Preset | program | override |
|---|---|---|
| `LEVELS_RW` | read, `levels`, writeLevelValues **true**, writeSlotValue false, writeTimes **true**, dayScope `perDay`, minuteStep 30, maxSlotsPerDay 6 | scopes `['slot']`, futureSlots false, step 0.5, min −4, max 4, expiry `external` |
| `PERSLOT_RW` | read, `perSlot`, writeLevelValues false, writeSlotValue **true**, writeTimes **true**, `perDay`, 30, 8 | same as above |
| `LEVELS_RO` | read, `levels`, all writes false, `perDay`, 30, null | scopes `[]`, rest as above |
| `NONE` | read, `none`, all writes false, `all`, 30, null | scopes `[]` |
| `ONOFF_TIMES` | read, `onOff`, writeTimes **true**, others false, `all`, 30, 4 | scopes `[]` |

Drivers: radiator `{modes:['heat'], readsAction:true, readsTarget:true, writesMode:false, writesTarget:true}`;
ac `{modes:['heat','cool','dry','off'], readsAction:true, readsTarget:true, writesMode:true, writesTarget:true}`;
dehumidifier `{modes:['dry','off'], readsAction:true, readsTarget:false, writesMode:false, writesTarget:false}`.
Power capabilities: `power === null` → `{kind:'none', energyTotals:false}`, else `{kind:'estimated', energyTotals:false}`.
Adapters: radiator `{driver:'ha_climate', program:'ha_schedule_levels', override:'climate_direct', power:null}`;
ac same with `power:'estimate'`; perSlot programs `program:'ha_schedule_data'`; none `program:'none', override:'disabled'`;
dehumidifier `{driver:'template', program:'template', override:'disabled', power:null}`.

**Scenario `home`** (the handoff house; rooms in this order):

| Room | nameKey | sensor (seed, loss, humidityBase, bathroom) | systemIds | follows |
|---|---|---|---|---|
| soggiorno | mock.room.soggiorno | 3, 0.032, 47, no | z-soggiorno, ac-soggiorno | |
| corridoio | mock.room.corridoio | 5, 0.03, 49, no | ac-corridoio | |
| camera | mock.room.camera | 13, 0.028, 51, no | z-camera | |
| cameretta | mock.room.cameretta | 17, 0.028, 50, no | z-cameretta | |
| bagno | mock.room.bagno | 19, 0.036, 60, **yes** | z-bagno | |
| ripostiglio | mock.room.ripostiglio | **null** | z-bagno | bagno |

| System | kind | roomIds | behavior | mode | program (same every day, D7) | levels | caps | power |
|---|---|---|---|---|---|---|---|---|
| z-soggiorno | radiator | [soggiorno] | always_on_target | null | full [[0,18.5],[6,21],[23,18.5]] | eco 18.5, comfort 21 | LEVELS_RW | null |
| ac-soggiorno | ac | [soggiorno] | mode_based | heat | gap [[6,8.75,21.5],[16,22,21.5]] | setpoint 21.5 | LEVELS_RW | 0.8 / 0.04 / 0.02 |
| ac-corridoio | ac | [corridoio] | mode_based | heat | gap [[6,9,20.5],[16,23,20.5]] | setpoint 20.5 | LEVELS_RW | 0.5 / 0.04 / 0.02 |
| z-camera | radiator | [camera] | always_on_target | null | full [[0,17.5],[6,20],[8,18],[21,19.5],[23,17.5]] | night 17.5, morning 20, day 18, evening 19.5 | LEVELS_RW | null |
| z-cameretta | radiator | [cameretta] | always_on_target | null | full [[0,18.5],[6,20.5],[8.5,19],[19,20],[23,18.5]] | night 18.5, morning 20.5, day 19, evening 20 | LEVELS_RW | null |
| z-bagno | radiator | [bagno, ripostiglio] | always_on_target | null | full [[0,19],[6,23],[9,20],[18,23],[22,19]] | night 19, comfort 23, day 20 | LEVELS_RW | null |

All systems: `name: null`, `nameKey: null` (display names come from the kind), hysteresis 0.3/0.2,
`constantTargetC: null`. `displayTargetSystemId: null` everywhere (kind priority: radiator first).

**Scenario `perSlot`**: like `home`, but every program is `representation 'perSlot'` (slot `targetC`, no levels),
caps `PERSLOT_RW`, adapters program `ha_schedule_data`, and **sat/sun use `weekendShift`** (radiators) and the
split slots starting at 06:00 start at 07:30 on sat/sun.

**Scenario `readonly`**: identical to `home` with caps `LEVELS_RO` for every system.

**Scenario `noProgram`**: `home` rooms/systems with every program `{representation:'none', levels:null,
days: all empty, version:'mock-1'}`, caps `NONE`; `constantTargetC`: z-soggiorno 20.5, z-camera 19.0,
z-cameretta 19.5, z-bagno 21.0, splits 21.0; **splits have `mode: 'off'`** (action `off` everywhere).

**Scenario `manyRooms`** (10 rooms, 8 with sensor):

| Room | sensor | systemIds | notes |
|---|---|---|---|
| soggiorno | 3, 0.032, 47, no | z-soggiorno, ac-soggiorno, deum-soggiorno | **3 systems**; `displayTargetSystemId: 'ac-soggiorno'` |
| cucina | 23, 0.03, 55, no | z-cucina | |
| corridoio | 5, 0.03, 49, no | ac-corridoio | |
| camera | 13, 0.028, 51, no | z-camera | |
| cameretta | 17, 0.028, 50, no | z-cameretta | |
| studio | 29, 0.03, 48, no | z-studio | |
| bagno | 19, 0.036, 60, yes | z-bagno | |
| ripostiglio | null | z-bagno | follows bagno |
| bagno2 | 31, 0.036, 58, yes | z-bagno2 | |
| lavanderia | null | z-bagno2 | follows bagno2 |

New systems: `deum-soggiorno` kind **`dehumidifier`** (no frontend kind spec → generic), nameKey
`mock.system.dehumidifier`, behavior `unknown`, mode null, program `onOff` every day on 10:00-12:00 and 14:00-18:00,
caps `ONOFF_TIMES`, power null; `z-cucina` radiator levels eco 18.5 / comfort 20.5, full [[0,18.5],[6.5,20.5],[21.5,18.5]],
LEVELS_RW; `z-studio` radiator perSlot full [[0,18],[8,20.5],[13,19.5],[14,20.5],[19,18]], PERSLOT_RW;
`z-bagno2` radiator levels night 19 / comfort 22, full [[0,19],[6,22],[8,19],[19,22],[21,19]], roomIds
[bagno2, lavanderia], **LEVELS_RO**. Other systems as in `home`. Same program every day.

### 4.6 Aggregate building (`mock/aggregate.ts`)

```ts
export function buildRoomTimeline(ctx: MockContext, roomId: string): RoomTimeline;
export function buildOverview(ctx: MockContext): ClimaOverview;
interface MockContext { scenario: MockScenario; grid: MockGrid; outdoor: OutdoorSim; sims: Map<string, RoomSimOutput>;
                        overrides: StoredChange[]; draft: OverrideCreate | null; power: PowerSummary /* from 24h sims, §4.8 */ }
```
- `clock` = `{ now: MOCK_NOW_ISO, timeZone: 'Europe/Rome' }`; `grid` from §4.1 (`t` ISO strings, `end`).
- `RoomView` from `MockRoomDef` (`hasSensor = sensor != null`, `systemIds` = systems whose roomIds include it, config order).
- `climate` for a sensor room from its `RoomSimOutput` (§1.4 split rules on `nowIndex`).
- `target`: per sample, candidate systems serving the room ordered by: `displayTargetSystemId` first, then kind
  priority `radiator 0, ac 10, other 50`, then config order; pick the first with non-null `target[i]`;
  `comfortLowC = t - belowC`, `comfortHighC = t + aboveC` (computed as `t + 0.2`, `t - 0.3`), `sourceSystemIds[i]`.
- `lanes` (systems serving the room, ordered by kind priority then config order): `SystemSeries` arrays from the
  primary room's sim; `segments` from §5.3 `buildSegments`; `representation`; `nextChange` (§4.4).
- `systems`: `SystemView` (program = effective program, state at nowIndex, capabilities, adapters, hysteresis,
  behavior, primaryRoomId).
- `rooms`: `RoomStatus` for every room: temperature/humidity at nowIndex (null without sensor), `systems`: one
  `SystemStatus` per system serving the room, `viaRoomId` = primary room id when it differs from this room.
- `overrides`: committed overrides for the room's systems. `outdoor` §4.2. `power` §4.8. `sources` from scenario.
- Overview rows: one per room, config order; `climate`/`target` null without sensor; `systems` = `SystemSeries`
  of every serving system (shared zone included).

### 4.7 Stored changes and validation (`mock/overrides.ts`)

```ts
export interface StoredChange { override: Override; body: OverrideCreate }
export function validateChange(body: OverrideCreate, sys: MockSystemDef, program: Program, grid: MockGrid): string | null; // error message or null
export function applyPermanent(program: Program, change: OverrideCreate, sys: MockSystemDef): Program;
```
Validation (mirrors the editor matrix, so the editor can never produce an invalid draft):
- `slot`: `'slot' ∈ caps.override.scopes`; the occurrence `(day, slotRef)` contains `nowIndex`; `targetC` within
  `[programmed + minDelta, programmed + maxDelta]` and a multiple of `step` from the programmed value.
- `permanentValue`: levels → `writeLevelValues`, `levelValueC` within level target ± bounds; perSlot →
  `writeSlotValue`, `targetC` within slot target ± bounds; slot not past.
- `permanentTimes`: `writeTimes`; `from`/`to` multiples of `minuteStep`; `from < to`; full-coverage day: the slot keeps
  at least `minuteStep` and does not swallow neighbours (`from > prev.from`, `to < next.to`, first slot from stays
  00:00, last slot to stays 24:00) and neighbours are adjusted (`prev.to = from`, `next.from = to`); gap day: no
  overlap with neighbours. Applies to `change.days ?? [day]` (dayScope `all` → all 7 days).
- `until` is not offered in M1 → rejected.
Permanent changes affect samples `k >= nowIndex` only (via the effective program); `SystemView.program` returns the
effective program; `Program.version` becomes `mock-<n+1>`.

### 4.8 Power (`PowerSummary`, always from the **24h** simulation, D8)

Port of the mockup's energy block. Systems with `power != null`, config order; for each, samples `z` ascending:
```
kwh += (a === 'heat' || a === 'cool' || a === 'dry') ? kwActive * 0.5 : a === 'idle' ? kwhIdlePerSample : 0   for z < nowIndex
kwNow += (a === 'heat' || a === 'cool' || a === 'dry') ? kwActive : a === 'idle' ? kwIdle : 0               at z = nowIndex
```
(the mockup only knows heat/cool; `dry` never occurs in `home`). `last24hCost = kwh * 0.28`; `monthKwh 79`,
`monthCost 22.1`, `month = 11`, `currency 'EUR'`, `tariffPerKwh 0.28`, `kind`: all estimated → `'estimated'`,
none measured → `'none'`; `unmeasuredKinds` = distinct kinds with `power == null` (home: `['radiator']`).
Expected home: now 1,3 kW, 8,8 kWh, ≈ € 2,5.

### 4.9 Time helpers (`src/lib/time.ts`, C)

```ts
export interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: Weekday }
export function localParts(epochMs: number, timeZone: string): LocalParts;     // cached Intl.DateTimeFormat('en-GB', {hourCycle:'h23', ...})
export function isoWithOffset(epochMs: number, timeZone: string): string;      // '2026-11-20T08:30:00+01:00'
export function parseIso(iso: string): number;                                 // Date.parse
export function hourOfDay(parts: LocalParts): number;                          // hour + minute / 60
export function minuteOfDay(parts: LocalParts): number;
export function localDayIndex(parts: LocalParts): number;                      // days since 1970-01-01 of the local date
export function hhmmToMinutes(v: string): number; export function minutesToHhmm(m: number): string; // 1440 ↔ '24:00'
```

---

## 5. Pure logic modules (C)

### 5.1 `systemKinds/`

```ts
// systemKinds/types.ts
export interface SystemKindSpec {
  kind: string;                          // 'radiator' | 'ac' | '*'
  messageKind: 'radiator' | 'ac' | 'generic';   // suffix for kind.* and clima.summary.* message keys
  dotShape: 'square' | 'round';          // square = border-radius 2px, round = 50%
  laneOrder: number;                     // radiator 0, ac 10, generic 50 (client sort, stable)
  programFill(seg: { targetC: number | null; on: boolean | null }): string;   // CSS background
  weekBar: 'full' | 'thin';              // 18px coloured bar with values | 8px bar
  showProgramValue: boolean;             // radiator/ac/generic: true when targetC != null
}
// radiator.ts: messageKind 'radiator', square, 0, programFill = radiatorColor(targetC) (transparent if null), weekBar 'full'
// ac.ts:       messageKind 'ac', round, 10, programFill = PALETTE.acProg when targetC != null or on, else 'transparent', weekBar 'thin'
// generic.ts:  kind '*', messageKind 'generic', round, 50, programFill = PALETTE.acProg when targetC != null or on === true, weekBar 'thin'
// index.ts
export function kindSpec(kind: string): SystemKindSpec;                // unknown → generic
export function sortByLaneOrder<T extends { kind: string }>(items: readonly T[]): T[];   // stable
```

### 5.2 `logic/colors.ts`

```ts
export const PALETTE = {
  bg: '#0E1215', panel: '#151A1E', panel2: '#1E252A', lane: '#1A2025', outBg: '#12171A', grid: '#1F262B',
  border: '#2A333A', border2: '#2E383F', text: '#EEF2F4', text2: '#C9D1D6', muted: '#98A3AB',
  heat: '#FF8A4C', target: '#FFB07A', cool: '#4FB3FF', hum: '#59D3B4', dry: '#59D3B4', out: '#8EA2FF',
  outHum: '#7FD8C8', acProg: '#2E4A66', radLo: '#3A5A8C', radHi: '#C2622E', idleA: '#46525B', idleB: '#2A333A',
  dotIdle: '#6A767F',
} as const;
export const IDLE_PATTERN = 'repeating-linear-gradient(135deg,#46525B 0 3px,#2A333A 3px 6px)';
export function mix(a: string, b: string, t: number): string;   // verbatim port: clamps t, returns 'rgb(r,g,b)'
export function radiatorColor(targetC: number): string;          // mix(radLo, radHi, (targetC - 17) / 6)
export function actionFill(a: Action | null): string;            // heat|cool|dry colours, idle IDLE_PATTERN, off/null 'transparent'
export function actionTextColor(a: Action | null): string;       // heat|cool|dry colours, else muted
export function actionDotColor(a: Action | null): string;        // heat|cool|dry colours, else dotIdle
export function isActive(a: Action | null): boolean;             // heat | cool | dry (pulse ring)
```
Expected: `radiatorColor(21) === 'rgb(149,95,77)'`, `radiatorColor(18.5) === 'rgb(92,92,117)'`, clamp below 17 /
above 23.

### 5.3 `logic/runs.ts` and `logic/segments.ts`

```ts
export interface Run<V> { value: V; start: number; end: number }          // [start, end)
export function runs<V>(n: number, key: (i: number) => V, eq?: (a: V, b: V) => boolean): Run<V>[];  // port of runs()
export interface ActionRun { action: Action | null; start: number; end: number; forecast: boolean }
/** Runs keyed by (action, i < nowIndex): split at nowIndex like the mockup; forecast = start >= nowIndex. */
export function actionRuns(actions: readonly (Action | null)[], nowIndex: number): ActionRun[];
export function boxPct(start: number, end: number, count: number): { left: number; width: number };  // percent
// segments.ts (used by the mock to build ProgramSegment[]; pure)
export function buildSegments(input: {
  systemId: string; count: number; nowIndex: number; t: readonly string[]; end: string;
  slot: readonly (SlotOccurrence | null)[]; target: readonly (number | null)[]; on: readonly (boolean | null)[];
  programmedTarget: readonly (number | null)[]; overrideId: readonly (string | null)[]; draft: readonly boolean[];
}): ProgramSegment[];
```
Segment key per sample: gap → `'gap'` (consecutive gaps merge across days, like `-1|x`); else
`${day}|${ref}|${value}` with value = `targetC.toFixed(2)` or `on`. Each run → one `ProgramSegment` (state,
`edited = (any overrideId or draft in run) && state !== 'past'`, `overrideId` = first non-null). `SlotOccurrence`
moves from the mock to `logic/segments.ts` as an exported type (the mock imports it).

### 5.4 `thermogram/scales.ts`, `paths.ts`, `axis.ts`, `tableRows.ts`

```ts
// scales.ts (verbatim constants)
export const VIEW_W = 1000;
export const ROOM_H = 260; export const OUT_H = 80; export const MINI_H = 80; export const TUTTE_OUT_H = 60;
export const yRoomT = (v: number) => 252 - (v - 14) / 11 * 244;   // 14-25 °C
export const yRoomH = (v: number) => 252 - (v - 30) / 50 * 244;   // 30-80 %
export const yOutT = (v: number) => 74 - v / 15 * 68;              // 0-15 °C
export const yOutH = (v: number) => 76 - (v - 50) / 50 * 72;       // 50-100 %
export const yMiniT = (v: number) => 76 - (v - 15) / 9 * 72;       // Tutte 15-24 °C
export const yTutteOutT = (v: number) => 56 - v / 15 * 50;
export const yTutteOutH = (v: number) => 58 - (v - 50) / 50 * 54;
export const ROOM_TICKS = [24, 22, 20, 18, 16] as const;
export const tickTopPct = (v: number) => yRoomT(v) / ROOM_H * 100;  // render with toFixed(2)
export const xCenter = (i: number, n: number) => (i + 0.5) / n * VIEW_W;   // X(i)
export const xEdge = (i: number, n: number) => i / n * VIEW_W;
export const nowPct = (nowIndex: number, n: number) => (nowIndex + 0.5) / n * 100;
export const SEGMENT_LABEL_MIN_WIDTH_PCT: Record<TimeRange, number> = { '24h': 6, '7d': 2.2 };  // label if width > min
export const TOOLTIP_FLIP_AT = 0.6;

// paths.ts — numbers formatted with toFixed(1), commands concatenated exactly like NS.js/T.js
export function polyline(values: readonly (number | null)[], y: (v: number) => number, from: number, to: number): string;
//   for i in [from, to]: value null → break (next non-null starts with 'M'); first point 'M', then 'L'; `${cmd}${xCenter} ${y}`
export function areaUnder(line: string, lastIndex: number, firstIndex: number, n: number, baseY: number): string;
//   line + 'L' + xCenter(lastIndex) + ' ' + baseY + 'L' + xCenter(firstIndex) + ' ' + baseY + 'Z'
export function stepPath(values: readonly (number | null)[], y: (v: number) => number): string;            // target (tgt)
export function bandPath(lo: readonly (number | null)[], hi: readonly (number | null)[], y: (v: number) => number): string;
export function combine(a: readonly (number | null)[], b: readonly (number | null)[]): (number | null)[];  // a[i] ?? b[i]
export interface RoomChartPaths { past: string; forecast: string; humidityLine: string; humidityArea: string; target: string; band: string }
export function roomChartPaths(climate: RoomClimateSeries, target: TargetSeries, nowIndex: number): RoomChartPaths;
export interface OutdoorChartPaths { temperature: string; humidity: string; humidityArea: string }
export function outdoorChartPaths(outdoor: OutdoorSeries, variant: 'stanza' | 'tutte'): OutdoorChartPaths;  // tutte: humidityArea ''
export interface MiniChartPaths { past: string; forecast: string; target: string; band: string }
export function miniChartPaths(climate: RoomClimateSeries, target: TargetSeries, nowIndex: number): MiniChartPaths;
```
Exact construction (from NS.js): `past = polyline(measured, yRoomT, 0, nowIndex)`; `forecast` = points
`nowIndex..n-1` of `forecastC` with `M` at `nowIndex`; `humidityLine = polyline(combine(measuredH, forecastH), yRoomH, 0, n-1)`;
`humidityArea = humidityLine + 'L' + X(n-1) + ' 260L' + X(0) + ' 260Z'` (note: `X()` returns `toFixed(1)`
strings, baseline written as the integer `260`/`80`); `stepPath`: for q in 0..n-1 with v != null:
`(open ? 'L' : 'M') + xEdge(q).toFixed(1) + ' ' + y(v).toFixed(1) + 'L' + xEdge(q+1).toFixed(1) + ' ' + y(v).toFixed(1)`;
`bandPath`: for each maximal run of non-null samples: top edge over `hi` (`M` first, then `L`, two points per
sample at xEdge(k), xEdge(k+1)), then the bottom edge over `lo` in reverse order (`L` xEdge(k+1), `L` xEdge(k)), then
`Z`. Outdoor (stanza): `yOutT`/`yOutH` over `combine(measured, forecast)`, area to `80`; tutte: `yTutteOutT/H`, no area.

```ts
// axis.ts — port of the xl loop; text is produced by the UI from `iso`
export interface AxisTick { index: number; iso: string; leftPct: number; kind: 'now' | 'hour' | 'day' }
export function axisTicks(grid: TimeGrid, timeZone: string): AxisTick[];
//  first: {kind:'now', index: nowIndex, leftPct: nowPct}; then for k in 0..n-1 with pos=(k+0.5)/n*100 and
//  |pos - Number(nowPct.toFixed(2))| < 5 → skip; 24h: minute == 0 && hour % 4 == 0 → {kind:'hour', leftPct: pos};
//  7d: hour == 0 && minute == 0 → {kind:'day', leftPct: k/n*100}
// Expected 24h: now@93.27, 12:00@14.42, 16:00@29.81, 20:00@45.19, 00:00@60.58, 04:00@75.96 (toFixed(2)).
// Expected 7d: now@93.47, sab 14@8.61, dom 15@21.94, lun 16@35.28, mar 17@48.61, mer 18@61.94, gio 19@75.28.

// logic/cursor.ts
export function indexFromPointer(clientX: number, rect: { left: number; width: number }, n: number): number; // clamp(floor((x-left)/width*n), 0, n-1)
export type CursorPhase = 'past' | 'now' | 'forecast';
export function cursorPhase(index: number, nowIndex: number): CursorPhase;
export function tooltipOnLeft(index: number, n: number): boolean;     // (index + 0.5) / n > 0.6
export function keyboardStep(key: string, range: TimeRange, shift: boolean): number | 'home' | 'end' | null;
//  ArrowLeft/Right ±1 (Shift: ±2 in 24h = 1 h, ±12 in 7d = 6 h); PageUp/PageDown ∓/±8 (24h) / ∓/±48 (7d); Home/End
export function moveCursor(current: number | null, step: number | 'home' | 'end', nowIndex: number, n: number): number; // null starts at nowIndex

// tableRows.ts — rows of the a11y table
export interface TableRow { index: number; iso: string; phase: CursorPhase; temperatureC: number | null; humidityPct: number | null; targetC: number | null; actions: (Action | null)[] }
export function tableRows(tl: RoomTimeline): TableRow[];   // every sample in 24h, every 4th (2 h) plus nowIndex in 7d
```

### 5.5 `logic/summaryFacts.ts` (HANDOFF §7, generic per kind; i18n-free)

```ts
export interface SummarySystemInput {
  systemId: string; kind: string; displayName: string; behavior: SystemBehavior;
  hysteresis: { belowC: number; aboveC: number }; representation: ProgramRepresentation;
  mode: Mode | null; action: Action | null; targetC: number | null; nextChange: NextProgramChange | null;
}
export interface SummaryInput {
  roomName: string; temperatureC: number | null; humidityPct: number | null;
  outdoorC: number | null; outdoorHumidityPct: number | null;
  systems: SummarySystemInput[];     // lane order
}
export type SystemFactState =
  | { type: 'heatingTowards'; targetC: number | null; overshoot: boolean }
  | { type: 'coolingTowards'; targetC: number | null }
  | { type: 'drying' }
  | { type: 'aboveTarget'; targetC: number }
  | { type: 'inRange'; temperatureC: number; lowC: number; highC: number }
  | { type: 'standby'; targetC: number | null }
  | { type: 'notScheduled' }
  | { type: 'off' }
  | { type: 'unknown' };
export interface SystemFact { systemId: string; kind: string; messageKind: 'radiator' | 'ac' | 'generic'; displayName: string; state: SystemFactState }
export interface NextChangeFact { systemId: string; kind: string; messageKind: 'radiator' | 'ac' | 'generic'; displayName: string; at: string; change: 'target' | 'on' | 'off'; targetC: number | null }
export interface SummaryFacts {
  lead: { roomName: string; temperatureC: number | null };
  systems: SystemFact[];
  next: NextChangeFact | null;
  conditions: { humidityPct: number | null; outdoorC: number | null; outdoorHumidityPct: number | null };
}
export function summaryInputFromTimeline(tl: RoomTimeline, names: { room: (r: RoomView) => string; system: (s: SystemView) => string }): SummaryInput;
//   values at grid.nowIndex: temperature = climate.measuredC[now], humidity likewise; system mode/action/target from lanes[i] arrays
export function summaryFacts(input: SummaryInput): SummaryFacts;
```
Rules (T = temperatureC, t = targetC, hi = t + aboveC, lo = t − belowC):
- `always_on_target`: t null → `unknown`; action `heat` → `heatingTowards(t, overshoot: T > hi)`; else T > hi →
  `aboveTarget(t)`; else `inRange(T, lo, hi)` (mirrors NS.js; T null → `unknown`).
- `mode_based`: mode `off` → `off`; t null → `notScheduled`; action heat → `heatingTowards(t, false)`; cool →
  `coolingTowards(t)`; dry → `drying`; else → `standby(t)`.
- `unknown`/`thermostatic`: action heat → `heatingTowards(t, false)`; cool → `coolingTowards`; dry → `drying`;
  idle → `standby(t)`; off → representation ≠ none && t == null && the system has a program → `notScheduled`, else `off`;
  null → `unknown`.
- `next`: earliest `nextChange.at` over systems (ties: first in lane order).

### 5.6 `logic/editorOptions.ts` (capabilities → editor matrix, plan §2)

```ts
export type NotEditableReason = 'past' | 'gap' | 'noProgram' | 'readonly';
export interface EditorAvailability { clickable: boolean; options: EditorOption[]; defaultOption: EditorOption | null; levelsWarning: boolean; reason: NotEditableReason | null }
export function editorAvailability(seg: ProgramSegment, caps: SystemCapabilities, representation: ProgramRepresentation): EditorAvailability;
```
1. `representation === 'none'` or `!caps.program.read` → not clickable, `noProgram`.
2. `seg.slotRef == null` → not clickable, `gap`.
3. `seg.state === 'past'` → not clickable, `past` (ended slots are never clickable).
4. options, in this order:
   - `'slot'` iff `caps.override.scopes.includes('slot')` **and** `seg.state === 'current'` and representation ≠ `onOff`;
   - `'permanentValue'` iff (`levels` && `writeLevelValues`) || (`perSlot` && `writeSlotValue`);
   - `'permanentTimes'` iff `writeTimes`.
5. no option → not clickable, `readonly`. `defaultOption` = first option. `levelsWarning` = representation `levels`
   and options include `permanentValue`.
Future slots therefore never get `'slot'` (`futureSlots` is ignored in M1, D10).

### 5.7 `logic/editorDraft.ts`

```ts
export interface DraftContext { segment: ProgramSegment; system: SystemView; programmedC: number | null }
export function valueBounds(programmedC: number, caps: OverrideCapabilities): { min: number; max: number; step: number };
export function stepValue(current: number, delta: number, bounds: { min: number; max: number; step: number }): number; // clamp, round to step
export function timeBounds(program: Program, day: Weekday, slotRef: string, minuteStep: number): { fromMin: number; fromMax: number; toMin: number; toMax: number; fixedFrom: boolean; fixedTo: boolean };
export function draftForValue(ctx: DraftContext, option: 'slot' | 'permanentValue', valueC: number): OverrideCreate | null;
//   null when valueC === programmed; slot → change.targetC; permanentValue levels → change.levelValueC (level of the slot), perSlot → change.targetC
export function draftForTimes(ctx: DraftContext, from: string, to: string): OverrideCreate | null;
//   null when unchanged; change {from, to, days: dayScope === 'all' ? WEEKDAYS : [day]}
export function currentDraftValue(ctx: DraftContext, draft: OverrideCreate | null): number;   // what the editor shows
```
`programmedC` for permanentValue on levels = level target; for slot/perSlot = `seg.programmedTargetC`.
All OverrideChange fields not used are `null` (the contract has no optional fields).

### 5.8 `logic/weekProgram.ts`

```ts
export interface WeekBarSlot { leftPct: number; widthPct: number; fill: string; valueC: number | null; showValue: boolean }
export interface WeekRow { day: Weekday; isToday: boolean; bars: Array<{ systemId: string; kind: string; variant: 'full' | 'thin'; slots: WeekBarSlot[] }> }
export function weekRows(systems: SystemView[], todayIso: string, timeZone: string): WeekRow[];
// rows mon..sun; per system with program (representation ≠ none): slots from program.days[day];
// left = from/1440*100, width = (to-from)/1440*100; value = level target / slot target / null;
// full: fill = kindSpec.programFill, showValue = duration >= 180 min; thin: fill acProg, only slots with value or on.
```

### 5.9 Store (B) `src/modules/clima/store/climaStore.ts`

```ts
import { create } from 'zustand';
export interface ClimaState {
  range: TimeRange;                       // default '24h'; shared by Stanza and Tutte
  lastRoomId: string | null;              // last room shown in Stanza (header link)
  cursorIndex: number | null;             // hovered/keyboard sample; null = none (readouts show nowIndex)
  selection: SegmentSelection | null;     // open editor
  editorOption: EditorOption | null;
  draft: OverrideCreate | null;
  outdoorNow: OutdoorNow | null;          // for the header status
  setRange(range: TimeRange): void;       // also cursorIndex = null, closeEditor()
  setLastRoom(roomId: string): void;      // when it changes: cursorIndex = null, closeEditor()
  setCursor(index: number | null): void;
  select(selection: SegmentSelection | null, option: EditorOption | null): void;   // draft = null
  setEditorOption(option: EditorOption): void;   // draft = null
  setDraft(draft: OverrideCreate | null): void;
  closeEditor(): void;                    // selection, editorOption, draft = null
  setOutdoorNow(value: OutdoorNow | null): void;
}
export const useClimaStore = create<ClimaState>()((set) => ({ ... }));
export function resetClimaStore(): void;   // tests
```
Room id is in the URL (`/clima/stanza/:roomId`), not the store.

---

## 6. i18n (B)

### 6.1 Runtime (`src/i18n/index.ts`)

```ts
import catalog from '../../../locales/it.json';
export type Catalog = typeof catalog;
export type MessageKey = Exclude<keyof Catalog, 'meta'>;
export type MessageValues = Record<string, string | number | boolean | null | undefined>;
export const locale = 'it';
export const intlLocale = 'it-IT';
export function t(key: MessageKey, values?: MessageValues): string;
/** Per-kind/dynamic keys: tries `key`, then `fallback`. */
export function tDynamic(key: string, fallback: MessageKey, values?: MessageValues): string;
export function hasMessage(key: string): boolean;
```
- `IntlMessageFormat` instances compiled lazily and cached per key (`new IntlMessageFormat(msg, intlLocale)`).
- Formatting errors (missing argument) throw when `import.meta.env.DEV || import.meta.env.MODE === 'test'`; in
  production log `console.error` and return the key.
- Boolean `select` values are passed as strings by callers (`overshoot: 'true'`) — `t()` converts booleans with `String()`.
- Numbers shown with decimals are **pre-formatted strings** (§6.2) passed as arguments; ICU `plural` gets numbers.
- Apostrophes in messages: use the typographic `’` (ICU treats `'` specially).

### 6.2 Formatting (`src/i18n/format.ts`)

```ts
export const fmt = {
  temp(v: number): string;          // 1 decimal, comma: 21.8 → '21,8' (Intl.NumberFormat it-IT, min=max=1 fraction digits)
  decimal(v: number, digits: number): string;
  pct(v: number): string;           // 0 decimals: 47.4 → '47'
  time(iso: string, tz: string): string;         // 'HH:mm', hourCycle h23 → '08:30'
  slotTime(hhmm: string): string;                // '24:00' → '00:00' (mockup), else unchanged
  dayLabel(iso: string, tz: string): string;     // t('clima.axis.day', {weekday, day}) → 'sab 14' (weekday short, lowercase as Intl gives)
  headerDate(date: Date, tz: string): string;    // 'ven 20 nov' (weekday short, day numeric, month short)
  monthName(month: number): string;              // 11 → 'Novembre' (Intl long, first letter upper-cased with toLocaleUpperCase)
  weekdayShort(day: Weekday): string;            // t('common.weekday.<day>') → 'Lun'
};
```
`Intl.NumberFormat` rounding equals the mockup's `toFixed` for these values (checked).

### 6.3 Files and wiring

- Source of truth: `locales/it.json` (flat, `meta` + keys). The frontend imports it with a relative import from
  `src/i18n/index.ts`; `vite.config.ts` gets
  `server: { fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../locales', import.meta.url))] } }`;
  `frontend/Dockerfile` build stage gets `COPY locales /src/locales` (WORKDIR `/src/frontend`, so `../locales` resolves).
- Tests and e2e import `locales/it.json` by relative path (`../../locales/it.json` from `frontend/e2e/`).
- Key naming: `area.subarea.name`, lower camelCase segments; namespaces owned per task (§9.3). Per-kind messages:
  `<prefix>.<messageKind>` with mandatory `.generic` fallback. Mock fixture names under `mock.*`.
- Adapter keys (`adapter.<id>.*`) arrive in M2+.

### 6.4 Complete Italian catalog for M1 (B creates `locales/it.json` with exactly these keys)

```json
{
  "meta": { "name": "Italiano", "fallback": "en" },

  "app.name": "Hestia",
  "app.skipToContent": "Vai al contenuto",
  "nav.label": "Menu principale",
  "module.clima.name": "Clima",
  "module.clima.stanza": "Stanza",
  "module.clima.tutte": "Tutte le stanze",
  "module.energia.name": "Energia",
  "module.luci.name": "Luci",
  "header.dateTime": "{date} · {time}",
  "header.outdoor": "fuori {temperature}° · {humidity}%",
  "common.weekday.mon": "Lun",
  "common.weekday.tue": "Mar",
  "common.weekday.wed": "Mer",
  "common.weekday.thu": "Gio",
  "common.weekday.fri": "Ven",
  "common.weekday.sat": "Sab",
  "common.weekday.sun": "Dom",
  "common.loading": "Caricamento…",
  "common.missingValue": "—",
  "error.title": "Qualcosa non ha funzionato",
  "error.no_data_source": "Nessuna sorgente dati: i dati reali arriveranno con il backend.",
  "error.not_found": "Elemento non trovato.",
  "error.invalid_change": "Modifica non valida.",
  "error.network": "Il server non risponde.",
  "error.unexpected": "Errore imprevisto.",
  "error.retry": "Riprova",
  "notFound.title": "Pagina non trovata",
  "notFound.back": "Torna al clima",

  "kind.radiator.name": "Caloriferi",
  "kind.radiator.short": "caloriferi",
  "kind.radiator.lower": "caloriferi",
  "kind.radiator.target": "target {value}°",
  "kind.ac.name": "Climatizzatore",
  "kind.ac.short": "clima",
  "kind.ac.lower": "climatizzatore",
  "kind.ac.target": "set {value}°",
  "kind.ac.modeLabel": "Modalità climatizzatore · {room}",
  "kind.generic.name": "Impianto",
  "kind.generic.short": "impianto",
  "kind.generic.lower": "impianto",
  "kind.generic.target": "target {value}°",
  "kind.generic.modeLabel": "Modalità {system} · {room}",
  "action.heat": "scalda",
  "action.cool": "raffredda",
  "action.dry": "deumidifica",
  "action.idle": "standby",
  "action.off": "spento",
  "action.unknown": "—",
  "mode.heat": "Caldo",
  "mode.cool": "Freddo",
  "mode.heat_cool": "Caldo e freddo",
  "mode.auto": "Automatico",
  "mode.dry": "Deumidifica",
  "mode.fan_only": "Solo ventilazione",
  "mode.off": "Spento",

  "clima.status.system": "{system} {action}",
  "clima.status.viaRoom": "{system} {action} (con {room})",

  "clima.summary.roomTemperature": "{room} è a {temperature}°.",
  "clima.summary.noTemperature": "{room}: temperatura non disponibile.",
  "clima.summary.conditions": "Umidità {humidity}% · fuori {outdoor}° e {outdoorHumidity}%.",
  "clima.summary.system.heatingTowards.radiator": "I caloriferi stanno scaldando verso {target}°{overshoot, select, true {, tra poco vanno in standby} other {}}.",
  "clima.summary.system.aboveTarget.radiator": "I caloriferi sono fermi: la stanza è sopra il target di {target}°.",
  "clima.summary.system.inRange.radiator": "I caloriferi sono in standby: {temperature}° è dentro il range {low}–{high}°.",
  "clima.summary.system.unknown.radiator": "Lo stato dei caloriferi non è noto.",
  "clima.summary.system.notScheduled.ac": "Il climatizzatore non è programmato adesso.",
  "clima.summary.system.heatingTowards.ac": "Il climatizzatore scalda verso {target}°.",
  "clima.summary.system.coolingTowards.ac": "Il climatizzatore raffredda verso {target}°.",
  "clima.summary.system.drying.ac": "Il climatizzatore sta deumidificando.",
  "clima.summary.system.standby.ac": "Il climatizzatore è acceso ma in standby, set {target}°.",
  "clima.summary.system.off.ac": "Il climatizzatore è spento.",
  "clima.summary.system.heatingTowards.generic": "{system}: scalda{hasTarget, select, true { verso {target}°} other {}}.",
  "clima.summary.system.coolingTowards.generic": "{system}: raffredda{hasTarget, select, true { verso {target}°} other {}}.",
  "clima.summary.system.drying.generic": "{system}: deumidifica.",
  "clima.summary.system.aboveTarget.generic": "{system}: fermo, la stanza è sopra il target di {target}°.",
  "clima.summary.system.inRange.generic": "{system}: in standby, {temperature}° è dentro il range {low}–{high}°.",
  "clima.summary.system.standby.generic": "{system}: in standby{hasTarget, select, true {, target {target}°} other {}}.",
  "clima.summary.system.notScheduled.generic": "{system}: nessuna fascia attiva adesso.",
  "clima.summary.system.off.generic": "{system}: spento.",
  "clima.summary.system.unknown.generic": "{system}: stato non noto.",
  "clima.summary.next.target.radiator": "Alle {time} il target dei caloriferi passa a {target}°.",
  "clima.summary.next.target.ac": "Alle {time} il set del climatizzatore passa a {target}°.",
  "clima.summary.next.on.ac": "Alle {time} il climatizzatore si accende a {target}°.",
  "clima.summary.next.off.ac": "Alle {time} il climatizzatore si spegne.",
  "clima.summary.next.target.generic": "Alle {time} il target di {system} passa a {target}°.",
  "clima.summary.next.on.generic": "Alle {time} {system} si accende{hasTarget, select, true { a {target}°} other {}}.",
  "clima.summary.next.off.generic": "Alle {time} {system} si spegne.",

  "clima.rooms.label": "Stanze",
  "clima.room.noSensor": "nessun sensore · segue {room}",
  "clima.stanza.title": "Stanza · {room}",
  "clima.stanza.summaryLabel": "Riepilogo",
  "clima.range.label": "Intervallo",
  "clima.range.24h": "24 ore",
  "clima.range.7d": "7 giorni",
  "clima.range.description.24h": "ultime 24 ore e previsione di 2 ore",
  "clima.range.description.7d": "ultimi 7 giorni e previsione di 12 ore",
  "clima.thermogram.label": "Termogramma con previsione",
  "clima.thermogram.ariaLabel": "Termogramma di {room}, {range}. {summary}",
  "clima.thermogram.hint": "tocca una fascia futura per modificarla",
  "clima.thermogram.hintReadonly": "programma in sola lettura",
  "clima.legend.measured": "Stanza (misurata)",
  "clima.legend.forecast": "Stanza (prevista)",
  "clima.legend.target": "Target",
  "clima.legend.comfort": "Range di comfort",
  "clima.legend.humidity": "Umidità",
  "clima.legend.outdoor": "Esterno",
  "clima.legend.heat": "Scalda",
  "clima.legend.cool": "Raffredda",
  "clima.legend.dry": "Deumidifica",
  "clima.legend.idle": "Standby · nel range",
  "clima.legend.off": "Spento",
  "clima.legend.note": "Barra alta: programma e target · barra bassa: cosa fa l’impianto · dopo «adesso»: previsione",
  "clima.lane.acting": "in azione",
  "clima.lane.noProgram": "nessun programma",
  "clima.lane.outdoor": "Esterno",
  "clima.axis.now": "adesso",
  "clima.axis.day": "{weekday} {day}",
  "clima.axis.degrees": "{value}°",
  "clima.axis.percent": "{value}%",
  "clima.cursor.past24h": "ore {time}",
  "clima.cursor.past7d": "{day} · {time}",
  "clima.cursor.now": "adesso · {time}",
  "clima.cursor.forecast": "previsione · {time}",
  "clima.cursor.room": "Stanza",
  "clima.cursor.action": "azione",
  "clima.cursor.outdoor": "Esterno",
  "clima.cursor.value": "{temperature}° · {humidity}%",
  "clima.cursor.notProgrammed": "non programmato",
  "clima.cursor.slider": "Cursore del grafico",
  "clima.cursor.valueText": "{when}: stanza {temperature}°",
  "clima.segment.value": "{value}°",
  "clima.segment.on": "acceso",
  "clima.segment.editable": "{system}, fascia {from}–{to}, {value}: modifica",
  "clima.editor.label": "Modifica della fascia",
  "clima.editor.title": "{system} · fascia {from}–{to}",
  "clima.editor.scopeLabel": "Tipo di modifica",
  "clima.editor.scope.slot": "solo questa fascia",
  "clima.editor.scope.permanentValue": "permanente: valore",
  "clima.editor.scope.permanentTimes": "permanente: orari",
  "clima.editor.note.slot": "vale solo per la fascia in corso, fino alle {to}; il passato resta com’è",
  "clima.editor.note.permanentSlot": "cambia il valore di questa fascia nel programma, da adesso in poi",
  "clima.editor.note.permanentLevel": "cambia il livello «{level}»: vale per tutte le fasce con questo livello",
  "clima.editor.note.permanentTimes": "cambia gli orari di questa fascia nel programma",
  "clima.editor.note.changed": "programma {programmed}° · modificato {delta}° da adesso in poi",
  "clima.editor.decrease": "Abbassa il target della fascia",
  "clima.editor.increase": "Alza il target della fascia",
  "clima.editor.value": "{value}°",
  "clima.editor.from": "Inizio",
  "clima.editor.to": "Fine",
  "clima.editor.earlier": "Anticipa: {which}",
  "clima.editor.later": "Posticipa: {which}",
  "clima.editor.reset": "Ripristina",
  "clima.editor.done": "Fatto",
  "clima.editor.error": "La modifica non è stata salvata.",
  "clima.power.label": "Consumi",
  "clima.power.title": "{kind, select, ac {Corrente climatizzatori} other {Corrente impianti}}",
  "clima.power.now": "adesso",
  "clima.power.unitKw": "kW",
  "clima.power.last24h": "ultime 24 ore",
  "clima.power.kwh": "{value} kWh",
  "clima.power.cost": "≈ € {value}",
  "clima.power.month": "{month}: {kwh} kWh · € {cost}",
  "clima.power.withNote": "{text} · {note}",
  "clima.power.unmeasured.radiator": "i caloriferi non sono misurati",
  "clima.power.unmeasured.generic": "{system}: non misurato",
  "clima.power.none": "nessun consumo misurato",
  "clima.week.label": "Programma settimanale",
  "clima.week.title": "Programma della settimana · {room}",
  "clima.week.sources": "{count, plural, one {solo {list}} other {{list}}}",
  "clima.week.sourceSeparator": " + ",
  "clima.week.sharedWith": "{list}, insieme a {rooms}",
  "clima.week.noProgram": "{system}: nessun programma",
  "clima.table.caption": "Valori di {room}: ora, temperatura, umidità, target e azione degli impianti",
  "clima.table.time": "Ora",
  "clima.table.temperature": "Temperatura (°C)",
  "clima.table.humidity": "Umidità (%)",
  "clima.table.target": "Target (°C)",
  "clima.table.action": "Azione · {system}",
  "clima.table.forecast": "{time} (previsione)",

  "clima.tutte.label": "Tutte le stanze",
  "clima.tutte.title": "Tutte le stanze",
  "clima.tutte.legend.measured": "Misurata",
  "clima.tutte.legend.forecast": "Prevista",
  "clima.tutte.legend.target": "Target",
  "clima.tutte.legend.range": "Range",
  "clima.tutte.legend.heat": "Scalda",
  "clima.tutte.legend.idle": "Standby",
  "clima.tutte.openRoom": "apri la stanza",
  "clima.tutte.openRoomLabel": "Apri la stanza {room}",
  "clima.tutte.noSensor": "Nessun sensore di temperatura · segue {room}",
  "clima.tutte.noSensorShort": "nessun sensore",
  "clima.tutte.noTarget": "nessun target",
  "clima.tutte.target": "target {value}°",
  "clima.tutte.outdoor": "Esterno",
  "clima.tutte.outdoorValue": "{temperature}° · {humidity}%",
  "clima.tutte.rowChartLabel": "{room}: {temperature}°, target {target}°, {status}",
  "clima.tutte.table.caption": "Valori di tutte le stanze all’ora del cursore",

  "mock.room.soggiorno": "Soggiorno",
  "mock.room.corridoio": "Corridoio",
  "mock.room.camera": "Camera",
  "mock.room.cameretta": "Cameretta",
  "mock.room.bagno": "Bagno",
  "mock.room.ripostiglio": "Ripostiglio",
  "mock.room.cucina": "Cucina",
  "mock.room.studio": "Studio",
  "mock.room.bagno2": "Bagno di servizio",
  "mock.room.lavanderia": "Lavanderia",
  "mock.system.dehumidifier": "Deumidificatore",
  "mock.level.eco": "Eco",
  "mock.level.comfort": "Comfort",
  "mock.level.night": "Notte",
  "mock.level.morning": "Mattina",
  "mock.level.day": "Giorno",
  "mock.level.evening": "Sera",
  "mock.level.setpoint": "Set point"
}
```

### 6.5 Names (`src/modules/clima/names.ts`, B)

```ts
type Named = { name: string | null; nameKey: string | null };
export function roomName(r: Named & { id?: string; roomId?: string }): string;   // name ?? (nameKey && hasMessage → t) ?? id
export function systemName(s: Named & { kind: string }): string;                 // name ?? nameKey msg ?? tDynamic(`kind.${kind}.name`, 'kind.generic.name')
export function systemShortName(s: Named & { kind: string }): string;            // name/nameKey set → that; else tDynamic(`kind.${kind}.short`, 'kind.generic.short')
export function systemLowerName(s: Named & { kind: string }): string;            // name/nameKey set → that; else tDynamic(`kind.${kind}.lower`, 'kind.generic.lower')
export function actionLabel(a: Action | null): string;                          // t(`action.${a}`) / 'action.unknown'
export function modeLabel(m: Mode): string;
export function levelLabel(l: Level): string;                                   // label ?? labelKey msg ?? id
```

---

## 7. Screens

### 7.0 Tokens (B: `src/styles/tokens.css`; single dark theme, `color-scheme: dark`)

```css
:root {
  --c-bg:#0E1215; --c-panel:#151A1E; --c-panel-2:#1E252A; --c-lane:#1A2025; --c-out-bg:#12171A; --c-grid:#1F262B;
  --c-border:#2A333A; --c-border-2:#2E383F; --c-border-dashed:#46525B;
  --c-text:#EEF2F4; --c-text-2:#C9D1D6; --c-muted:#98A3AB;
  --c-heat:#FF8A4C; --c-target:#FFB07A; --c-band:rgba(255,176,122,.16); --c-cool:#4FB3FF; --c-dry:#59D3B4;
  --c-hum:#59D3B4; --c-hum-area:rgba(89,211,180,.13); --c-hum-legend:rgba(89,211,180,.16);
  --c-out:#8EA2FF; --c-out-hum:#7FD8C8; --c-out-hum-area:rgba(127,216,200,.10);
  --c-ac-prog:#2E4A66; --c-rad-lo:#3A5A8C; --c-rad-hi:#C2622E; --c-dot-idle:#6A767F;
  --c-nav-hover:#252D33; --c-row-hover:#171D21; --c-now-glow:rgba(255,138,76,.3);
  --c-on-light:#151A1E; --c-on-light-muted:#3A444C; --c-light:#EEF2F4; --c-light-track:#D5DCE1;
  --c-light-btn:#C4CCD2; --c-light-btn-hover:#B5BFC7; --c-light-border:#AEB8C0; --c-bg-ink:#0E1215;
  --pattern-idle:repeating-linear-gradient(135deg,#46525B 0 3px,#2A333A 3px 6px);
  --pattern-forecast:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 8px,transparent 8px 16px);
  --pattern-nodata:repeating-linear-gradient(135deg,rgba(255,255,255,.06) 0 6px,transparent 6px 12px);
  --font-sans:'Albert Sans Variable', system-ui, sans-serif;
  --font-mono:'Martian Mono Variable', ui-monospace, monospace;
  --radius-panel:28px; --radius-tab:16px; --radius-pill:999px; --radius-prog:6px; --radius-act:4px;
  --radius-seg:12px; --radius-seg-btn:10px; --radius-editor:20px; --radius-tooltip:14px; --radius-group:14px;
  --container-max:1400px; --page-pad:22px 32px 48px; --gap-blocks:20px; --gap-row:18px; --panel-pad:22px;
  --shadow-panel:0 1px 2px rgba(0,0,0,.2); --shadow-tooltip:0 18px 40px rgba(0,0,0,.5);
  --ease-enter:cubic-bezier(.2,.8,.2,1); --ease-draw:cubic-bezier(.4,0,.2,1); --ease-morph:cubic-bezier(.3,1,.4,1);
  --ease-pop:cubic-bezier(.3,1.4,.5,1);
  color-scheme: dark;
}
```
`global.css`: box-sizing border-box; `body{margin:0;background:var(--c-bg);color:var(--c-text);font-family:var(--font-sans)}`;
`a{color:var(--c-text)} a:hover{color:var(--c-target)}`; `.num{font-variant-numeric:tabular-nums}`;
`.mono{font-family:var(--font-mono)}`; `.visually-hidden` (clip pattern); focus ring
`:focus-visible{outline:2px solid var(--c-target);outline-offset:2px}`. `index.html`: `<meta name="color-scheme" content="dark">`.

`motion.css` (B) — global classes, names exported from `src/styles/motion.ts` as constants:
```css
.m-enter{opacity:0;animation:m-enter .9s var(--ease-enter) forwards}
@keyframes m-enter{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.m-e1{animation-delay:.08s}.m-e2{animation-delay:.16s}.m-e3{animation-delay:.24s}.m-e4{animation-delay:.32s}
.m-morph{transition:d .6s var(--ease-morph)}
.m-drawp{animation:m-dp 1.2s var(--ease-draw) both}@keyframes m-dp{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.m-drawf{opacity:0;animation:m-df .8s ease 1s forwards}@keyframes m-df{to{opacity:1}}
.m-grow{transform-origin:left;animation:m-grow 1s var(--ease-enter) .2s both}@keyframes m-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.m-pulse{position:relative}.m-pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid currentColor;animation:m-ring 1.8s ease-out infinite}
@keyframes m-ring{from{transform:scale(.6);opacity:.9}to{transform:scale(1.9);opacity:0}}
.m-nowp{animation:m-np 2.4s ease-in-out infinite}@keyframes m-np{50%{box-shadow:0 0 0 8px rgba(255,138,76,0)}}
@media (prefers-reduced-motion: reduce){
  .m-enter,.m-drawp,.m-drawf,.m-grow{animation:none;opacity:1;transform:none;clip-path:none}
  .m-pulse::after,.m-nowp{animation:none}
  .m-morph{transition:none}
}
```
(Never use `stroke-dasharray`+`pathLength` for the reveal; HANDOFF §4.) Motion: `<MotionConfig reducedMotion="user">`
in `AppMotionConfig`; `usePrefersReducedMotion()` = `matchMedia('(prefers-reduced-motion: reduce)')` hook.

### 7.1 App shell (B)

- **Layout**: skip link (`app.skipToContent`, visually hidden until focus) → container `max-width:1400px;
  margin:0 auto; padding:22px 32px 48px; display:flex; flex-direction:column; gap:20px` → `<Header/>` →
  `<main id="main">` (children keep the 20px gap: main is `display:contents` or a flex column with gap 20).
- **Header** (`m-enter`): flex wrap, space-between, center, gap 12. `<nav aria-label={t('nav.label')}>` flex wrap
  gap 6 center: logo `t('app.name')` 17px/800, letter-spacing −0.02em, margin-right 14px; for the clima module a
  group: `display:flex;align-items:center;gap:2px;padding:4px 4px 4px 12px;border-radius:14px;background:var(--c-panel)`,
  label `t('module.clima.name')` 12px/700, letter-spacing .06em, uppercase (CSS), muted, margin-right 8px; links
  (`NavLink`) padding 8px 14px, radius 10px, 14px/600, `--c-text-2`, no underline; active (`aria-current="page"`):
  background `--c-light`, colour `--c-bg-ink`; hover (not active): background `--c-nav-hover`. Right side: `mono num`
  13px muted: `t('header.dateTime', {date: fmt.headerDate(now, tz), time: fmt.time(...)})` followed by the active
  module's `HeaderStatus` (clima: ` · ` + `t('header.outdoor', ...)` from `store.outdoorNow`; renders nothing if null).
  "Stanza" link target: `/clima/stanza/${lastRoomId}` or `/clima/stanza`; active for any `/clima/stanza*` path.
- **Registry** (`app/modules.ts`):
```ts
import type { RouteObject } from 'react-router';
import type { ComponentType } from 'react';
import type { MessageKey } from '../i18n';
export interface ModuleNavItem { id: string; labelKey: MessageKey; to: string | (() => string); activePrefix: string }
export interface AppModule {
  id: string; labelKey: MessageKey; visible: boolean;
  nav: ModuleNavItem[];            // >1 item → rendered as a labelled group (clima)
  routes: RouteObject[];           // mounted only when visible
  HeaderStatus?: ComponentType;
}
export const modules: readonly AppModule[] = [climaModule, energiaModule, luciModule];
export function visibleModules(): AppModule[];
```
- **Router** (`createBrowserRouter`): `/` → `<KeepSearchNavigate to="/clima/stanza" replace/>`;
  `/clima/stanza` → `StanzaIndex` (uses `useRooms()`: `lastRoomId` if valid, else first room with sensor);
  `/clima/stanza/:roomId` → `StanzaScreen`; `/clima/tutte` → `TutteScreen`; `*` → `NotFound`;
  `errorElement: <RouteError/>`. Every in-app link/redirect preserves `?scenario` and `?source` (`keepSearch.ts`:
  `withKeptSearch(to: string, currentSearch: string): string`, `KeepSearchNavigate`, `useKeptSearchLink`).
- **App**: `<DataSourceProvider value={ds}><AppMotionConfig><RouterProvider router={router}/></AppMotionConfig></DataSourceProvider>`;
  `main.tsx` imports the two fontsource `wght.css` files, `tokens.css`, `global.css`, `motion.css`; sets
  `document.documentElement.lang = locale` and `document.title = t('app.name')`.
- **Data hooks** (`modules/clima/data/*`):
```ts
export type AsyncState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: DataSourceError };
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): AsyncState<T> & { reload(): void };
export function useRooms(): AsyncState<RoomView[]>;
export function useRoomTimeline(roomId: string | undefined, range: TimeRange, draft: OverrideCreate | null): AsyncState<RoomTimeline>;
export function useOverview(range: TimeRange): AsyncState<ClimaOverview>;
```
  Keep the previous `data` while reloading; abort the previous request; ignore stale results; reload when
  `ds.subscribe` fires; non-`DataSourceError` errors are wrapped as `unexpected`.
- **Shared clima components** (`modules/clima/components`, B):
  - `RangeSelector({ value, onChange, size })`: `role="group" aria-label={t('clima.range.label')}`; container
    padding 3px, background `--c-panel-2`, radius 12px, gap 2px; buttons `aria-pressed`, 13px/600, `--c-text-2`,
    radius 10px; `size='stanza'` padding 8px 14px; `size='tutte'` padding 0 14px, height 38px; active background
    `--c-light`, colour `--c-bg-ink`; hover (inactive) colour `--c-text`; transitions background/colour .25s.
  - `StatusDot({ action, shape, pulse })`: 7×7px, radius 2px (square) / 50% (round), background and `color` =
    `actionDotColor(action)`, class `m-pulse` when `pulse`.
  - `SystemStatusLine({ status: SystemStatus, viaRoomName?, pulse, className })`: inline-flex gap 5px (tabs) / 6px
    (Tutte) — gap via prop; text `t('clima.status.system', {system: systemShortName, action: actionLabel})` or
    `clima.status.viaRoom`.
  - `LegendSwatch({ variant, label })` variants: `line` (16×3 radius 3, colour), `dotted` (16px, border-top 3px dotted),
    `dashed` (16px, border-top 2px dashed target), `band` (16×10 band colour radius 2), `humidity` (16×8 hum-legend +
    border-top 1.5px hum), `block` (14×10 radius 2; background prop; `off` = lane + 1px `--c-border-2`), `blockSmall`
    (14×8). Item: flex center gap 6px.
  - `NowLine({ leftPct, withDot })`: absolute top 0 bottom 0, width 2px, margin-left −1px, `--c-heat`; dot 10px
    circle at top −5px, translateX(−50%), box-shadow `0 0 0 4px var(--c-now-glow)`, class `m-nowp`; pointer-events none.
  - `ForecastHatch({ leftPct, rounded })`: absolute top 0 bottom 0 from `leftPct%` to right 0, `--pattern-forecast`,
    radius `0 10px 10px 0` when `rounded`, pointer-events none.
  - `AxisLabels({ ticks: {key, text, leftPct, isNow, edge}[], className })`: mono num 10px, height 14px, relative;
    spans absolute `left:%`, translateX(−50%), nowrap, colour `--c-heat` if now else muted.
  - `VisuallyHidden`.

### 7.2 Stanza (D)

Component tree (`screens/Stanza/`):
```
StanzaScreen            route; useParams roomId; useRoomTimeline(roomId, range, draft); redirects; setLastRoom, setOutdoorNow
├─ <h1 class="visually-hidden">clima.stanza.title</h1>
├─ RoomTabs             (m-enter m-e1) role=group aria-label clima.rooms.label
│   ├─ RoomTab × rooms with sensor (NavLink, aria-current)
│   └─ SensorlessTab × rooms without sensor (not focusable, not a link)
├─ Summary              (m-enter m-e1) section aria-label clima.stanza.summaryLabel
├─ ThermogramPanel      (m-enter m-e2) section aria-label clima.thermogram.label
│   ├─ TopBar: Legend (6 items) | hint + RangeSelector(size stanza)
│   ├─ body (flex gap 12): ThermogramLabels (118px) | ThermogramPlot (flex 1, margin-right 34px)
│   │    ThermogramPlot: ForecastHatch(rounded) · RoomChart · spacer 10 · SystemLane × lanes · spacer 10 ·
│   │                    OutdoorChart · NowLine(withDot) · CursorOverlay(+CursorTooltip) · CursorSlider
│   ├─ AxisLabels (margin 0 34px 0 130px)
│   ├─ BottomLegend (margin-left 130px)
│   ├─ SlotEditor (AnimatePresence; margin-left 130px)
│   └─ ThermogramTable (visually hidden)
└─ row (flex wrap gap 18px)
    ├─ PowerCard        (m-enter m-e3) flex 1 1 340px
    └─ WeekProgram      (m-enter m-e3) flex 2 1 560px
lanes/ SystemLane (= ProgramBar + ActionBar), ProgramBar, ActionBar
```
Redirects (replace, keeping search): room id unknown → `/clima/stanza`; room without sensor → its
`followsRoomId` (else first sensor room). While loading the first time: render the page skeleton (panels with the same
sizes, `aria-busy="true"`); error → `ErrorView` (`t('error.' + code)` + retry).

**RoomTabs** — container flex wrap gap 8px. RoomTab: min-height 58px, padding 8px 16px, radius 16px, background
`--c-panel`, colour `--c-text`, flex column, align flex-start, justify center, gap 3px, left aligned; line 1: flex
baseline gap 8px, 15px/700 name + `num` 15px/400 opacity .8 temperature `fmt.temp(T)` + "°" (via `clima.axis.degrees`);
line 2: flex wrap gap 10px, 11px/600, one `SystemStatusLine` per system (dot shape from kindSpec, pulse if
`isActive`). Active: background `--c-light`, colour `--c-on-light`. Hover: translateY(−2px); transitions background
.25s, colour .25s, transform .2s. Click: navigate (store clears cursor/editor through `setLastRoom`).
SensorlessTab: same box, `border:1px dashed var(--c-border-dashed)`, 15px/700 `--c-text-2` name + 11px/600 muted
`t('clima.room.noSensor', {room: roomName(followed)})`.

**Summary** — `max-width:1040px`; `<p>` margin 0, 40px, line-height 1.15, letter-spacing −0.03em, weight 300:
`<b style=700>{lead}</b> {rest}`; second `<p class="num">` margin 12px 0 0, 15px, `--c-text-2`: conditions.
Text via `screens/Stanza/summaryText.ts`:
```ts
export function renderSummary(f: SummaryFacts, timeZone: string): { lead: string; rest: string; conditions: string; full: string };
```
lead = `clima.summary.roomTemperature` (or `noTemperature`); each `SystemFact` →
`tDynamic('clima.summary.system.<type>.<messageKind>', 'clima.summary.system.<type>.generic', values)` with values
`{system, target, temperature, low, high, overshoot:'true'|'false', hasTarget:'true'|'false'}` (numbers via
`fmt.temp`); next → `clima.summary.next.<change>.<messageKind>` with `{time: fmt.time(at, tz), target, system, hasTarget}`;
rest = system sentences then next, joined by a single space; conditions = `clima.summary.conditions`
(`pct`, `temp`, `pct`). Expected `home` 24h soggiorno full text:
`Soggiorno è a 21,8°. I caloriferi sono fermi: la stanza è sopra il target di 21,0°. Il climatizzatore scalda verso 21,5°. Alle 08:45 il climatizzatore si spegne.`

**ThermogramPanel** — background `--c-panel`, radius 28px, padding 22px 22px 16px, flex column gap 10px,
shadow `--shadow-panel`. TopBar: flex wrap, space-between, center, gap 12px; legend flex wrap gap 14px, 12px,
`--c-text-2`: measured(line text), forecast(dotted), target(dashed), comfort(band), humidity, outdoor(line `--c-out`);
right: flex center gap 14px: hint 12px muted (`hint` if any lane segment is clickable, else `hintReadonly`; hidden in
`noProgram`) + RangeSelector.

**ThermogramLabels** (118px, flex column): block 260px, relative, `mono num` 10px muted: room name absolute top-left
12px/700 `--c-text` sans; ticks `ROOM_TICKS` absolute right 0, `top: tickTopPct(v).toFixed(2)%`, translateY(−50%),
text `clima.axis.degrees`. Spacer 10px. Per lane 50px: flex column, justify center, gap 4px, 12px: name 24px tall,
flex center, 700, nowrap (`systemName`); "in azione" 14px tall, 11px muted. Spacer 10px. Outdoor 80px relative mono
10px muted: "Esterno" top-left 12px/700 sans `--c-text`; "15°" right 0 top 8%; "0°" right 0 bottom 6%.

**ThermogramPlot** (relative, flex 1, min-width 0, margin-right 34px; pointer handlers on this element):
- RoomChart: relative 260px; gridlines at tick tops (absolute left/right 0, 1px `--c-grid`); `<svg width="100%"
  height="260" viewBox="0 0 1000 260" preserveAspectRatio="none" role="img" aria-label=clima.thermogram.ariaLabel
  style="position:absolute;inset:0;overflow:visible">` with paths in order: humidityArea (fill `--c-hum-area`,
  `m-morph`), humidityLine (stroke hum 1.4, stroke-opacity .8), band (fill band), target (stroke target 1.8,
  dasharray `5 4`), past (stroke text 2.8, linejoin round, `m-drawp`), forecast (stroke text 2.8, dasharray `1 6`,
  linecap round, `m-drawf m-morph`); all strokes `vector-effect="non-scaling-stroke"`, `fill="none"` for lines;
  all except past get `m-morph`. Humidity labels "80%"/"30%" (`clima.axis.percent`): mono num 10px hum, absolute
  right −6px, translateX(100%), top 0 / bottom 0.
- SystemLane (lanes/): 50px, flex column, justify center, gap 4px.
  - ProgramBar: relative 24px, radius 6px, background `--c-lane`. Segments (keyed by `segment.key`) absolutely
    positioned `left/width` from `boxPct` (`toFixed(3)%`), background `kindSpec.programFill(seg)`, border-right
    2px solid `--c-panel`, radius 6px, flex center, padding-left 7px, 11px/700 white, nowrap, overflow hidden,
    class `m-grow`; label `clima.segment.value` (or `clima.segment.on`) when `width > SEGMENT_LABEL_MIN_WIDTH_PCT[range]`
    and the value is not null. Clickable (per `editorAvailability`) → `<button type="button">` with
    `aria-label=clima.segment.editable`, `aria-expanded`, `aria-controls` editor id, cursor pointer, hover
    `filter:brightness(1.08)`; else `<span aria-hidden="true">` cursor default. Selected: box-shadow
    `0 0 0 2px var(--c-bg-ink), 0 0 0 4px var(--c-light)`, z-index 3; else `edited`: `inset 0 0 0 2px var(--c-panel)`,
    z 1. Clicking the selected segment closes the editor. Representation `none`: no segments, centred 11px muted
    `clima.lane.noProgram`.
  - ActionBar: relative 14px (prop `height`), radius 4px, background `--c-lane`, overflow hidden; `actionRuns` spans
    absolute, background `actionFill`, opacity .5 when `forecast`, class `m-grow`.
- OutdoorChart: relative 80px, background `--c-out-bg`, radius 8px; svg 1000×80 (`aria-hidden`): humidityArea fill
  `--c-out-hum-area`; humidity stroke `--c-out-hum` 1.2 dasharray `3 3`; temperature stroke `--c-out` 2.2.
- ForecastHatch(leftPct = `nowPct`), NowLine(`nowPct`, withDot).
- Cursor (`cursorIndex != null`): line absolute top −4px bottom −4px, width 1px, `--c-text`, opacity .5, at
  `(i+0.5)/n*100%`; dot 12px at `top: yRoomT(T[i])px`, margin −6px, background `--c-text`, border 3px `--c-panel`;
  tooltip absolute top 6px, `left` = cursor %, `transform: translateX(tooltipOnLeft ? 'calc(-100% - 14px)' : '14px')`,
  background `--c-panel`, border 1px `--c-border`, radius 14px, padding 12px 14px, 13px, line-height 1.65, nowrap,
  shadow `--shadow-tooltip`, min-width 230px, z 5, pointer-events none, `num`. Content: `mono` 11px muted margin-bottom
  4px when-line (`clima.cursor.past24h`/`past7d`/`now`/`forecast` with `fmt.time`, `fmt.dayLabel`); rows flex
  space-between gap 16px: `clima.cursor.room` / `<b>clima.cursor.value</b>`; per lane: `systemName` /
  `<b>` `kind.<k>.target` with `fmt.temp(target[i])` or `clima.cursor.notProgrammed`; muted row with
  `padding-left:10px` `clima.cursor.action` / `<b style="color:actionTextColor">actionLabel</b>`; muted row
  `clima.cursor.outdoor` / `<b style="color:var(--c-out)">clima.cursor.value</b>`.
- Pointer: `onPointerMove` → `setCursor(indexFromPointer(...))` (only when changed), `onPointerLeave` → `setCursor(null)`.
- CursorSlider: a transparent focusable element over the room chart area (`tabIndex=0`, `role="slider"`,
  `aria-label=clima.cursor.slider`, `aria-valuemin=0`, `aria-valuemax=n-1`, `aria-valuenow=index`,
  `aria-valuetext=clima.cursor.valueText`); keys via `keyboardStep`/`moveCursor`; focus without cursor → nowIndex;
  Escape → editor open ? `closeEditor()` : `setCursor(null)`.

**Axis** — ticks from `axisTicks()`; text: now → `clima.axis.now`; hour → `fmt.time`; day → `fmt.dayLabel`;
row `margin: 0 34px 0 130px`.

**BottomLegend** — margin-left 130px, flex wrap gap 16px, 12px `--c-text-2`: heat, cool, idle (pattern), off
(lane + border), `dry` only if any lane has a `dry` sample; note `clima.legend.note` with margin-left auto.

**SlotEditor** (`motion.div`, initial `{opacity:0, y:8, scale:.98}`, animate `{opacity:1, y:0, scale:1}`,
transition `{duration:.45, ease:[.3,1.4,.5,1]}`, exit `{opacity:0, y:8, transition:{duration:.15}}`; `id` for
`aria-controls`; `role="group"` `aria-label=clima.editor.label`) — margin-left 130px, flex wrap center gap 16px,
background `--c-light`, colour `--c-on-light`, radius 20px, padding 14px 16px:
- text block (flex 1, min-width 220px): title 15px/700 `clima.editor.title` (`systemName`, `fmt.slotTime(slotFrom/To)`);
  note 12px `--c-on-light-muted`: `note.changed` when a value draft exists (programmed, signed delta `+0,5`), else per
  option: slot → `note.slot` (`to`), permanentValue levels → `note.permanentLevel` (`levelLabel`), perSlot →
  `note.permanentSlot`, times → `note.permanentTimes`.
- scope selector, only if `options.length > 1`: `role="radiogroup"` `aria-label=clima.editor.scopeLabel`;
  track background `--c-light-track`, radius 999px, padding 4px, gap 4px; options `role="radio"` `aria-checked`,
  13px/600, height 36px, padding 0 14px, radius 999px, transparent / checked background `--c-on-light` colour
  `--c-light`; arrow keys move between options.
- value stepper (options slot/permanentValue): track background `--c-light-track`, radius 999px, padding 4px, gap 6px;
  buttons 44×44 round, background `--c-light-btn` (hover `--c-light-btn-hover`, `:active` scale .9, transition
  transform .15s, background .2s), minus/plus SVG icons (16px, stroke 2, `aria-hidden`), `aria-label`
  `clima.editor.decrease`/`increase`, disabled at bounds; value `num` 64px wide centred 20px/600 `clima.editor.value`.
- times stepper (permanentTimes): two groups "Inizio"/"Fine" each [− mono value +], buttons 44×44 like above,
  `aria-label` `clima.editor.earlier`/`later` with `{which}` = `clima.editor.from`/`to`; fixed ends (00:00/24:00 in
  full-coverage days) are shown but disabled.
- "Ripristina": height 44px, padding 0 16px, radius 999px, border 1px `--c-light-border`, transparent, 13px;
  disabled when there is neither a draft nor an `overrideId`.
- "Fatto": height 44px, padding 0 16px, radius 999px, background `--c-on-light`, colour `--c-light`, 13px/700.
- Focus: on open, focus the first radio (or the − button); on close, return focus to the segment button.
- Errors from `createOverride` → inline 12px message `clima.editor.error` (role="alert"), editor stays open.

**PowerCard** — section `aria-label=clima.power.label`, background `--c-panel`, radius 28px, padding 22px, flex
column gap 14px. `<h2>` 18px/700 `clima.power.title` (`kind: 'ac'` when every measured system is kind `ac`).
Row flex space-between align flex-end gap 12px: left: 12px muted `clima.power.now`; `num` 40px/300 ls −0.03em lh 1.05
`fmt.decimal(nowKw,1)` + ` <span 16px muted>kW</span>`; right (text-align right): 12px muted `clima.power.last24h`;
`num` 22px/400 `clima.power.kwh`; `num` 12px `--c-text-2` `clima.power.cost` (`fmt.decimal(cost,1)`).
Month line: `num` 13px `--c-text-2`, border-top 1px `--c-grid`, padding-top 12px: `clima.power.month`
(`fmt.monthName`, kwh `fmt.decimal(v,0)`, cost `fmt.decimal(v,2)`) combined with each unmeasured note through
`clima.power.withNote` (`clima.power.unmeasured.<kind>` → fallback generic). If `kind === 'none'`: only
`clima.power.none`. Mode block (D9), for each system of the room with behavior `mode_based`: border-top 1px
`--c-grid`, padding-top 12px, flex column gap 6px: 12px muted `kind.<k>.modeLabel` (fallback generic, `{room}`,
`{system}`) and a 15px/600 `--c-text` text `modeLabel(state.mode)` — plain text, **no buttons, no chips**.
Expected `home`: `1,3` kW, `8,8 kWh`, `≈ € 2,5`, `Novembre: 79 kWh · € 22,10 · i caloriferi non sono misurati`.

**WeekProgram** — section `aria-label=clima.week.label`, background `--c-panel`, radius 28px, padding 22px, flex
column gap 8px. Header flex space-between baseline: `<h2>` 18px/700 `clima.week.title`; right 12px muted sources:
lower names of the room's systems joined with `clima.week.sourceSeparator`, wrapped in `clima.week.sources` (`count`);
if a system serves other rooms → `clima.week.sharedWith` with the plain list and the other room names (`home`:
"caloriferi + climatizzatore", "solo caloriferi", "solo climatizzatore", bagno "caloriferi, insieme a Ripostiglio").
Rows from `weekRows()`: flex center gap 10px: day label 36px, 13px, weight 500 (today 800; `fmt.weekdayShort`);
bars column gap 2px, flex 1: full bar relative 18px radius 4px background `--c-lane` overflow hidden, slots absolute
with `fill`, border-right 1px `--c-panel`, 10px/700 white, padding-left 4px, flex center, value `fmt.temp` (no °,
like the mockup) when `showValue`; thin bar 8px radius 4px, slots `--c-ac-prog` radius 4px. Systems with
representation `none`: one 12px muted line `clima.week.noProgram`. Axis: `mono` 10px muted, margin-left 46px,
space-between: 00 06 12 18 24 (numbers, not messages).

**ThermogramTable** — `<table class="visually-hidden">` with `<caption>` `clima.table.caption`, header row (time,
temperature, humidity, target, one action column per lane `clima.table.action`), rows from `tableRows()`: time
`fmt.time` (7d: `fmt.dayLabel` + time), forecast rows use `clima.table.forecast`.

Responsive (both screens, `@media (max-width: 1279px)`): Stanza label column 96px and the 130px margins become 108px;
PowerCard and WeekProgram stack (flex-wrap already does it).

### 7.3 Tutte le stanze (E)

Component tree (`screens/Tutte/`):
```
TutteScreen        useOverview(range); setOutdoorNow; <h1 class="visually-hidden">clima.tutte.title</h1>
└─ AllRoomsPanel   (m-enter m-e2) section aria-label clima.tutte.label
   ├─ TopBar: compact legend | cursor readout + RangeSelector(size tutte)
   ├─ columns (flex gap 14px)
   │   ├─ left 230px:  RoomRow × rows, OutdoorRow.Left
   │   ├─ center flex 1 (relative, min-width 0, cursor crosshair, pointer handlers):
   │   │      ForecastHatch(not rounded) · (MiniThermo + ActionStrip×systems) × rows · OutdoorRow.Center ·
   │   │      NowLine(no dot) · cursor line · CursorSlider
   │   └─ right 170px: CursorValues × rows, OutdoorRow.Right
   ├─ AxisLabels (margin 0 184px 0 244px; mono letter-spacing −0.02em)
   └─ TutteTable (visually hidden, values at the cursor)
```
- Panel: background `--c-panel`, radius 28px, padding 22px 22px 16px, flex column gap 8px.
- TopBar: legend 12px `--c-text-2`, gap 14px: measured, forecast, target, range (band), heat (`blockSmall`
  14×8 heat), idle (`blockSmall` pattern) using `clima.tutte.legend.*`; right flex center gap 14px: `mono num`
  12px `--c-text-2` letter-spacing −0.02em cursor readout (`clima.cursor.*` for `cursorIndex ?? nowIndex`; past in
  7d uses `past7d`) + RangeSelector(`tutte`).
- Every row is 112px tall with `border-top:1px solid var(--c-grid)` in all three columns; outdoor row 72px.
- **RoomRow** (left): flex column, justify center, gap 4px, padding 0 8px, radius 10px, hover background
  `--c-row-hover` (transition .25s); line 1 flex space-between baseline: name 16px/700, temperature `num` 26px/300
  (`fmt.temp` + °, or `common.missingValue`); one `SystemStatusLine` per system 12px/600 `--c-text-2`, gap 6px, pulse
  if active (sensorless rows: `clima.status.viaRoom`, no pulse); link (`<Link>`, keep search) 12px muted, no
  underline, inline-flex gap 6px → 10px on hover, colour `--c-target` on hover: `clima.tutte.openRoom` + `<span
  aria-hidden>→</span>`, `aria-label=clima.tutte.openRoomLabel`; target `/clima/stanza/<id>` (sensorless → followed room).
- **MiniThermo** (center): column justify center gap 4px; with sensor: `<svg width="100%" height="80"
  viewBox="0 0 1000 80" preserveAspectRatio="none" role="img" aria-label=clima.tutte.rowChartLabel style="display:block">`:
  band (fill band), target (stroke target 1.4, dash `5 4`), past (stroke text 2.2, `m-drawp`), forecast (stroke text
  2.2, dash `1 5`, round caps, `m-drawf`), non-scaling strokes, paths from `miniChartPaths`. Without sensor: div
  80px radius 8px `--pattern-nodata`, flex center, padding-left 14px, 13px muted `clima.tutte.noSensor`
  (`{room}` = followed room name).
- **ActionStrip** (one per system of the row): relative 7px, radius 4px, background `--c-lane`, overflow hidden,
  `actionRuns` spans with `actionFill`, opacity .5 when forecast, `m-grow`.
- **CursorValues** (right): column, justify center, align flex-end, gap 3px, right aligned; `num` 22px/300
  temperature at index (`common.missingValue` without sensor); `num` 11px muted `clima.tutte.target` or
  `clima.tutte.noTarget` (sensorless: `clima.tutte.noSensorShort`); per system (sensor rows only) 11px/600 coloured
  `actionDotColor` text `clima.status.system` at index.
- **OutdoorRow**: left: "Esterno" 16px/700 + `num` 12px `--c-text-2` `clima.tutte.outdoorValue` (now); center: flex
  center, svg 1000×60 (`aria-hidden`): humidity stroke `--c-out-hum` 1.2 dash `3 3`; temperature stroke `--c-out`
  2.2 (`outdoorChartPaths(..., 'tutte')`); right: `num` 14px `--c-out` value at cursor.
- Cursor: line absolute top 0 bottom 0, 1px `--c-text` at `(i+0.5)/n*100%` (no tooltip, no dot). Shared store
  cursor. CursorSlider as in Stanza (over the center column).
- `.mono` text in this screen uses letter-spacing −0.02em (mockup).
Expected `home` 24h right column: Soggiorno 21,8° · target 21,0° · caloriferi standby / clima scalda; Corridoio 19,2°
· target 20,5°; Camera 18,1° · target 18,0°; Cameretta 19,8° · target 19,0°; Bagno 20,4° · target 23,0°; Ripostiglio
— · nessun sensore; outdoor 5,9° · 83%. Axis 24h: adesso, 12:00, 16:00, 20:00, 00:00, 04:00; 7d: adesso, sab 14 … gio 19.

### 7.4 Animations summary

| What | How |
|---|---|
| Block entrance cascade | `m-enter` + `m-e1..m-e4` (header none, tabs/summary e1, thermogram/panel e2, bottom row e3) |
| Measured line reveal | `m-drawp` clip-path 1.2 s |
| Forecast line | `m-drawf` fade after 1 s |
| Program/action bars | `m-grow` scaleX 1 s (.2 s delay) |
| Data changes (room/range/draft) | `m-morph` `transition: d .6s` on paths (no `key` change on the svg) |
| Active system dot | `m-pulse` ring 1.8 s |
| Now dot | `m-nowp` 2.4 s |
| SlotEditor | Motion pop (cubic-bezier .3,1.4,.5,1, .45 s), AnimatePresence exit; ± `:active` scale .9 |
| Reduced motion | `motion.css` media query + `MotionConfig reducedMotion="user"` |

### 7.5 Accessibility checklist

Landmarks (header/nav/main, labelled sections), one visually hidden `<h1>` per screen, `lang="it"`; charts
`role="img"` + `aria-label` (summary text); hidden tables; keyboard: skip link, header links, room tabs (links),
RangeSelector buttons, editable segments (buttons), editor controls, cursor slider (←/→, Shift, PageUp/Down,
Home/End), Esc closes the editor; state never only by colour (action text in tooltips/readouts, idle hatch); focus
ring visible; target sizes ≥ 44px in the editor.

### 7.6 Editor deviations from the mockup (intentional)

Scope selector (§5.6), times stepper, levels warning note, Ripristina deletes a committed override. Single-option
editors look like the mockup (no selector).

---

## 8. Testing plan

### 8.1 Oracle (C, `frontend/tests/clima/oracle/loadMockup.ts`)

Runs the **original mockup code** as a test oracle (no copy): read
`docs/design/mockup/N-Stanza.dc.html` and `N-Tutte.dc.html` with `node:fs` (path via
`fileURLToPath(new URL('../../../../docs/design/mockup/...', import.meta.url))`), extract the
`<script type="text/x-dc" data-dc-script ...>` content with
`/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/`, then
`new Function('DCLogic', src + ';return Component;')(class { constructor(p){ this.props = p; } setState(){} })`.
```ts
export interface OracleStanza { render(state: { room: number; hi: number | null; range: '24h' | '7g'; edits?: Record<string, number> }): any }
export function loadStanzaOracle(): OracleStanza;   // new Component({}); c.state = {room, hi, edits:{}, sel:null, range, ac:{s:'Caldo',c:'Caldo'}, tab:0}; c.renderVals()
export function loadTutteOracle(): { render(state: { hi: number | null; range: '24h' | '7g' }): any };
export function loadEngineOracle(): { setRange(r: string): void; sim(ri: number, st: unknown): Record<string, unknown[]>; NS(): number; NOWI(): number; OUTM(): { T: number[]; H: number[] } };
// engine: evaluate the Stanza script + ';return {setRange, sim, ROOMS, NS: () => NS, NOWI: () => NOWI, OUTM: () => OUTM}'
// (with the same DCLogic stub parameter); call sim(ri, { ac: { s: 'Caldo', c: 'Caldo' }, edits: {} }) after setRange.
// Verified while writing this spec: this loader reproduces the screenshot values (e.g. 24h soggiorno 21,8°, 7d 21,5°).
```
Room index mapping: 0 soggiorno, 1 corridoio, 2 camera, 3 cameretta, 4 bagno. Range `'7g'` = our `'7d'`.

### 8.2 Vitest targets

| File | Owner | Asserts |
|---|---|---|
| `tests/clima/engineParity.test.ts` | C | `home` 24h **and** 7d: for each room, our `T`, `H`, radiator target/action, split target/action arrays are **exactly equal** (`toEqual`) to oracle `sim()` (`T`,`H`,`rt`,`ra`,`as`,`aa`); outdoor T/H equal to oracle `OUTM` |
| `tests/clima/paths.test.ts` | C | `roomChartPaths`, `outdoorChartPaths('stanza')` strings equal oracle `g.past/fut/humLine/humArea/tgt/band/oTemp/oHum/oHumArea` for all 5 rooms × 2 ranges; `miniChartPaths` + `outdoorChartPaths('tutte')` equal Tutte oracle rows; null-breaking unit cases |
| `tests/clima/segments.test.ts` | C | soggiorno lanes (24h, 7d): segment left/width (`toFixed(3)`), fill, label visibility equal oracle `g.lanes[*].prog` (`l`,`w`,`bg`,`t`); oracle `cur === 'pointer'` ⇔ our `state !== 'past' && slotRef != null` (the mockup marks current and future slots editable); the segment containing nowIndex has `state 'current'`; action runs equal oracle `act` |
| `tests/clima/axis.test.ts` | C | ticks (kind/leftPct) equal oracle `g.xl` for 24h/7d; 5 % omission |
| `tests/clima/runs.test.ts` | C | `runs` port cases (empty, single, alternating), `actionRuns` split at now |
| `tests/clima/colors.test.ts` | C | `mix` port, `radiatorColor` 17/18.5/21/23/clamps, action fills/text/dot colours |
| `tests/clima/summaryFacts.test.ts` | C | HANDOFF §7 cases with hand-built `SummaryInput`: radiator heating (± overshoot), above target, in range (range values 17,7–18,2 for camera); split not scheduled, heating, cooling, standby, dry, off (mode off); next change earliest + tie → radiator; generic variants: dehumidifier drying/off/notScheduled, `noProgram` constant target, action null → unknown; `summaryInputFromTimeline` on mock `home` gives the oracle facts |
| `tests/clima/editorOptions.test.ts` | C | full matrix: representation {levels, perSlot, onOff, none} × caps {LEVELS_RW, PERSLOT_RW, LEVELS_RO, NONE, ONOFF_TIMES, scopes ±slot} × state {past, current, future} × gap; e.g. levels+LEVELS_RW: current → [slot, permanentValue, permanentTimes] + levelsWarning, future → [permanentValue, permanentTimes], past → not clickable `past` |
| `tests/clima/editorDraft.test.ts` | C | bounds ±4 / step 0.5, null draft when unchanged, levels → levelValueC, perSlot → targetC, time bounds (full coverage / gaps), days for dayScope all |
| `tests/clima/mockDataSource.test.ts` | C | each scenario: rooms/lanes counts (manyRooms: 10 rooms, soggiorno 3 lanes, generic kind `dehumidifier`), grid (count/nowIndex/t[0]/t[now] ISO with `+01:00`), ripostiglio status `viaRoomId: 'bagno'`, power 1,3/8,8/2,5, `nextChange` values (§4.4); draft preview changes only `k >= nowIndex`; `createOverride` slot on the current bagno slot changes forecast and marks segment `edited`; invalid scopes rejected (`invalid_change`); delete restores; `subscribe` fires; `noProgram`: no segments, constant target band; abort signal |
| `tests/clima/time.test.ts` | C | `localParts`, `isoWithOffset` (Nov +01:00, Jul +02:00), `minutesToHhmm(1440) === '24:00'` |
| `tests/i18n.test.ts` | B | `t` plain/ICU select/plural; `tDynamic` fallback; `hasMessage`; `fmt.temp(21.8) === '21,8'`, `fmt.time('2026-11-20T08:30:00+01:00','Europe/Rome') === '08:30'`, `fmt.dayLabel(...) === 'sab 14'`, `fmt.headerDate === 'ven 20 nov'`, `fmt.monthName(11) === 'Novembre'`; catalog keys are flat strings (except `meta`) and every message compiles with `IntlMessageFormat` |
| `tests/app/Header.test.tsx`, `tests/app/modules.test.ts` | B | header renders Hestia + Clima group with two links, active state from route, hidden modules registered but not rendered; redirects keep `?scenario` |
| `tests/clima/store.test.ts` | B | store transitions (setRange clears cursor/editor, select clears draft, ...) |
| `tests/clima/stanza/summaryText.test.ts` | D | `renderSummary` on mock `home` equals oracle `hero.lead + hero.rest` (trim) for all 5 rooms × 24h/7d, and `hero.fc` for conditions |
| `tests/clima/stanza/*.test.tsx` | D | SlotEditor: options rendered per availability, ± respects bounds, Fatto calls `createOverride`, Ripristina, Esc; ProgramBar: clickable vs past segments; PowerCard shows mode as text (no buttons) |
| `tests/clima/tutte/*.test.tsx` | E | rows (6 in home; ripostiglio hatch text), cursor values at nowIndex equal the expected list in §7.3 |
| `tests/clima/catalog.test.ts` | F | every key built by `names.ts`/`systemKinds` for kinds radiator/ac/generic and every summary type has a message; tokens.css colours equal `PALETTE` |

Notes: never depend on the machine time zone (always pass `Europe/Rome`); oracle tests read `docs/` (present in the
checkout; not needed in Docker builds).

### 8.3 Playwright (F)

`playwright.config.ts`: `use: { baseURL, locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1400, height: 1000 },
trace: 'on-first-retry' }`; `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2, animations: 'disabled' } }`;
`snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}'` (no platform suffix).
Fixture `e2e/fixtures.ts`: `test` extended so every page does
`await page.clock.setFixedTime(new Date('2026-11-20T08:30:00+01:00'))` and `page.emulateMedia({ reducedMotion: 'reduce' })`
before `goto`; collects `console.error`/`pageerror` and fails the test on any.

| Spec | Content |
|---|---|
| `e2e/smoke.spec.ts` (B rewrites, F extends) | `/` redirects to `/clima/stanza/soggiorno`; header "Hestia", Clima group, no Energia/Luci links; `?scenario=perSlot` survives navigation |
| `e2e/stanza.spec.ts` | 24h: summary text (expected string §7.2), tabs (5 + dashed Ripostiglio), legend, lanes "Caloriferi"/"Climatizzatore", axis labels; **visual** `stanza-24h.png`; 7d: click "7 giorni", visual `stanza-7d.png`, Soggiorno tab 21,5°; cursor: hover at the x of sample 50 → tooltip `previsione · 09:30`, `21,3° · 49%`, `target 21,0°`, `non programmato`, `spento`, `7,1° · 81%`, visual `stanza-cursor.png`; keyboard: focus slider, ArrowRight ×2 → `previsione · 09:30`; editor: click the current radiator segment → radio group with 3 options; + twice → `22,0°`; Fatto → segment edited; Esc closes; future segment → only permanent options; past segment not a button |
| `e2e/tutte.spec.ts` | 24h values (§7.3), visual `tutte-24h.png`; 7d visual `tutte-7d.png`; hover moves the cursor readout; "apri la stanza" of Ripostiglio opens `/clima/stanza/bagno` |
| `e2e/a11y.spec.ts` | `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()` on Stanza 24h, Stanza with editor open, Tutte 24h: zero violations |
| `e2e/scenarios.spec.ts` | smoke for `perSlot` (weekend rows start 07:30; editor offers slot + permanentValue + permanentTimes), `readonly` (no segment buttons, hint "programma in sola lettura"), `noProgram` ("nessun programma" lanes, no buttons, mode "Spento" in PowerCard), `manyRooms` (9 tabs incl. 2 dashed, soggiorno has 3 lanes incl. "Deumidificatore", Tutte has 10 rows) |

Visual tests are tagged `@visual` and `test.skip(process.platform !== 'linux', 'baselines are Linux-rendered')`.
Baselines: generate with
`docker run --rm -v "$PWD/..:/work" -w /work/frontend mcr.microsoft.com/playwright:v1.65.1-noble sh -c "npm ci && npx playwright test --grep @visual --update-snapshots"`
(Playwright version must match `@playwright/test`), then compare manually with `docs/design/screenshots/*` (expected
differences: D7, D9, D13, D14, 1400 vs 1440 px) before committing. Document the command in `frontend/README.md`.

---

## 9. Work split and file ownership

Rules for everybody: work on `main` in the repository root; no commit/push/branch/stash/reset; touch only files you own
(plus the explicit shared-file protocol below); never rewrite a file you do not own with `Write`; run your checks
(`npm run lint && npm run typecheck && npm run test` / backend suite) before finishing and report failures caused by
files owned by others instead of fixing them.

### 9.1 Order

1. **A** alone (contract, deps, foundations).
2. **B** and **C** in parallel (they share no files; both compile against A's foundations).
3. **D** and **E** in parallel (need B and C).
4. **F** (e2e, final checks).

### 9.2 Ownership map

**A — contract + deps (first, alone)**
- Create: `backend/hestia/core/{base,literals,program,capabilities,domain,overrides}.py`,
  `backend/hestia/api/{errors,clima_models,clima,overrides}.py`, `backend/tests/{test_contract_models,test_clima_api}.py`,
  `frontend/src/api/schema.d.ts` (generated), `frontend/src/api/types.ts`, `frontend/src/api/datasource/{types.ts,context.tsx,index.ts(stub)}`,
  `frontend/src/modules/clima/types.ts`.
- Edit: `backend/hestia/api/schemas.py`, `backend/hestia/main.py`, `contract/openapi.json` (regenerated),
  `frontend/package.json` + `frontend/package-lock.json` (deps §1.8, scripts `gen:api`/`check:api`, `overrides`),
  `frontend/eslint.config.js` (ignore schema.d.ts), `.github/workflows/tests.yml` (check:api step),
  `backend/README.md` (aggregates + 503 stubs note), `CONTRIBUTING.md` (add `npm run check:api` to the checklist and
  "after changing backend models: export_openapi then `npm run gen:api`").
- Done when: backend `ruff check`, `ruff format --check`, `mypy`, `lint-imports`, `pytest`, `export_openapi --check`
  pass; frontend `npm run check:api` passes and `npm run typecheck` passes.

**B — app shell, i18n, styles, store, shared clima components**
- Create: `locales/it.json` (replace content with §6.4), `frontend/src/i18n/format.ts`,
  `frontend/src/styles/{motion.css,motion.ts}`, `frontend/src/app/{router.tsx,Layout.tsx,Header.tsx,Header.module.css,modules.ts,NotFound.tsx,RouteError.tsx,ErrorView.tsx,useNow.ts,keepSearch.ts,motion.tsx}`,
  `frontend/src/modules/{energia,luci}/module.ts`, `frontend/src/modules/clima/{module.tsx,names.ts}`,
  `frontend/src/modules/clima/store/climaStore.ts`, `frontend/src/modules/clima/data/{useAsync,useRooms,useRoomTimeline,useOverview}.ts`,
  `frontend/src/modules/clima/components/*` (§7.1), `frontend/src/modules/clima/routes/StanzaIndex.tsx`,
  **placeholders** `frontend/src/modules/clima/screens/Stanza/StanzaScreen.tsx` and
  `frontend/src/modules/clima/screens/Tutte/TutteScreen.tsx` (each `export function XScreen() { return null; }`;
  ownership passes to D/E), tests `frontend/tests/i18n.test.ts` (rewrite), `frontend/tests/app/*`,
  `frontend/tests/clima/store.test.ts`.
- Edit: `frontend/src/i18n/index.ts` (rewrite §6.1), `frontend/src/main.tsx`, `frontend/src/app/App.tsx`,
  `frontend/src/styles/{tokens.css,global.css}` (rewrite), `frontend/index.html` (color-scheme dark),
  `frontend/vite.config.ts` (fs.allow), `frontend/Dockerfile` (COPY locales), `frontend/e2e/smoke.spec.ts` (rewrite
  for the new shell, import `../../locales/it.json`), `frontend/README.md` (i18n location, `?scenario`/`?source`,
  layout), `locales/README.md` (status: M1 messages), `CONTRIBUTING.md` (translation path → `locales/`).
- Delete: `frontend/src/i18n/it.json`, `frontend/src/app/VersionStatus.tsx`, `frontend/src/api/version.ts`,
  `frontend/tests/VersionStatus.test.tsx`.

**C — data + logic (parallel with B; i18n-free)**
- Create/replace: `frontend/src/api/datasource/index.ts` (real), `frontend/src/api/datasource/http.ts`,
  `frontend/src/api/datasource/mock/**`, `frontend/src/lib/time.ts`, `frontend/src/modules/clima/systemKinds/**`,
  `frontend/src/modules/clima/logic/**`, `frontend/src/modules/clima/thermogram/**`, tests
  `frontend/tests/clima/oracle/loadMockup.ts` and the C rows of §8.2.
- Must not import `src/i18n`, `src/app`, components or the store.

**D — Stanza screen, lanes, SlotEditor (after B and C)**
- Own: `frontend/src/modules/clima/screens/Stanza/**` (incl. replacing the placeholder), `frontend/src/modules/clima/lanes/**`,
  `frontend/tests/clima/stanza/**`.

**E — Tutte screen (after B and C; parallel with D)**
- Own: `frontend/src/modules/clima/screens/Tutte/**` (incl. replacing the placeholder), `frontend/tests/clima/tutte/**`.
- Does not import from `lanes/` or `screens/Stanza/` (own `ActionStrip`), only from B's `components/`, C's
  logic/thermogram/systemKinds, `names.ts`, store and data hooks.

**F — e2e (last)**
- Own: `frontend/playwright.config.ts`, `frontend/e2e/**` (extends B's smoke), `frontend/e2e/__screenshots__/**`,
  `frontend/tests/clima/catalog.test.ts`; edits the e2e section of `frontend/README.md`.

**Closing (orchestrator, not a task)**: `docs/implementation-plan.md` M1 status/outcome, version bump if any, final
full CI run.

### 9.3 Shared-file protocol

- `locales/it.json`: B creates it with the **complete** §6.4 catalog. Later tasks only **add** keys, under their own
  prefix, with a targeted `Edit` (insert before the next namespace block; never `Write` the whole file, never rename or
  delete keys): C none (i18n-free), D `clima.stanza.*`/`clima.thermogram.*`/`clima.editor.*`/`clima.power.*`/
  `clima.week.*`/`clima.table.*`/`clima.legend.*`/`clima.cursor.*`/`clima.segment.*`/`clima.lane.*`/`clima.axis.*`,
  E `clima.tutte.*`, F none. A changed message text is reported, not edited, unless the key is in the task's prefix.
- `frontend/package.json` / lockfile: only A. Any later need for a dependency is reported, not installed.
- `frontend/src/api/types.ts`, `datasource/types.ts`, `modules/clima/types.ts`: frozen after A; a needed change is
  reported to the orchestrator.
- `tokens.css`: B only; D/E report missing tokens (all mockup values are already listed in §7.0).
- `frontend/README.md`: B (main sections), F (e2e section) at different times.
- `CONTRIBUTING.md`: A then B (sequential).

### 9.4 Definition of done (M1)

All of §8 green in CI (backend job unchanged + `check:api`; frontend lint, typecheck, Vitest, build, Playwright);
the five screenshots' Playwright counterparts reviewed against `docs/design/screenshots`; axe clean; every scenario
loads without console errors; no hard-coded user-visible strings (review `grep` for quoted Italian in `src/`).

---

## Deviations (task A)

1. **Every contract property is required in the OpenAPI document (`DomainModel.model_config.json_schema_extra`).**
   §1.2 assumed openapi-typescript would see `"default": null` and make nullable fields present. FastAPI dumps the
   OpenAPI document with `exclude_none`, which drops `"default": null`, so the generator produced `levelId?: string | null`.
   `hestia/core/base.py` now adds a `json_schema_extra` hook that lists every property in `required` (same in
   validation and serialization mode, so still no `-Input`/`-Output` schemas). Result in `schema.d.ts`: every field
   of every contract schema is present, nullable ones typed `T | null` (e.g. `levelId: string | null`,
   `nextChange: NextProgramChange | null`), `Hysteresis.belowC/aboveC: number`. This holds for request bodies too:
   a TS `OverrideCreate` must carry `validUntil` (null unless scope `until`) and an `OverrideChange` must carry all six
   fields (`deltaC`, `targetC`, `levelValueC`, `from`, `to`, `days`), unused ones `null`, as §5.7 already says. The
   server still accepts omitted nullable fields. Only FastAPI's own `HTTPValidationError`/`ValidationError` keep
   optional properties (unused by the UI). A backend test asserts that no contract schema has optional properties.
2. **`pydantic>=2.11` is a direct backend dependency** (`backend/pyproject.toml`, `uv.lock` updated; it was only
   transitive through FastAPI, and the core now imports it). Locked version unchanged (2.14.4).
3. **Validation is slightly stricter than §1.2 lists:** `OverrideCreate` also rejects `validUntil` for scopes other
   than `until`, and any `change` field outside the scope's set (`slot`: targetC/deltaC; `until`: targetC;
   `permanentValue`: levelValueC/targetC; `permanentTimes`: from/to/days). `Program` also rejects slots not sorted by
   `from` and duplicate level ids (both already implied by §1.2).
4. **Small helpers, not on the wire:** `WeekDays.slots(day)`, `OverrideChange.set_fields()`.
5. `package.json` records the new dependencies with caret ranges (`^8.5.1` etc., the repo's existing convention);
   `package-lock.json` pins the exact §1.8 versions. The 503 `ApiError` response is declared router-wide on the clima
   and overrides routers (each operation lists 503 and FastAPI's 422).

## Deviations (task C)

1. **Segment run key includes the slot times**: `${day}|${ref}|${from}-${to}|${value}` (spec: `${day}|${ref}|${value}`).
   A permanent times change (committed or draft) applies only from now on, so the current occurrence is split at
   nowIndex like a value edit; without the times the past and current parts merged and carried the old `slotTo`.
   No effect without edits (oracle parity unchanged).
2. **Draft-split segments**: a draft (or a committed change) splits the current occurrence at nowIndex, so the segment
   key of the selection changes. `logic/segments.ts` exports `findSelectedSegment(lane, selection)` (by key, else by
   `(systemId, day, slotRef)` on a non-past segment). D should use it to keep the editor attached.
3. **`DraftContext` has an extra field `committedC`** (value of a committed `slot` override on the same occurrence, else
   null), and a builder `draftContext(tl, systemId, segment, option)`. `draftForValue` returns null when the value equals
   `committedC ?? programmedC` (slot) or `programmedC` (permanentValue); otherwise stepping back to the programmed value
   while a committed override exists would yield "no draft" and the editor would show the committed value.
   Extra helpers: `committedTimes(ctx)`, `currentDraftTimes(ctx, draft)`; `timeBounds` takes an optional 5th argument
   `current: {from, to}` (the times being edited) for the from < to constraint.
4. **`programmedTargetC` and `SystemView.program` never include the draft** (they reflect the committed state:
   base program + committed permanent changes, no temporary overrides). `targetC`, actions and forecast include it.
5. **`SystemKindSpec.showProgramValue` is a function** `(seg) => boolean` (spec typed it `boolean` but described it as
   "true when targetC != null").
6. **Permanent times validation**: a changed edge must be a multiple of `minuteStep`; an unchanged edge may stay off the
   grid (the home split ends at 08:45 with minuteStep 30). For `dayScope 'all'` the change applies to all 7 days
   regardless of `change.days`; on other days the matching slot is found by ref, else same times, else same index.
7. **File layout**: `effectiveProgram` lives in `mock/overrides.ts` (next to `applyPermanent`, avoiding an import cycle)
   with signature `(base, changes: OverrideCreate[], sys)`; `nextChange` is `(def, grid, programAfterNow)`. Extra file
   `mock/values.ts` builds each system's per-sample value (`SimSystemInput.valueAt`) with committed changes + draft.
   `MockGrid` has extra helpers (`nowMs`, `timeZone`, `partsAt`, `hourAt`, `minuteOfDayAt`, `weekdayAt`, `dayOffsetAt`);
   `SimSystemOutput` has extra arrays `on` and `programmedTarget`; `lib/time.ts` also exports `offsetMs` and
   `localToEpoch(year, month, day, minutes, tz)`.
8. **`getRoomTimeline` validates the draft** with the same rules as `createOverride` and rejects an invalid one with
   `DataSourceError('invalid_change')`. The 24h power summary of a draft-preview timeline includes the draft (like the
   mockup's energy block, which uses the edits).
9. **`overrideId` marking**: a sample is marked by a committed permanent change when its value or slot times changed or
   when it belongs to the changed slot itself; by a slot override whenever the override applies (even if equal).
10. **Lanes of representation `none` have `segments: []`** (spec §8.2 "noProgram: no segments").
11. **Oracle loader path**: built with `path.resolve(dirname(fileURLToPath(import.meta.url)), ...)` instead of
    `new URL(literal, import.meta.url)`, which Vite rewrites into an asset import that it then refuses to serve.
12. `HttpDataSource` accepts an optional `baseUrl` (default `''`). `src/api/datasource/index.ts` also re-exports
    `HttpDataSource`, `MockDataSource`, `MOCK_NOW_ISO`, `MOCK_TIME_ZONE`.

## Deviations (integration)

1. **Reduced motion hides the pulse ring.** `motion.css` adds `.m-pulse::after { display: none }` inside the
   `prefers-reduced-motion` block. With only `animation: none` the ring stayed as a static full-opacity circle over the
   status label (not in the mockup, and it would land in the D12 baselines).
2. **Leaving a screen resets transient state.** StanzaScreen closes the editor (draft discarded) as soon as `:roomId`
   changes, without waiting for the new timeline (`setLastRoom` still does it too), and closes the editor and clears
   the cursor on unmount. TutteScreen clears the cursor on unmount.
3. **Shared helpers instead of per-screen copies:** `components/chartTexts.ts` (`degrees`, `axisTickLabels`,
   `cursorWhen(grid, index, tz)`), `thermogram/samples.ts` (`sampleAt(measured, forecast, i)`) and
   `thermogram/scales.ts` `centerPct(i, n)` (`nowPct` is built on it). `tutteModel.valueAt`/`cursorWhen`/`degrees` and
   RoomTabs' `temperatureText` are gone; Stanza's `cursorText.cursorWhen(tl, i)` is a thin wrapper.
4. **Smoke e2e** scopes the header links to the nav (Tutte rows add "Apri la stanza …" links), asserts `main` visible,
   and adds two cross-screen checks: "apri la stanza" (room + `?scenario` + header state) and the shared range.

## Deviations (task F)

1. **Tutte right column: action text uses `actionTextColor`, not `actionDotColor`** (`screens/Tutte/CursorValues.tsx`).
   axe `color-contrast` (WCAG 1.4.3): the idle/off dot grey `#6A767F` on `--c-panel` is about 3.8:1 for 11px text.
   `actionTextColor` gives `--c-muted` for idle/off (as the Stanza tooltip already does); heat/cool/dry unchanged.
2. **Screenshots grow the viewport to the page height instead of `fullPage: true`**: a full-page capture resizes the
   page while shooting, which dropped the hover cursor from `stanza-cursor.png`. Same pixels otherwise.
3. **CI**: the Playwright step moved from the `frontend` job to a new `e2e` job in `tests.yml` that runs inside
   `mcr.microsoft.com/playwright:v1.65.1-noble` (the image the baselines are rendered in).
4. Fixture option `allowedConsoleErrors` (smoke's `?source=http` test expects Chromium's "status of 503" log);
   the fixture callback is named `run` (the react-hooks lint rule flags `use`). The per-scenario boot loop moved
   from `smoke.spec.ts` to `scenarios.spec.ts`.
5. The "future slot → only permanent options" check uses 7 giorni (the 24h forecast of `home` holds no future slot);
   axe also runs on Stanza 7d and Tutte 7d. `catalog.test.ts` also checks unused keys (allowlist empty).

## Deviations (polish and audit fixes)

Recorded after the M1 audit (22 Nov 2026). Earlier polish changes that no section listed come first.

1. **Mini-chart scale clamp** (`thermogram/scales.ts` `yMiniT`): values are clamped to 15–24 °C like the mockup, so an
   off-scale value (noProgram Corridoio at 14 °C) is drawn on the 15° edge. Accepted; the row's `aria-label` and the
   right column still give the real value.
2. **Extra catalog keys** `mock.system.dehumidifier.short` / `.lower` beyond §6.4 (the manyRooms dehumidifier needs the
   short and lowercase names like every other system), plus `clima.tutte.openFollowedRoomLabel` (item 8).
3. **Lazy screens**: `Layout` wraps the outlet in `Suspense`; `modules/clima/routes/lazyScreens.tsx` holds the
   `React.lazy` imports (one chunk per screen).
4. **Files outside the §2.1/§7.2/§7.3 tree**: `modules/clima/lanes/segmentText.ts` (segment value text and `data-slot`),
   `screens/Tutte/RowChart.tsx` (one mini chart), `modules/clima/ClimaHeaderStatus.tsx` (the module's header status),
   `modules/clima/routes/lazyScreens.tsx` (item 3), `src/lib/program.ts` (`isFullCoverage`, shared by the mock and the
   editor). `components/VisuallyHidden.tsx` is deleted (screens use the `.visually-hidden` class); also removed as
   unused: `usePrefersReducedMotion`, `parseIso`, `MotionClass`, `SystemFactType`.
5. **Program label colour (WCAG 1.4.3)**: white on `--c-rad-hi` is 4.13:1. `logic/colors.ts` `onFillTextColor(fill)`
   keeps white (`--c-on-fill`) where it reaches 4.5:1 and switches to `--c-on-fill-ink` (#000) otherwise (radiator
   values from about 22.5 °C), in `ProgramBar` and `WeekProgram`. The fills are unchanged (oracle parity). New tokens:
   `--c-on-fill`, `--c-on-fill-ink`, `--c-now-glow-end` (end state of the now-dot glow in `motion.css`).
   `e2e/a11y.spec.ts` runs axe on every `home` room in 24 ore and 7 giorni.
6. **Tablet layout** (§7.2 assumed flex-wrap would stack the bottom row; it only did below ~1025 px): inside
   `@media (max-width: 1279px)` PowerCard and WeekProgram (and their skeletons) get `flex-basis: 100%`. Tutte gets
   180/130 px side columns (axis margins to match), and `AxisLabels` is a size container that hides every other day
   label when the axis is narrower than 420 px.
7. **Texts**: `clima.tutte.rowChartLabel` no longer appends `°` (the values come from `chartTexts.degrees()`, so a missing
   target reads "target —"); `fmt.slotTime('24:00')` is `'24:00'` (was `'00:00'`, ambiguous in "19:00–00:00"); the Tutte
   hidden table has a separate humidity column and plain numbers (the outdoor row no longer puts "5,9° · 83%" under
   "Temperatura (°C)"). Shared `chartTexts.temperatureOrMissing` / `percentOrMissing` replace per-file copies.
8. **Accessibility details**: the sensorless row's link is named "Ripostiglio: apri la stanza Bagno" (it was the same
   name as Bagno's link); the Stanza error view keeps the visually hidden `<h1>`.
9. **Cursor keyboard steps** are in minutes (`keyboardStep(key, grid, shift)` with `grid.stepMinutes`): 1 h / 4 h in
   24h, 6 h / 1 day in 7d, whatever the sampling step.
10. **Range change does not morph the paths**: 24h and 7d paths have different command counts, so `transition: d` cannot
    interpolate them (the mockup has the same limit): the lines switch at once and only the bars regrow. Accepted.
