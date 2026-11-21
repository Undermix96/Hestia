"""Weekly program model: levels, slots and the per-representation validation rules."""

import itertools
from typing import Self

from pydantic import Field, model_validator

from hestia.core.base import DomainModel
from hestia.core.literals import (
    WEEKDAYS,
    ClockTime,
    Identifier,
    ProgramRepresentation,
    SlotEnd,
    Weekday,
)


def minutes(value: str) -> int:
    """'HH:MM' -> minutes since midnight ('24:00' -> 1440)."""
    hours, _, mins = value.partition(":")
    return int(hours) * 60 + int(mins)


class Level(DomainModel):
    """A named target value that slots refer to (representation ``levels``)."""

    id: Identifier
    label: str | None = None
    """User-provided label (configuration)."""
    label_key: str | None = None
    """i18n key of the label (adapters, mock data)."""
    target_c: float


class Slot(DomainModel):
    """A time range of one day with its value; the field used depends on the representation."""

    from_: ClockTime = Field(alias="from")
    to: SlotEnd
    level_id: str | None = None
    """Representation ``levels``."""
    target_c: float | None = None
    """Representation ``perSlot``."""
    on: bool | None = None
    """Representation ``onOff``."""
    ref: str = Field(min_length=1)
    """Opaque, adapter-owned reference; unique within its day."""

    @model_validator(mode="after")
    def _check_range(self) -> Self:
        if minutes(self.from_) >= minutes(self.to):
            raise ValueError(
                f"slot {self.ref!r}: 'from' ({self.from_}) must be before 'to' ({self.to})"
            )
        return self


class WeekDays(DomainModel):
    """Slots of each weekday, sorted by start time."""

    mon: list[Slot]
    tue: list[Slot]
    wed: list[Slot]
    thu: list[Slot]
    fri: list[Slot]
    sat: list[Slot]
    sun: list[Slot]

    def slots(self, day: Weekday) -> list[Slot]:
        """Slots of ``day``."""
        result: list[Slot] = getattr(self, day)
        return result


class Program(DomainModel):
    """Weekly program of one system. Gaps between slots are allowed (= not programmed)."""

    representation: ProgramRepresentation
    levels: list[Level] | None = None
    days: WeekDays
    version: str
    """Opaque token for optimistic concurrency."""

    @model_validator(mode="after")
    def _check_program(self) -> Self:
        for day in WEEKDAYS:
            _check_day(day, self.days.slots(day))

        representation = self.representation
        if representation == "levels":
            if not self.levels:
                raise ValueError("representation 'levels' requires at least one level")
            level_ids = [level.id for level in self.levels]
            if len(set(level_ids)) != len(level_ids):
                raise ValueError("level ids must be unique")
            known = set(level_ids)
            for day in WEEKDAYS:
                for slot in self.days.slots(day):
                    if slot.level_id is None:
                        raise ValueError(f"{day} slot {slot.ref!r}: levelId is required")
                    if slot.level_id not in known:
                        raise ValueError(
                            f"{day} slot {slot.ref!r}: unknown level id {slot.level_id!r}"
                        )
            return self

        if self.levels is not None:
            raise ValueError(f"representation {representation!r} must not define levels")
        for day in WEEKDAYS:
            slots = self.days.slots(day)
            if representation == "none" and slots:
                raise ValueError(f"representation 'none' must not have slots ({day})")
            for slot in slots:
                if representation == "perSlot" and slot.target_c is None:
                    raise ValueError(f"{day} slot {slot.ref!r}: targetC is required")
                if representation == "onOff" and slot.on is None:
                    raise ValueError(f"{day} slot {slot.ref!r}: on is required")
        return self


def _check_day(day: Weekday, slots: list[Slot]) -> None:
    refs = [slot.ref for slot in slots]
    if len(set(refs)) != len(refs):
        raise ValueError(f"{day}: slot refs must be unique within the day")
    for previous, current in itertools.pairwise(slots):
        if minutes(previous.from_) > minutes(current.from_):
            raise ValueError(f"{day}: slots must be sorted by start time")
        if minutes(previous.to) > minutes(current.from_):
            raise ValueError(f"{day}: slots {previous.ref!r} and {current.ref!r} overlap")
