"""Capabilities declared by adapters: what the UI may show and offer for a system or source."""

from pydantic import Field

from hestia.core.base import DomainModel
from hestia.core.literals import (
    DayScope,
    Mode,
    OverrideExpiry,
    PowerKind,
    ProgramRepresentation,
    TemporaryOverrideScope,
)


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
    scopes: list[TemporaryOverrideScope]
    """Temporary scopes only; permanent ones come from ``ProgramCapabilities``."""
    future_slots: bool
    """Reserved: the M1 UI ignores it (temporary overrides only on the current slot)."""
    step: float
    min_delta: float
    max_delta: float
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
