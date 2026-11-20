# Hestia

## Docker

Build locale dell'immagine:

```bash
docker build -t hestia:local .
docker run --rm hestia:local
```

## CI

Il workflow [`Docker Build`](.github/workflows/docker-build.yml) si avvia manualmente
dalla tab **Actions** di GitHub (`workflow_dispatch`). Esegue il build dell'immagine e,
se l'input `push` è attivo, la pubblica su GitHub Container Registry (`ghcr.io`).
