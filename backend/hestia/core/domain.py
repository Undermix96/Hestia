"""Configuration-level entities: rooms, systems and their adapter bindings.

Not exported on the wire in M1: adapter configurations carry entity ids (and, later, secrets).
"""

from pydantic import Field, JsonValue

from hestia.core.base import DomainModel
from hestia.core.literals import Identifier, SystemBehavior, SystemKind


class AdapterRef(DomainModel):
    """An adapter id with its configuration."""

    type: str = Field(min_length=1)
    """Adapter id, e.g. ``ha_schedule_levels``."""
    config: dict[str, JsonValue]
    config_version: int = Field(ge=1)


class Hysteresis(DomainModel):
    """Comfort band around the target of a thermostatic system."""

    below_c: float = Field(default=0.3, ge=0)
    """Comfort low = target - below_c (the action starts below it)."""
    above_c: float = Field(default=0.2, ge=0)
    """Comfort high = target + above_c (the action stops above it)."""


class Room(DomainModel):
    id: Identifier
    name: str | None = None
    name_key: str | None = None
    sensor: AdapterRef | None = None
    """Room sensor binding."""
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
