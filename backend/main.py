"""Skyjo Action score sheet -- FastAPI backend.

Owns game state, settings and the Anthropic API key in SQLite, and serves the
vanilla-JS frontend as static files. Run from the repo root with:

    python server.py
    # or: uvicorn backend.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routers import games, players, settings, vision

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Skyjo Action backend started")
    yield


app = FastAPI(title="Skyjo Action", lifespan=lifespan)

app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(players.router, prefix="/api/players", tags=["players"])
app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(vision.router, prefix="/api/vision", tags=["vision"])


# No build step means no versioned asset filenames, so nothing in a JS/CSS
# URL changes on a redeploy -- left to browser heuristics, a stale copy could
# stick around indefinitely. index.html (and build.txt, the version marker
# read at boot) always revalidate, so a reload picks up a new deploy's
# entry point immediately. Static assets (js/css/icons/fonts) get a full day
# of caching instead of "no-cache" on every one of them -- deploys here are
# infrequent, so trading up to a day of possible staleness for skipping the
# round trip on every load is worth it. Staleness resolves itself once the
# cache expires, or immediately via the frontend's force-refresh footer
# button (events.js's forceRefresh(), which cache-busts the URL and bypasses
# this entirely).
ASSET_SUFFIXES = (".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".woff", ".woff2", ".ico")
ASSET_MAX_AGE = 60 * 60 * 24  # 1 day


@app.middleware("http")
async def frontend_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api"):
        return response
    response.headers["Cache-Control"] = f"max-age={ASSET_MAX_AGE}" if path.endswith(ASSET_SUFFIXES) else "no-cache"
    return response


# Registered last: routes above take priority over this catch-all, which
# serves frontend/index.html at "/" and everything under frontend/ as-is.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
