"""Shared base model for API payloads: snake_case in Python, camelCase on the wire."""

from hestia.core.base import DomainModel


class ApiModel(DomainModel):
    """Base class for API-only request/response bodies (same camelCase config as the domain)."""


class ApiError(ApiModel):
    """Error body of the public API."""

    code: str
    """Machine code; known: ``no_data_source``, ``not_found``, ``unsupported_scope``,
    ``stale_program``, ``validation_error``. The UI maps it to an i18n key."""
    message: str
    """English, for logs and developers."""
