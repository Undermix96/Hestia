"""Application version, injected at image build time through ``HESTIA_VERSION``."""

import os

DEFAULT_VERSION = "0.0.0-dev"
VERSION_ENV_VAR = "HESTIA_VERSION"


def app_version() -> str:
    """Return the running application version (read on every call, so tests can override it)."""
    return os.environ.get(VERSION_ENV_VAR) or DEFAULT_VERSION
