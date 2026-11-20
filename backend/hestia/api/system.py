"""System endpoints: liveness and version information."""

from typing import Literal

from fastapi import APIRouter

from hestia.api.schemas import ApiModel
from hestia.app.version import app_version

API_VERSION = 1
"""Major version of the HTTP API contract (``contract/openapi.json``)."""

router = APIRouter(tags=["system"])


class HealthResponse(ApiModel):
    status: Literal["ok"]


class VersionResponse(ApiModel):
    version: str
    api_version: int


@router.get("/health", operation_id="getHealth")
def get_health() -> HealthResponse:
    """Liveness probe used by Docker and the frontend proxy."""
    return HealthResponse(status="ok")


@router.get("/version", operation_id="getVersion")
def get_version() -> VersionResponse:
    """Application version and API contract version."""
    return VersionResponse(version=app_version(), api_version=API_VERSION)
