"""Program changes requested from the UI: temporary overrides and permanent edits."""

from typing import Self

from pydantic import AwareDatetime, Field, model_validator

from hestia.core.base import DomainModel
from hestia.core.literals import ClockTime, OverrideScope, OverrideStatus, SlotEnd, Weekday
from hestia.core.program import minutes


class OverrideChange(DomainModel):
    """What changes; which fields are set depends on the scope (see ``OverrideCreate``)."""

    delta_c: float | None = None
    target_c: float | None = None
    level_value_c: float | None = None
    from_: ClockTime | None = Field(default=None, alias="from")
    to: SlotEnd | None = None
    days: list[Weekday] | None = None

    def set_fields(self) -> frozenset[str]:
        """Python names of the fields that are not ``None``."""
        return frozenset(
            name for name in type(self).model_fields if getattr(self, name) is not None
        )


_ALLOWED_FIELDS: dict[OverrideScope, frozenset[str]] = {
    "slot": frozenset({"target_c", "delta_c"}),
    "until": frozenset({"target_c"}),
    "permanentValue": frozenset({"level_value_c", "target_c"}),
    "permanentTimes": frozenset({"from_", "to", "days"}),
}


class OverrideCreate(DomainModel):
    """Request to change one slot occurrence (``slot_ref`` is unique within ``day``).

    Fields of ``change`` per scope: ``slot`` exactly one of target_c / delta_c; ``until``
    target_c plus ``valid_until``; ``permanentValue`` exactly one of level_value_c / target_c;
    ``permanentTimes`` from_ and to (from_ < to), days optional.
    """

    system_id: str
    slot_ref: str
    day: Weekday
    scope: OverrideScope
    change: OverrideChange
    valid_until: AwareDatetime | None = None
    """Only for scope ``until``."""

    @model_validator(mode="after")
    def _check_scope(self) -> Self:
        scope = self.scope
        fields = self.change.set_fields()
        unexpected = fields - _ALLOWED_FIELDS[scope]
        if unexpected:
            raise ValueError(f"scope {scope!r} does not accept {sorted(unexpected)}")
        if scope == "until":
            if self.valid_until is None:
                raise ValueError("scope 'until' requires validUntil")
        elif self.valid_until is not None:
            raise ValueError(f"scope {scope!r} does not accept validUntil")

        if scope in ("slot", "permanentValue", "until") and len(fields) != 1:
            raise ValueError(f"scope {scope!r} requires exactly one value field")
        if scope == "permanentTimes":
            start, end = self.change.from_, self.change.to
            if start is None or end is None:
                raise ValueError("scope 'permanentTimes' requires from and to")
            if minutes(start) >= minutes(end):
                raise ValueError("scope 'permanentTimes': 'from' must be before 'to'")
        return self


class Override(DomainModel):
    """A stored change and its lifecycle state."""

    id: str
    system_id: str
    slot_ref: str
    day: Weekday
    scope: OverrideScope
    change: OverrideChange
    status: OverrideStatus
    valid_from: AwareDatetime
    valid_until: AwareDatetime | None = None
