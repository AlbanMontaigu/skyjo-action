"""Anthropic API key storage. The key is write-only from the client's point
of view -- GET only ever reports whether one is set, never the value itself,
since it's proxied server-side now instead of living in the browser."""

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_conn

router = APIRouter()

API_KEY_SETTING = "anthropic_api_key"


class ApiKeyIn(BaseModel):
    api_key: str


@router.get("")
def get_settings():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (API_KEY_SETTING,)
        ).fetchone()
    return {"has_api_key": bool(row and row["value"])}


@router.put("/api-key")
def save_api_key(body: ApiKeyIn):
    key = body.api_key.strip()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (API_KEY_SETTING, key),
        )
    return {"has_api_key": bool(key)}


@router.delete("/api-key")
def remove_api_key():
    with get_conn() as conn:
        conn.execute("DELETE FROM settings WHERE key = ?", (API_KEY_SETTING,))
    return {"has_api_key": False}


def get_api_key() -> str | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (API_KEY_SETTING,)
        ).fetchone()
    return row["value"] if row and row["value"] else None
