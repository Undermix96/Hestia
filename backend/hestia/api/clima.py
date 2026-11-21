"""Clima endpoints: rooms, room timeline and overview.

M1 has no data source: every handler answers 503 ``no_data_source`` (the UI uses its mock).
The routes and models are the final contract that M2 implements.
"""

from typing import Annotated

from fastapi import APIRouter, Query

from hestia.api.clima_models import ClimaOverview, RoomTimeline, RoomView
from hestia.api.errors import NO_DATA_RESPONSES, DataSourceUnavailableError
from hestia.core.literals import TimeRange

router = APIRouter(tags=["clima"], responses=NO_DATA_RESPONSES)

RangeQuery = Annotated[TimeRange, Query(alias="range")]


@router.get("/rooms", operation_id="getRooms")
def get_rooms() -> list[RoomView]:
    """Every room in configuration order."""
    raise DataSourceUnavailableError


@router.get("/clima/rooms/{room_id}/timeline", operation_id="getRoomTimeline")
def get_room_timeline(room_id: str, range_: RangeQuery = "24h") -> RoomTimeline:
    """Thermogram, program lanes and status of one room over the requested range."""
    raise DataSourceUnavailableError


@router.get("/clima/overview", operation_id="getClimaOverview")
def get_clima_overview(range_: RangeQuery = "24h") -> ClimaOverview:
    """One row per room over the requested range."""
    raise DataSourceUnavailableError
