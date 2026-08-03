# Single-image deploy: FastAPI serves both the API and the static frontend
# (see backend/main.py), so one container is all Coolify needs to run.
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY frontend/ frontend/

# Human-readable build timestamp, served as a static file and shown in the
# frontend footer (see frontend/js/app.js) so a deployed instance can be
# told apart from another at a glance.
RUN date -u "+%d/%m/%Y %H:%M UTC" > frontend/build.txt

# SQLite lives here (backend/db.py). Mount a volume on this path in Coolify
# so games/settings survive redeploys -- otherwise every deploy starts empty.
RUN mkdir -p backend/data

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
