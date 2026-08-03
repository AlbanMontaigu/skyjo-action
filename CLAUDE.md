# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Skyjo Action score sheet, split into a **FastAPI + SQLite backend**
(`backend/`) and a **vanilla JS frontend** (`frontend/`) with no build step.
The backend owns game state, the known-player roster and the Anthropic API
key in SQLite; the frontend is a single-page app served as static files,
talking to the backend over `/api/*`.

This is a rewrite of an earlier single-file `index.html` version (React +
Babel from CDN, no backend, no persistence — see git history before this
change). The old version's one documented pain point, "a reload loses the
game in progress," motivated the move: SQLite now survives reloads and
restarts.

This is **Skyjo Action**, not base Skyjo: beyond the standard rules, it adds
the Star card (a joker worth 0, distinct from the blue `0`) and lets a full
*row* of 4 identical cards be discarded, not just a column of 3. See "Domain
notes" below before touching anything rule-shaped.

## Hard constraints

- **No build step on the frontend.** `frontend/` is plain HTML/CSS/JS loaded
  via native ES modules (`<script type="module">`). No bundler, no `npm`, no
  transpiler. If a change seems to need one, it's the wrong change.
- **No frontend framework.** No React, no client-side templating library.
  Rendering is `state → render() → #app.innerHTML`, described in
  `docs/architecture.md`. Keep new UI in that pattern.
- **The Anthropic API key never reaches the browser.** It lives in the
  `settings` SQLite table and is used only inside `backend/routers/vision.py`.
  `GET /api/settings` reports whether a key is set, never the value. Don't add
  an endpoint that returns it.
- **Minimal backend dependencies.** Plain `sqlite3` (stdlib), no ORM — the
  schema is small enough that raw SQL stays readable. Don't introduce
  SQLAlchemy or similar without a real reason to.
- **One network dependency beyond the Anthropic call:** nothing else talks to
  the outside world. Don't add analytics, telemetry, or other third-party
  calls.
- **Single process, single container.** One FastAPI app serves both `/api/*`
  and the static frontend (`app.mount("/", StaticFiles(...))` in `main.py`) —
  same origin, no CORS. Don't split this into separate frontend/backend
  deployments; the `Dockerfile` builds and runs exactly one image.

## Language convention

- **User-facing text is French** — every label, button, hint, error message
  and the vision prompt sent to Claude.
- **Code is English** — identifiers, comments, commit messages, and this file.
- **Docs**: `README.md` and `docs/` are French, matching the product.

Keep both sides consistent when you touch a string.

## Code conventions

### Backend (`backend/`)

- `backend` is a real Python package (`backend/__init__.py`,
  `backend/routers/__init__.py`) — imports are relative (`from .db import
  ...` in `main.py`, `from ..db import ...` from a `routers/` module). This is
  what lets every entry point (`server.py`, `uvicorn backend.main:app`, the
  `Dockerfile`) run from the repo root with no `sys.path` hacks. Keep new
  modules consistent with that; don't reintroduce bare `from db import ...`
  style imports that only work with `backend/` as the cwd.
- Plain `sqlite3` with `Row` factory (`db.py`), one `get_conn()` context
  manager per request. No ORM.
- One router module per resource under `backend/routers/`; each owns its own
  Pydantic request models.
- The doubling rule and all game-state mutation happen server-side
  (`routers/games.py`) — the backend is authoritative, the frontend only
  displays what it returns. Don't move scoring logic back to the client. The
  STAR card and column/row removal never reach this router: by the time a
  round is submitted, each player's score is already a plain integer.
- `routers/vision.py` is a near-verbatim port of the old client-side call,
  now server-side (the key comes from the `settings` table, not the browser)
  — see "Touching the photo feature" below before changing it.

### Frontend (`frontend/js/`)

- No virtual DOM, no diffing. `state.render()` (`state.js`) rebuilds
  `#app.innerHTML` from the `state` object on every *structural* change (modal
  open/close, phase switch, player add/remove, round submitted).
- Click/change handling is **delegated once** on `#app` in `events.js`
  (`data-action` attributes), so it survives `innerHTML` replacement without
  manual rebinding. New interactive elements need a `data-action` (and
  `data-*` params), not an inline handler.
- Text/number inputs (`data-bind` attributes) update `state` directly on
  `input`, **without calling `render()`** — this is what preserves cursor
  position while typing, since the DOM node is never touched. Don't add a
  `render()` call to an `input` handler; if a field needs one, it should be a
  `data-action` (e.g. a button), not a live-bound field.
- State is a single mutable object (`state.js`), mutated directly — no
  immutable-update spreading. Player ids from `state.players` are the
  backend's numeric `game_player_id`; setup-phase ids (`state.setupPlayers`)
  are local `uid()` strings. `dataset.*` values are always strings, so
  handlers acting on backend players convert with `Number()`.
- Icons are plain functions returning SVG markup strings (`icons.js`), same
  path data as the old inline JSX icons. Add new ones the same way.

## Verifying a change

There are no automated tests. To check a change end-to-end:

```bash
python -m venv .venv && .venv\Scripts\activate   # .venv/bin/activate on macOS/Linux
pip install -r backend/requirements.txt
python server.py
```

Then open <http://localhost:8000> — FastAPI serves `frontend/` and `/api/*`
from the same origin. FastAPI's autogenerated docs at `/docs` are useful for
poking individual endpoints while working on the backend. `server.py` is a
thin convenience wrapper around `uvicorn backend.main:app`; either works.
Neither uses `--reload` — it runs a file watcher continuously for a one-off
local run; restart the process after a change instead.

See [docs/development.md](docs/development.md) for the full manual checklist.
At minimum, after any change to scoring or the grid:

1. Setup with 2 players → start.
2. Fill one score via the 3×4 grid (including a Star card), one by hand →
   validate → pick a closer.
3. Confirm the doubling rule fired (or didn't) as expected in the history
   modal.
4. Reload the page mid-game — it should resume where you left off.

## Where things are

| Area | Location |
| --- | --- |
| DB schema | `backend/schema.sql` |
| Scoring / doubling rule | `backend/routers/games.py` |
| Vision prompt, model call | `backend/routers/vision.py` |
| Settings (API key) | `backend/routers/settings.py` |
| App state + render dispatcher | `frontend/js/state.js` |
| Event delegation + handlers | `frontend/js/events.js` |
| Screens (Header/Setup/Playing) | `frontend/js/views/` |
| Modals (all 9) | `frontend/js/modals.js` |
| Domain constants & helpers | `frontend/js/domain.js` (`STAR`, `REMOVED`, `isCard()`, `cardValue()`, `band()`, `CARD_VALUES`, `TARGET`) |
| Inline SVG icons | `frontend/js/icons.js` |
| Backend fetch wrappers | `frontend/js/api.js` |
| HTML escaping | `frontend/js/util.js` (`escapeHtml()`, used by every render function that interpolates a player name) |
| Styles | `frontend/css/style.css` (+ fonts/keyframes in `frontend/index.html`'s `<head>`) |
| Container build (Coolify, etc.) | `Dockerfile` at repo root — see [docs/development.md](docs/development.md) |
| Local dev entry point | `server.py` at repo root (`python server.py`, wraps `uvicorn backend.main:app`, no `--reload`) |

## Domain notes worth knowing

- A grid cell holds one of: a number (−2…12), `STAR` (`"s"`, a joker worth 0
  but a physically distinct card from the blue `0`), `REMOVED` (`"x"`, a
  discarded full column or row), or `null` (card present but not entered
  yet).
- Removing a column or a row removes **all** its cells at once — that mirrors
  the Skyjo rule where 3 or 4 identical cards are discarded together. Never
  expose a per-cell "remove".
- The closer's round score doubles unless it is *strictly* the lowest of the
  round. Ties do not protect the closer.

## Touching the photo feature

The model id, `max_tokens` and `output_config` are coupled — thinking is on
by default on this model and shares the token budget with the answer, and
`temperature` is rejected outright. Read
[docs/photo-scoring.md](docs/photo-scoring.md) before changing any of them,
and check the current model guidance rather than assuming the API surface is
what it was when this was written. The call itself lives in
`backend/routers/vision.py`.

Details in [docs/game-rules.md](docs/game-rules.md) and
[docs/data-model.md](docs/data-model.md).
