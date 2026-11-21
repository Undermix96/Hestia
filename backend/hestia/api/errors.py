"""API error types and their HTTP handlers."""

from typing import Any, Final

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from hestia.api.schemas import ApiError

NO_DATA_SOURCE: Final = "no_data_source"


class DataSourceUnavailableError(Exception):
    """Raised by endpoints whose data source arrives in M2."""


async def data_source_unavailable_handler(request: Request, exc: Exception) -> JSONResponse:
    """Answer 503 with an ``ApiError`` body."""
    body = ApiError(
        code=NO_DATA_SOURCE,
        message=(
            "No data source is configured yet: real data arrives in M2; "
            "the UI uses its mock data source."
        ),
    )
    return JSONResponse(status_code=503, content=body.model_dump(by_alias=True))


def install_error_handlers(app: FastAPI) -> None:
    """Register the handlers of the API error types on ``app``."""
    app.add_exception_handler(DataSourceUnavailableError, data_source_unavailable_handler)


NO_DATA_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    503: {"model": ApiError, "description": "No data source until M2."},
}
