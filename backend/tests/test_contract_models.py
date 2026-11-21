"""Tests for the contract models (core domain values and clima UI aggregates)."""

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import ValidationError

from hestia.api.clima_models import TimeGrid
from hestia.core.domain import AdapterRef, Hysteresis, Room, System
from hestia.core.overrides import OverrideCreate
from hestia.core.program import Program, Slot, minutes
from hestia.export_openapi import render_openapi


def _slot(start: str, end: str, ref: str, **extra: Any) -> dict[str, Any]:
    return {"from": start, "to": end, "ref": ref, **extra}


def _week(*slots: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    return {day: list(slots) for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}


def _levels_program(*slots: dict[str, Any]) -> dict[str, Any]:
    return {
        "representation": "levels",
        "levels": [{"id": "comfort", "targetC": 21.0}, {"id": "eco", "targetC": 18.5}],
        "days": _week(*slots),
        "version": "v1",
    }


# --- Slot ---------------------------------------------------------------------------------


def test_minutes() -> None:
    assert minutes("00:00") == 0
    assert minutes("06:30") == 390
    assert minutes("24:00") == 1440


def test_slot_round_trip_is_camel_case() -> None:
    slot = Slot.model_validate(_slot("06:00", "08:30", "a", levelId="comfort"))

    assert slot.from_ == "06:00"
    assert slot.level_id == "comfort"
    dumped = slot.model_dump(by_alias=True, exclude_none=True)
    assert dumped == {"from": "06:00", "to": "08:30", "levelId": "comfort", "ref": "a"}
    assert Slot.model_validate(dumped) == slot


def test_slot_accepts_end_of_day() -> None:
    assert Slot.model_validate(_slot("22:00", "24:00", "a")).to == "24:00"


@pytest.mark.parametrize(
    ("start", "end"),
    [("24:00", "24:00"), ("6:00", "08:00"), ("08:00", "08:00"), ("09:00", "08:00")],
)
def test_slot_rejects_invalid_ranges(start: str, end: str) -> None:
    with pytest.raises(ValidationError):
        Slot.model_validate(_slot(start, end, "a"))


def test_slot_requires_a_ref() -> None:
    with pytest.raises(ValidationError):
        Slot.model_validate(_slot("06:00", "08:00", ""))


# --- Program ------------------------------------------------------------------------------


def test_levels_program_is_valid() -> None:
    program = Program.model_validate(
        _levels_program(
            _slot("06:00", "08:00", "a", levelId="comfort"),
            _slot("08:00", "17:00", "b", levelId="eco"),
            _slot("18:00", "24:00", "c", levelId="comfort"),
        )
    )

    assert program.days.slots("fri")[2].to == "24:00"
    assert program.model_dump(by_alias=True)["days"]["mon"][0]["levelId"] == "comfort"


@pytest.mark.parametrize(
    "data",
    [
        pytest.param(
            _levels_program(
                _slot("06:00", "09:00", "a", levelId="comfort"),
                _slot("08:00", "17:00", "b", levelId="eco"),
            ),
            id="overlap",
        ),
        pytest.param(
            _levels_program(
                _slot("08:00", "17:00", "b", levelId="eco"),
                _slot("06:00", "08:00", "a", levelId="comfort"),
            ),
            id="unsorted",
        ),
        pytest.param(
            _levels_program(
                _slot("06:00", "08:00", "a", levelId="comfort"),
                _slot("08:00", "17:00", "a", levelId="eco"),
            ),
            id="duplicate-ref",
        ),
        pytest.param(_levels_program(_slot("06:00", "08:00", "a")), id="missing-level"),
        pytest.param(
            _levels_program(_slot("06:00", "08:00", "a", levelId="boost")), id="unknown-level"
        ),
        pytest.param(
            {**_levels_program(), "levels": []},
            id="levels-without-levels",
        ),
        pytest.param(
            {
                **_levels_program(),
                "levels": [{"id": "a", "targetC": 20.0}, {"id": "a", "targetC": 21.0}],
            },
            id="duplicate-level-id",
        ),
        pytest.param(
            {
                "representation": "none",
                "days": _week(_slot("06:00", "08:00", "a")),
                "version": "v1",
            },
            id="none-with-slots",
        ),
        pytest.param(
            {
                "representation": "perSlot",
                "days": _week(_slot("06:00", "08:00", "a")),
                "version": "v1",
            },
            id="perSlot-without-target",
        ),
        pytest.param(
            {
                "representation": "perSlot",
                "levels": [{"id": "a", "targetC": 20.0}],
                "days": _week(_slot("06:00", "08:00", "a", targetC=20.0)),
                "version": "v1",
            },
            id="perSlot-with-levels",
        ),
        pytest.param(
            {
                "representation": "onOff",
                "days": _week(_slot("06:00", "08:00", "a")),
                "version": "v1",
            },
            id="onOff-without-on",
        ),
    ],
)
def test_program_rejects_invalid_programs(data: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        Program.model_validate(data)


def test_other_representations_are_valid() -> None:
    Program.model_validate({"representation": "none", "days": _week(), "version": "v1"})
    Program.model_validate(
        {
            "representation": "perSlot",
            "days": _week(_slot("06:00", "08:00", "a", targetC=20.5)),
            "version": "v1",
        }
    )
    Program.model_validate(
        {
            "representation": "onOff",
            "days": _week(_slot("06:00", "08:00", "a", on=True)),
            "version": "v1",
        }
    )


# --- OverrideCreate -----------------------------------------------------------------------

_VALID_UNTIL = "2026-11-20T12:00:00+01:00"


def _override(scope: str, change: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {
        "systemId": "radiator-soggiorno",
        "slotRef": "a",
        "day": "fri",
        "scope": scope,
        "change": change,
        **extra,
    }


@pytest.mark.parametrize(
    "data",
    [
        _override("slot", {"targetC": 21.5}),
        _override("slot", {"deltaC": -0.5}),
        _override("until", {"targetC": 21.5}, validUntil=_VALID_UNTIL),
        _override("permanentValue", {"levelValueC": 20.0}),
        _override("permanentValue", {"targetC": 20.0}),
        _override("permanentTimes", {"from": "06:30", "to": "08:00"}),
        _override("permanentTimes", {"from": "06:30", "to": "24:00", "days": ["sat", "sun"]}),
    ],
)
def test_override_create_accepts_the_scope_matrix(data: dict[str, Any]) -> None:
    OverrideCreate.model_validate(data)


@pytest.mark.parametrize(
    "data",
    [
        _override("slot", {}),
        _override("slot", {"targetC": 21.5, "deltaC": 0.5}),
        _override("slot", {"levelValueC": 21.5}),
        _override("slot", {"targetC": 21.5}, validUntil=_VALID_UNTIL),
        _override("until", {"targetC": 21.5}),
        _override("until", {"deltaC": 0.5}, validUntil=_VALID_UNTIL),
        _override("until", {"targetC": 21.5}, validUntil="2026-11-20T12:00:00"),
        _override("permanentValue", {}),
        _override("permanentValue", {"levelValueC": 20.0, "targetC": 20.0}),
        _override("permanentValue", {"deltaC": 0.5}),
        _override("permanentTimes", {"from": "06:30"}),
        _override("permanentTimes", {"from": "08:00", "to": "06:30"}),
        _override("permanentTimes", {"from": "06:30", "to": "08:00", "targetC": 20.0}),
        _override("permanentTimes", {"from": "06:30", "to": "08:00", "days": ["fry"]}),
        _override("forever", {"targetC": 21.5}),
    ],
)
def test_override_create_rejects_invalid_changes(data: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        OverrideCreate.model_validate(data)


def test_override_create_dumps_camel_case() -> None:
    body = OverrideCreate.model_validate(
        _override("permanentTimes", {"from": "06:30", "to": "08:00"})
    )

    assert body.model_dump(by_alias=True, exclude_none=True) == _override(
        "permanentTimes", {"from": "06:30", "to": "08:00"}
    )


# --- Configuration entities ---------------------------------------------------------------


def test_room_and_system_with_adapter_refs() -> None:
    sensor = AdapterRef(type="ha_sensor", config={"entity": "sensor.t"}, config_version=1)
    room = Room(id="soggiorno", name_key="mock.room.soggiorno", sensor=sensor, system_ids=["rad"])
    system = System(
        id="rad",
        kind="radiator",
        room_ids=["soggiorno"],
        behavior="thermostatic",
        hysteresis=Hysteresis(),
        driver=AdapterRef(type="ha_climate", config={}, config_version=1),
        program=AdapterRef(type="ha_schedule_levels", config={"levels": [1, 2]}, config_version=1),
        override=AdapterRef(type="hestia_overrides", config={}, config_version=1),
    )

    assert room.model_dump(by_alias=True)["systemIds"] == ["rad"]
    assert system.hysteresis.below_c == 0.3
    assert system.hysteresis.above_c == 0.2
    with pytest.raises(ValidationError):
        AdapterRef(type="x", config={}, config_version=0)
    with pytest.raises(ValidationError):
        Room(id="Soggiorno", system_ids=[])


# --- UI aggregates ------------------------------------------------------------------------


def test_time_grid_dumps_camel_case() -> None:
    start = datetime(2026, 11, 19, 6, 0, tzinfo=UTC)
    t = [start + timedelta(minutes=30 * i) for i in range(52)]
    grid = TimeGrid(
        range="24h",
        step_minutes=30,
        count=52,
        now_index=48,
        t=t,
        end=t[-1] + timedelta(minutes=30),
    )

    dumped = grid.model_dump(by_alias=True, mode="json")
    assert {"range", "stepMinutes", "count", "nowIndex", "t", "end"} == set(dumped)
    assert dumped["nowIndex"] == 48


# --- OpenAPI document ---------------------------------------------------------------------


def test_openapi_contains_the_contract_schemas() -> None:
    schemas: dict[str, Any] = json.loads(render_openapi())["components"]["schemas"]

    for name in (
        "RoomTimeline",
        "ClimaOverview",
        "ProgramSegment",
        "Override",
        "OverrideCreate",
        "ApiError",
        "SystemCapabilities",
    ):
        assert name in schemas
    assert not [name for name in schemas if name.endswith(("-Input", "-Output"))]
    segment = set(schemas["ProgramSegment"]["properties"])
    assert {"startIndex", "slotFrom", "programmedTargetC"} <= segment
    assert "from" in schemas["Slot"]["properties"]


def test_contract_schemas_have_no_optional_properties() -> None:
    schemas: dict[str, Any] = json.loads(render_openapi())["components"]["schemas"]
    framework = {"HTTPValidationError", "ValidationError"}

    for name, schema in schemas.items():
        if name in framework or "properties" not in schema:
            continue
        assert set(schema.get("required", [])) == set(schema["properties"]), name
