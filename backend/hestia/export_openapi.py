"""Export the OpenAPI document to ``contract/openapi.json``.

Usage (from ``backend/``)::

    uv run python -m hestia.export_openapi          # write the file
    uv run python -m hestia.export_openapi --check  # fail if the file is out of date
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from hestia.main import create_app

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "contract" / "openapi.json"


def render_openapi() -> str:
    """Return the OpenAPI document as stable, pretty-printed JSON (LF line endings)."""
    schema: dict[str, Any] = create_app().openapi()
    return json.dumps(schema, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit with status 1 if the file differs from the generated document",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"output path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)
    output: Path = args.output
    rendered = render_openapi()

    if args.check:
        current = output.read_text(encoding="utf-8") if output.exists() else None
        if current != rendered:
            print(
                f"{output} is out of date. Regenerate it with "
                "`uv run python -m hestia.export_openapi` and commit the result.",
                file=sys.stderr,
            )
            return 1
        print(f"{output} is up to date.")
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
