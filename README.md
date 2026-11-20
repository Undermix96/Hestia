# Hestia

## Docker

Build locale dell'immagine:

```bash
docker build -t hestia:local .
docker run --rm hestia:local
```

Immagine pubblicata (pubblica, nessun login richiesto):

```bash
docker pull ghcr.io/undermix96/hestia:latest
docker pull ghcr.io/undermix96/hestia:v0.0.1
```

## Versioni

Le versioni seguono il formato `vMAJOR.MINOR.PATCH`, a partire da `v0.0.1`.
Ogni versione corrisponde a un tag git e a un'immagine su `ghcr.io`.

## CI

Il workflow [`Docker Build`](.github/workflows/docker-build.yml) si avvia manualmente
dalla tab **Actions** di GitHub (**Run workflow**), solo dal branch `main`.

Input:

| Input     | Default | Descrizione |
|-----------|---------|-------------|
| `bump`    | `patch` | Parte da incrementare rispetto all'ultimo tag (`patch`, `minor`, `major`). Senza tag precedenti si parte da `v0.0.1`. |
| `version` | vuoto   | Versione esplicita (es. `v0.0.1`); se impostata ignora `bump`. |

Ogni esecuzione:

1. calcola la versione e si ferma se il tag esiste già;
2. esegue build e push dell'immagine su `ghcr.io/undermix96/hestia` con i tag
   `vX.Y.Z`, `X.Y.Z`, `X.Y`, `sha-<commit>` e `latest`;
3. crea e pubblica il tag git `vX.Y.Z`;
4. verifica che l'immagine sia scaricabile senza login, e fallisce se il pacchetto non è pubblico.

> **Prima pubblicazione:** se GHCR crea il pacchetto come privato, l'ultimo step fallisce
> e indica il link. Rendilo pubblico una sola volta da *Packages → hestia → Package settings →
> Change visibility → Public*: le esecuzioni successive mantengono la visibilità.
