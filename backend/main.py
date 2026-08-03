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

# Registered last: routes above take priority over this catch-all, which
# serves frontend/index.html at "/" and everything under frontend/ as-is.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
