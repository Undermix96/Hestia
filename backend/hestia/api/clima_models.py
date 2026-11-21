"""UI aggregates of the clima module: what the room timeline and overview endpoints return.

Every list of a series has ``grid.count`` items; sample ``i`` starts at ``grid.t[i]``.
"""

from typing import Literal

from pydantic import AwareDatetime

from hestia.api.schemas import ApiModel
from hestia.core.capabilities import SourceCapabilities, SystemCapabilities
from hestia.core.domain import Hysteresis
from hestia.core.literals import (
    Action,
    Mode,
    ProgramRepresentation,
    SegmentState,
    SystemBehavior,
    TimeRange,
    Weekday,
)
from hestia.core.overrides import Override
from hestia.core.program import Program


class ClockInfo(ApiModel):
    now: AwareDatetime
    time_zone: str
    """IANA time zone, e.g. ``Europe/Rome``."""


class TimeGrid(ApiModel):
    range: TimeRange
    step_minutes: int
    count: int
    now_index: int
    """Sample containing ``clock.now``."""
    t: list[AwareDatetime]
    """``len == count``; ``t[i]`` is the start of sample ``i``."""
    end: AwareDatetime
    """``t[count - 1] + step``."""


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


class SystemState(ApiModel):
    """State of a system at ``clock.now``."""

    mode: Mode | None = None
    action: Action | None = None
    target_c: float | None = None


class SystemView(ApiModel):
    id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    room_ids: list[str]
    primary_room_id: str
    """First of ``room_ids`` with a sensor (else ``room_ids[0]``)."""
    behavior: SystemBehavior
    hysteresis: Hysteresis
    capabilities: SystemCapabilities
    program: Program | None = None
    """Effective program (permanent changes applied); ``None`` if not readable."""
    state: SystemState
    adapters: AdapterTypes


class SystemStatus(ApiModel):
    """One system as seen from one room, at ``clock.now``."""

    system_id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    action: Action | None = None
    mode: Mode | None = None
    target_c: float | None = None
    via_room_id: str | None = None
    """Set when this room is not the system's primary room (shared zone)."""


class RoomStatus(ApiModel):
    room_id: str
    name: str | None = None
    name_key: str | None = None
    has_sensor: bool
    follows_room_id: str | None = None
    temperature_c: float | None = None
    humidity_pct: float | None = None
    systems: list[SystemStatus]


class RoomClimateSeries(ApiModel):
    measured_c: list[float | None]
    """Value for ``i <= now_index``, else ``None``."""
    forecast_c: list[float | None]
    """Value for ``i >= now_index``, else ``None`` (both set at ``now_index``)."""
    measured_humidity_pct: list[float | None]
    forecast_humidity_pct: list[float | None]


class TargetSeries(ApiModel):
    """Comfort band of the thermogram."""

    target_c: list[float | None]
    comfort_low_c: list[float | None]
    """Target - ``hysteresis.below_c`` of the source system."""
    comfort_high_c: list[float | None]
    """Target + ``hysteresis.above_c``."""
    source_system_ids: list[str | None]


class ProgramSegment(ApiModel):
    """One run of one slot occurrence with one effective value, clipped to the grid."""

    key: str
    """Stable: ``{system_id}|{day or 'gap'}|{slot_ref or 'gap'}|{start_index}``."""
    start_index: int
    """Inclusive."""
    end_index: int
    """Exclusive."""
    start: AwareDatetime
    end: AwareDatetime
    slot_ref: str | None = None
    """``None`` = gap (not programmed)."""
    day: Weekday | None = None
    slot_from: str | None = None
    """``HH:MM`` of the slot definition (not clipped)."""
    slot_to: str | None = None
    """``HH:MM`` (may be ``24:00``)."""
    level_id: str | None = None
    target_c: float | None = None
    """Effective value (overrides and draft applied)."""
    programmed_target_c: float | None = None
    """Value of the program without temporary overrides."""
    on: bool | None = None
    state: SegmentState
    edited: bool
    """A committed override or the preview draft changes it (never true when past)."""
    override_id: str | None = None
    """Committed override affecting it (``None`` for the draft)."""


class NextProgramChange(ApiModel):
    at: AwareDatetime
    change: Literal["target", "on", "off"]
    target_c: float | None = None


class SystemSeries(ApiModel):
    system_id: str
    kind: str
    name: str | None = None
    name_key: str | None = None
    target_c: list[float | None]
    """Effective target/set point per sample (``None`` = not programmed / off)."""
    action: list[Action | None]
    mode: list[Mode | None]


class SystemLane(SystemSeries):
    representation: ProgramRepresentation
    segments: list[ProgramSegment]
    next_change: NextProgramChange | None = None
    """First program change strictly after ``clock.now`` within 24 h."""


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
    month: int
    """1-12, local month of ``clock.now``."""
    month_kwh: float | None = None
    month_cost: float | None = None
    currency: str
    tariff_per_kwh: float | None = None
    measured_system_ids: list[str]
    unmeasured_kinds: list[str]
    """Distinct kinds whose ``power.kind`` is ``none``."""


class RoomTimeline(ApiModel):
    """``GET /api/clima/rooms/{room_id}/timeline``."""

    clock: ClockInfo
    grid: TimeGrid
    room: RoomView
    rooms: list[RoomStatus]
    """Every room in configuration order."""
    climate: RoomClimateSeries
    target: TargetSeries
    lanes: list[SystemLane]
    """Systems serving the room, in lane order."""
    outdoor: OutdoorSeries
    power: PowerSummary
    """House level, independent of the range."""
    systems: list[SystemView]
    """Same order as ``lanes``."""
    overrides: list[Override]
    """Committed overrides of the room's systems."""
    sources: SourceCapabilities


class OverviewRow(ApiModel):
    room: RoomView
    status: RoomStatus
    climate: RoomClimateSeries | None = None
    """``None`` without a sensor."""
    target: TargetSeries | None = None
    systems: list[SystemSeries]
    """Every system serving the room (shared zones included)."""


class ClimaOverview(ApiModel):
    """``GET /api/clima/overview``."""

    clock: ClockInfo
    grid: TimeGrid
    rows: list[OverviewRow]
    """Every room in configuration order."""
    outdoor: OutdoorSeries
    sources: SourceCapabilities
