"""Base class for the domain value models shared by the core and the API contract."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from pydantic.config import JsonDict


def _require_every_property(schema: JsonDict) -> None:
    """List every property as required in the JSON schema.

    The wire format always carries every field (``None`` is sent as ``null``), so the contract
    has no optional properties. Without this, FastAPI drops ``"default": null`` from the
    OpenAPI document and generated clients would see nullable fields as optional.
    """
    properties = schema.get("properties")
    if isinstance(properties, dict):
        schema["required"] = list(properties)


class DomainModel(BaseModel):
    """snake_case in Python, camelCase on the wire; immutable."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        frozen=True,
        json_schema_extra=_require_every_property,
    )
