"""Tests for the M1 clima and override endpoints (503 until the M2 data source exists)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from hestia.api.errors import NO_DATA_SOURCE
from hestia.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _assert_no_data_source(body: object) -> None:
    assert isinstance(body, dict)
    assert set(body) == {"code", "message"}
    assert body["code"] == NO_DATA_SOURCE
    assert isinstance(body["message"], str)
    assert body["message"]


@pytest.mark.parametrize(
    "path",
    [
        "/api/rooms",
        "/api/clima/rooms/soggiorno/timeline",
        "/api/clima/rooms/soggiorno/timeline?range=7d",
        "/api/clima/overview",
        "/api/clima/overview?range=24h",
    ],
)
def test_get_routes_answer_no_data_source(client: TestClient, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 503
    _assert_no_data_source(response.json())


def test_create_override_answers_no_data_source(client: TestClient) -> None:
    response = client.post(
        "/api/overrides",
        json={
            "systemId": "radiator-soggiorno",
            "slotRef": "fri-1",
            "day": "fri",
            "scope": "slot",
            "change": {"deltaC": 0.5},
        },
    )

    assert response.status_code == 503
    _assert_no_data_source(response.json())


def test_create_override_validates_the_body(client: TestClient) -> None:
    response = client.post(
        "/api/overrides",
        json={
            "systemId": "radiator-soggiorno",
            "slotRef": "fri-1",
            "day": "fri",
            "scope": "slot",
            "change": {"deltaC": 0.5, "targetC": 21.0},
        },
    )

    assert response.status_code == 422


def test_delete_override_answers_no_data_source(client: TestClient) -> None:
    response = client.delete("/api/overrides/ovr-1")

    assert response.status_code == 503
    _assert_no_data_source(response.json())


def test_unknown_range_is_rejected(client: TestClient) -> None:
    assert client.get("/api/clima/overview?range=1y").status_code == 422
    assert client.get("/api/clima/rooms/soggiorno/timeline?range=1y").status_code == 422
