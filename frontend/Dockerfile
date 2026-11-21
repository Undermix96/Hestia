# syntax=docker/dockerfile:1
#
# Hestia frontend image. Build context: the repository root.
#   docker build -f frontend/Dockerfile --build-arg VERSION=0.1.0 .

# ---- Build stage -------------------------------------------------------------
# The static output is identical on every architecture, so this stage always
# runs on the build host's native platform (no QEMU emulation for npm/vite).
FROM --platform=$BUILDPLATFORM node:24-alpine AS build

WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy only what the build needs (keeps host node_modules/dist out even
# without a .dockerignore).
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
# The message catalogs live at the repository root; src/i18n imports ../../../locales.
COPY locales /src/locales
RUN npm run build

# ---- Runtime stage -----------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.30-alpine

ARG VERSION=0.0.0-dev

LABEL org.opencontainers.image.title="hestia-frontend" \
      org.opencontainers.image.description="Hestia web dashboard for Home Assistant (static UI + nginx reverse proxy)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/Undermix96/Hestia" \
      org.opencontainers.image.licenses="MIT"

ENV BACKEND_URL=http://backend:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    HESTIA_VERSION=${VERSION}

# Replace the stock site with Hestia's (rendered from the template at start).
USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
    && rm -rf /usr/share/nginx/html/*
USER 101

COPY --chown=101:101 frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /src/frontend/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
