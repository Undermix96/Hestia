"""Literal aliases and string patterns shared by the domain models and the API contract."""

from typing import Annotated, Final, Literal

from pydantic import Field

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAYS: Final[tuple[Weekday, ...]] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

SystemKind = str
"""Kind of a climate system. Known values are in ``KNOWN_SYSTEM_KINDS``; any string is valid."""
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

ClockTime = Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]
"""Wall-clock time of day, ``00:00``-``23:59``."""

SlotEnd = Annotated[str, Field(pattern=r"^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$")]
"""End of a slot, ``00:00``-``24:00`` (``24:00`` = end of the day)."""

Identifier = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9_-]*$")]
"""Configuration identifier (rooms, systems, levels)."""
