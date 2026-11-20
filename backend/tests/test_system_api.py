"""Tests for the system endpoints (/api/health, /api/version)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from hestia.app.version import DEFAULT_VERSION, VERSION_ENV_VAR
from hestia.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_defaults_to_dev_version(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv(VERSION_ENV_VAR, raising=False)

    response = client.get("/api/version")

    assert response.status_code == 200
    assert response.json() == {"version": DEFAULT_VERSION, "apiVersion": 1}
    assert DEFAULT_VERSION == "0.0.0-dev"


def test_version_reads_env_override(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(VERSION_ENV_VAR, "1.2.3")

    response = client.get("/api/version")

    assert response.status_code == 200
    assert response.json() == {"version": "1.2.3", "apiVersion": 1}


def test_unknown_api_route_returns_404(client: TestClient) -> None:
    assert client.get("/api/does-not-exist").status_code == 404
