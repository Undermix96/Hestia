"""Override endpoints: create and delete program changes.

M1 has no data source: every handler answers 503 ``no_data_source`` (the UI uses its mock).
"""

from fastapi import APIRouter, Response

from hestia.api.errors import NO_DATA_RESPONSES, DataSourceUnavailableError
from hestia.core.overrides import Override, OverrideCreate

router = APIRouter(tags=["overrides"], responses=NO_DATA_RESPONSES)


@router.post("/overrides", operation_id="createOverride", status_code=201)
def create_override(body: OverrideCreate) -> Override:
    """Apply a temporary override or a permanent program change to one slot."""
    raise DataSourceUnavailableError


@router.delete(
    "/overrides/{override_id}",
    operation_id="deleteOverride",
    status_code=204,
    response_class=Response,
)
def delete_override(override_id: str) -> None:
    """Revert a stored override."""
    raise DataSourceUnavailableError
