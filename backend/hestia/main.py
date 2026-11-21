"""ASGI entry point: ``uvicorn hestia.main:app``."""

from fastapi import FastAPI

from hestia.api import clima, overrides, system
from hestia.api.errors import install_error_handlers
from hestia.api.system import API_VERSION


def create_app() -> FastAPI:
    """Build the FastAPI application with every router mounted under ``/api``."""
    app = FastAPI(
        title="Hestia API",
        # The OpenAPI document versions the contract, not the build, so it stays reproducible.
        version=str(API_VERSION),
        license_info={"name": "MIT", "identifier": "MIT"},
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.include_router(system.router, prefix="/api")
    app.include_router(clima.router, prefix="/api")
    app.include_router(overrides.router, prefix="/api")
    install_error_handlers(app)
    return app


app = create_app()
