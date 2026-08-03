"""Known-player roster, offered as one-tap choices in the name picker."""

from fastapi import APIRouter

from ..db import get_conn

router = APIRouter()


@router.get("/known")
def list_known_players():
    with get_conn() as conn:
        rows = conn.execute("SELECT name FROM roster_players ORDER BY id").fetchall()
    return {"names": [r["name"] for r in rows]}


def ensure_in_roster(conn, name: str):
    conn.execute("INSERT OR IGNORE INTO roster_players (name) VALUES (?)", (name,))
