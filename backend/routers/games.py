"""Game lifecycle: create, resume, submit a round, end, rematch.

The scoring/doubling rule here is a direct port of the old frontend's
`finalizeRound` (see docs/game-rules.md): the closer's round score doubles
unless it is *strictly* the lowest of the round -- ties do not protect the
closer. The rule now lives here because the backend is the source of truth
for game state; the frontend only displays what this returns.

The STAR card and column/row removal (Skyjo Action's extra rule beyond base
Skyjo) are grid-calculator concepts that live entirely in the frontend -- by
the time a round reaches this router, each player's score is already just an
integer, so none of that shows up here.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_conn
from .players import ensure_in_roster

router = APIRouter()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_game(conn, game_id: int):
    game = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
    if not game:
        return None

    players = conn.execute(
        "SELECT id, name, position FROM game_players WHERE game_id = ? ORDER BY position",
        (game_id,),
    ).fetchall()
    totals = {p["id"]: 0 for p in players}

    rounds = conn.execute(
        "SELECT id, round_number, closer_game_player_id, closer_doubled "
        "FROM rounds WHERE game_id = ? ORDER BY round_number",
        (game_id,),
    ).fetchall()
    rounds_out = []
    for r in rounds:
        score_rows = conn.execute(
            "SELECT game_player_id, score FROM round_scores WHERE round_id = ?",
            (r["id"],),
        ).fetchall()
        scores = {row["game_player_id"]: row["score"] for row in score_rows}
        for pid, sc in scores.items():
            totals[pid] = totals.get(pid, 0) + sc
        rounds_out.append(
            {
                "round_number": r["round_number"],
                "closer_game_player_id": r["closer_game_player_id"],
                "closer_doubled": bool(r["closer_doubled"]),
                "scores": scores,
            }
        )

    game_over = any(t >= game["target_score"] for t in totals.values())

    return {
        "id": game["id"],
        "status": game["status"],
        "target_score": game["target_score"],
        "players": [
            {"id": p["id"], "name": p["name"], "position": p["position"]} for p in players
        ],
        "rounds": rounds_out,
        "totals": totals,
        "game_over": game_over,
    }


@router.get("/active")
def get_active_game():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM games WHERE status = 'playing' ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        return serialize_game(conn, row["id"]) if row else None


class CreateGameIn(BaseModel):
    players: list[str]


@router.post("")
def create_game(body: CreateGameIn):
    if not (2 <= len(body.players) <= 8):
        raise HTTPException(400, "2 to 8 players required")
    with get_conn() as conn:
        # Defensive: there should never be more than one playing game, but
        # don't leave an orphaned one behind if the frontend got out of sync.
        conn.execute(
            "UPDATE games SET status = 'finished', finished_at = ? WHERE status = 'playing'",
            (now_iso(),),
        )
        cur = conn.execute(
            "INSERT INTO games (status, created_at) VALUES ('playing', ?)", (now_iso(),)
        )
        game_id = cur.lastrowid
        for i, name in enumerate(body.players):
            name = name.strip()
            conn.execute(
                "INSERT INTO game_players (game_id, name, position) VALUES (?, ?, ?)",
                (game_id, name, i),
            )
            ensure_in_roster(conn, name)
        return serialize_game(conn, game_id)


class SubmitRoundIn(BaseModel):
    scores: dict[int, int]
    closer_game_player_id: int


@router.post("/{game_id}/rounds")
def submit_round(game_id: int, body: SubmitRoundIn):
    with get_conn() as conn:
        game = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game or game["status"] != "playing":
            raise HTTPException(404, "no active game with that id")

        player_ids = {
            row["id"]
            for row in conn.execute(
                "SELECT id FROM game_players WHERE game_id = ?", (game_id,)
            ).fetchall()
        }
        if set(body.scores.keys()) != player_ids:
            raise HTTPException(400, "a score is required for every player")
        if body.closer_game_player_id not in player_ids:
            raise HTTPException(400, "closer_game_player_id is not a player in this game")

        scores = dict(body.scores)
        closer_id = body.closer_game_player_id
        closer_score = scores[closer_id]
        is_strictly_lowest = all(
            pid == closer_id or scores[pid] > closer_score for pid in player_ids
        )
        closer_doubled = not is_strictly_lowest
        if closer_doubled:
            scores[closer_id] = closer_score * 2

        round_number = conn.execute(
            "SELECT COALESCE(MAX(round_number), 0) + 1 AS n FROM rounds WHERE game_id = ?",
            (game_id,),
        ).fetchone()["n"]
        cur = conn.execute(
            "INSERT INTO rounds (game_id, round_number, closer_game_player_id, closer_doubled) "
            "VALUES (?, ?, ?, ?)",
            (game_id, round_number, closer_id, int(closer_doubled)),
        )
        round_id = cur.lastrowid
        for pid, sc in scores.items():
            conn.execute(
                "INSERT INTO round_scores (round_id, game_player_id, score) VALUES (?, ?, ?)",
                (round_id, pid, sc),
            )

        result = serialize_game(conn, game_id)
        if result["game_over"] and game["status"] == "playing":
            conn.execute(
                "UPDATE games SET status = 'finished', finished_at = ? WHERE id = ?",
                (now_iso(), game_id),
            )
            result["status"] = "finished"
        return result


@router.post("/{game_id}/end")
def end_game(game_id: int):
    with get_conn() as conn:
        game = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            raise HTTPException(404, "game not found")
        if game["status"] == "playing":
            conn.execute(
                "UPDATE games SET status = 'finished', finished_at = ? WHERE id = ?",
                (now_iso(), game_id),
            )
        return serialize_game(conn, game_id)


@router.post("/{game_id}/rematch")
def rematch(game_id: int):
    with get_conn() as conn:
        old = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not old:
            raise HTTPException(404, "game not found")
        if old["status"] == "playing":
            conn.execute(
                "UPDATE games SET status = 'finished', finished_at = ? WHERE id = ?",
                (now_iso(), game_id),
            )
        old_players = conn.execute(
            "SELECT name, position FROM game_players WHERE game_id = ? ORDER BY position",
            (game_id,),
        ).fetchall()
        cur = conn.execute(
            "INSERT INTO games (status, created_at) VALUES ('playing', ?)", (now_iso(),)
        )
        new_id = cur.lastrowid
        for p in old_players:
            conn.execute(
                "INSERT INTO game_players (game_id, name, position) VALUES (?, ?, ?)",
                (new_id, p["name"], p["position"]),
            )
        return serialize_game(conn, new_id)
