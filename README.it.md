# Hestia

**Italiano** · [English](README.md)

Hestia è una dashboard web per [Home Assistant](https://www.home-assistant.io/)
che gira in Docker sulla tua LAN. Il primo modulo, **Clima**, mostra per ogni
stanza temperatura, impianti di riscaldamento e raffrescamento, programmi e
consumi, con una vista «Stanza» e una «Tutte le stanze». Il menu è modulare, così
si possono aggiungere altre funzioni nel tempo.

Hestia è pensata per adattarsi a configurazioni di Home Assistant molto diverse:
tutto ciò che parla con HA, InfluxDB o i servizi meteo è un **adattatore** con il
proprio schema di configurazione e le proprie capacità dichiarate, e la UI si
adatta a ciò che ogni adattatore supporta. Vedi
[docs/architecture.md](docs/architecture.md) (in inglese).

## Stato

**Pre-alpha — M1 rilasciato come `v0.2.0`** (M0, lo scheletro, è
uscito come `v0.1.0`). Le schermate «Stanza» e «Tutte le stanze» del modulo Clima
sono pronte, ma funzionano su **dati simulati** (orologio fisso e alcune case di
prova, scelte con `?scenario=`): Hestia non legge ancora Home Assistant, quindi non
c'è ancora nulla di utile da installare. I dati reali arrivano con M2. La tabella
di marcia è in [docs/implementation-plan.md](docs/implementation-plan.md) §5.

## Avvio rapido

Requisiti: Docker con il plugin Compose, su `amd64` o `arm64`.

```bash
mkdir hestia && cd hestia
curl -fsSLO https://raw.githubusercontent.com/Undermix96/Hestia/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Undermix96/Hestia/main/.env.example -o .env  # facoltativo
docker compose up -d
```

Poi apri `http://<host>:8080`.

- Il file `.env` è facoltativo; le variabili disponibili sono in
  [`.env.example`](.env.example) (`HESTIA_TAG` per fissare un tag
  dell'immagine, `HESTIA_PORT` per cambiare la porta pubblicata, e le impostazioni
  di Home Assistant e InfluxDB usate dalle milestone successive).
- I dati (configurazione, database, lingue aggiuntive, plugin) stanno nel volume
  `hestia-data`, montato su `/data` nel backend.
- Solo il frontend pubblica una porta; il backend si raggiunge attraverso di esso su `/api/`.
- Hestia non ha login ed è pensata solo per la LAN. Se la esponi, mettila dietro
  un reverse proxy con autenticazione.

Per aggiornare: `docker compose pull && docker compose up -d`.

## Immagini e tag

| Immagine | Contenuto |
|---|---|
| `ghcr.io/undermix96/hestia-backend` | API Python/FastAPI sulla porta 8000 (utente non root) |
| `ghcr.io/undermix96/hestia-frontend` | UI statica servita da nginx non privilegiato sulla porta 8080, che inoltra `/api/` al backend (`BACKEND_URL`, predefinito `http://backend:8000`) |

Entrambe le immagini sono multi-architettura (`linux/amd64`, `linux/arm64`) e
pubbliche: per scaricarle non serve il login. Ogni release pubblica i tag
`vX.Y.Z`, `X.Y.Z`, `X.Y`, `sha-<commit>` e `latest`. Usa sempre lo stesso tag per
le due immagini.

## Versioni e release

Le versioni seguono il formato `vMAJOR.MINOR.PATCH`; ogni versione corrisponde a un
tag git e alle due immagini.

Le release le crea il workflow [`Docker Build`](.github/workflows/docker-build.yml),
che si avvia manualmente dalla tab **Actions** di GitHub (**Run workflow**), solo
dal branch `main`.

| Input | Predefinito | Descrizione |
|---|---|---|
| `bump` | `patch` | Parte da incrementare rispetto all'ultimo tag (`patch`, `minor`, `major`). Senza tag precedenti si parte da `v0.0.1`. |
| `version` | vuoto | Versione esplicita (es. `v0.1.0`); se impostata, `bump` viene ignorato. |

Ogni esecuzione:

1. calcola la versione e si ferma se il tag esiste già;
2. esegue tutti i test (gli stessi della [CI](.github/workflows/ci.yml));
3. costruisce e pubblica le due immagini per `amd64` e `arm64` con i tag
   immutabili (`vX.Y.Z`, `X.Y.Z`, `sha-<commit>`);
4. sposta `X.Y` e `latest` di entrambe le immagini sulla nuova release, solo dopo
   che entrambe le build sono riuscite, così i tag condivisi coincidono sempre;
5. crea e pubblica il tag git `vX.Y.Z`, solo dopo che entrambe le build sono riuscite;
   il tag viene pubblicato con il secret `RELEASE_TOKEN` (vedi sotto);
6. verifica che entrambe le immagini si scarichino senza login per le due architetture.

> **`RELEASE_TOKEN`:** GitHub non permette al `GITHUB_TOKEN` di pubblicare un tag su
> un commit che modifica `.github/workflows/`, quindi il tag viene pubblicato con un
> token fine-grained salvato come secret del repository `RELEASE_TOKEN`, con permessi
> *Contents* e *Workflows* in scrittura sul solo repository. Se il secret manca, il
> workflow si ferma prima di costruire qualsiasi cosa. Il token scade: quando succede,
> rinnovalo e aggiorna il secret.

> **Visibilità:** i pacchetti sono collegati a questo repository pubblico e ne
> ereditano la visibilità, quindi sono pubblici fin dalla prima pubblicazione. Se un
> pacchetto risultasse privato (per esempio in un fork), l'ultimo step fallisce
> indicando il link per cambiarla.

## Sviluppo

Il repository è un monorepo:

| Percorso | Contenuto |
|---|---|
| [`backend/`](backend/README.md) | Python 3.12 + FastAPI, gestito con uv |
| [`frontend/`](frontend/README.md) | React + TypeScript + Vite, gestito con npm |
| [`contract/openapi.json`](contract/openapi.json) | Contratto dell'API generato dal backend |
| [`locales/`](locales/README.md) | Traduzioni |
| [`docs/`](docs/) | Architettura, design e piano di implementazione |

I comandi per installare, avviare, controllare e testare ogni parte sono in
[backend/README.md](backend/README.md) e [frontend/README.md](frontend/README.md);
le linee guida per contribuire sono in [CONTRIBUTING.md](CONTRIBUTING.md). Codice,
commenti e documentazione per contributor sono in inglese.

## Documentazione

- [docs/architecture.md](docs/architecture.md): panoramica dell'architettura (core, ports, adattatori), in inglese.
- [docs/implementation-plan.md](docs/implementation-plan.md): piano di implementazione e milestone.
- [docs/design/](docs/design/README.md): specifica di design della dashboard Clima;
  parti da [HANDOFF.md](docs/design/HANDOFF.md).

## Licenza

[MIT](LICENSE) © 2026 Undermix96
