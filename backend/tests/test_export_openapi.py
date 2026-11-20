"""Tests for the OpenAPI exporter used to keep contract/openapi.json in sync."""

import json
from pathlib import Path

import pytest

from hestia.export_openapi import main, render_openapi


def test_document_describes_system_endpoints() -> None:
    document = json.loads(render_openapi())

    assert "/api/health" in document["paths"]
    assert "/api/version" in document["paths"]
    version_schema = document["components"]["schemas"]["VersionResponse"]
    assert set(version_schema["properties"]) == {"version", "apiVersion"}


def test_document_does_not_depend_on_build_version(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HESTIA_VERSION", "9.9.9")
    first = render_openapi()
    monkeypatch.setenv("HESTIA_VERSION", "1.0.0")

    assert render_openapi() == first


def test_write_then_check(tmp_path: Path) -> None:
    output = tmp_path / "openapi.json"

    assert main(["--check", "--output", str(output)]) == 1
    assert main(["--output", str(output)]) == 0
    assert main(["--check", "--output", str(output)]) == 0

    output.write_text("{}\n", encoding="utf-8")
    assert main(["--check", "--output", str(output)]) == 1
