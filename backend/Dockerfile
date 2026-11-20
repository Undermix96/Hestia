# syntax=docker/dockerfile:1
# Hestia backend image. Build context is the repository root:
#   docker build -f backend/Dockerfile --build-arg VERSION=0.1.0 .

ARG PYTHON_IMAGE=python:3.12-slim

# --- Build stage: resolve the locked dependencies into a self-contained venv ---------------
FROM ${PYTHON_IMAGE} AS builder

COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=/usr/local/bin/python3.12 \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /src

# Dependencies first, so source changes do not invalidate this layer.
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY backend/hestia ./hestia
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

# --- Runtime stage -----------------------------------------------------------------------
FROM ${PYTHON_IMAGE}

ARG VERSION=0.0.0-dev

LABEL org.opencontainers.image.title="hestia-backend" \
      org.opencontainers.image.description="Hestia backend: web dashboard API for Home Assistant" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/Undermix96/Hestia" \
      org.opencontainers.image.licenses="MIT"

RUN groupadd --system --gid 10001 hestia \
    && useradd --system --uid 10001 --gid hestia --no-create-home --home-dir /nonexistent \
       --shell /usr/sbin/nologin hestia \
    && mkdir -p /data \
    && chown hestia:hestia /data

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HESTIA_VERSION=${VERSION}

WORKDIR /data
USER hestia:hestia
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "hestia.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
