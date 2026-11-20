# Immagine di base per Hestia — da sostituire con il contenuto reale del progetto
FROM alpine:3.20

LABEL org.opencontainers.image.title="Hestia" \
      org.opencontainers.image.source="https://github.com/Undermix96/Hestia"

WORKDIR /app
COPY . .

CMD ["sh", "-c", "echo 'Hestia container is running'"]
