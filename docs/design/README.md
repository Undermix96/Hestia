# Hestia · pacchetto di passaggio a Claude Code

Dashboard clima di casa, design **N · Sintesi**, versione desktop. Android è escluso da questa fase.

## Da dove partire

1. Leggi `HANDOFF.md`: è la specifica completa (impianto, schermate, design system, logica, modello dati, checklist).
2. Guarda `screenshots/` per il risultato atteso.
3. Usa `mockup/*.dc.html` come fonte di verità per misure, colori e struttura.

## Contenuto

```
HANDOFF.md                  specifica di implementazione
mockup/
  N-Stanza.dc.html          schermata Stanza (markup + stili + logica)
  N-Tutte.dc.html           schermata Tutte le stanze
  support.js                runtime minimo per vedere i mockup nel browser (non fa parte del prodotto)
screenshots/
  stanza-24h.png            vista predefinita
  stanza-7giorni.png        selettore su 7 giorni
  stanza-cursore.png        riquadro valori al passaggio del mouse (zona previsione)
  tutte-24h.png
  tutte-7giorni.png
reference-src/
  Neng.js                   motore condiviso: stanze, programmi, simulazione termica, colori
  NS.js                     renderVals() della schermata Stanza
  T.js                      renderVals() della schermata Tutte le stanze
```

## Vedere i mockup nel browser

```bash
cd mockup
python3 -m http.server 8000
# apri http://localhost:8000/N-Stanza.dc.html e http://localhost:8000/N-Tutte.dc.html
```

I font arrivano da Google Fonts, serve la rete. In console compaiono errori «Expected moveto path command» al primo caricamento: sono i segnaposto `{{…}}` letti prima del rendering, innocui.

## Note

- Tutti i dati sono **simulati** (generati da `Neng.js`). Coefficienti termici, consumi e tariffa sono valori di esempio.
- La prima decisione da prendere è la sorgente dati (Home Assistant o altro): vedi «Decisioni aperte» in `HANDOFF.md`.
- Nei mockup in alto a sinistra c'è «casa»: nel prodotto va «Hestia».
