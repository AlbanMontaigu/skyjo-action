#!/usr/bin/env python3
"""Convenience entry point: `python server.py` starts the whole app (API +
static frontend, see backend/main.py) without having to remember uvicorn's
CLI. Same app the Dockerfile runs in production.

No auto-reload: restart the process yourself after a change (Ctrl+C, rerun)
instead of paying for a file watcher running all the time."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)
