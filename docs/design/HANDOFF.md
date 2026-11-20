# Hestia — Dashboard clima: documento di passaggio all'implementazione

20 novembre 2026

## Scopo e perimetro

Si implementa il design **N · Sintesi** in versione desktop (web app): due schermate, **Stanza** e **Tutte le stanze**. La versione Android è rimandata e va riprogettata: non fa parte di questa fase. Nome del prodotto: **Hestia** (al posto della parola «casa» in alto a sinistra nei mockup; marchio ancora da verificare).

**Riferimenti (in questo pacchetto)**

| Cosa | Dove | Note |
| --- | --- | --- |
| Schermata Stanza | `mockup/N-Stanza.dc.html` | Fonte di verità per markup, stili e logica |
| Schermata Tutte le stanze | `mockup/N-Tutte.dc.html` | Idem |
| Screenshot | `screenshots/` | Stanza 24 ore, 7 giorni, cursore; Tutte 24 ore e 7 giorni |
| Motore dati simulati | `reference-src/Neng.js` | Stanze, programmi, simulazione, colori: riusabile come mock |
| Logica schermate | `reference-src/NS.js`, `reference-src/T.js` | `renderVals()` di Stanza e Tutte, leggibili da soli |

**Come leggere i file `.dc.html`.** Sono componenti del formato Design Canvas di Claude:

- `{{percorso.valore}}` è un segnaposto riempito dall'oggetto restituito da `renderVals()`.
- `<sc-for list=… as=…>` ripete il contenuto per ogni elemento; `<sc-if value=…>` lo mostra solo se vero.
- `onClick="{{handler}}"` collega una funzione restituita da `renderVals()`.
- Lo `<script data-dc-script>` in fondo contiene `class Component extends DCLogic` con `state`, `setState` e `renderVals()`: equivale a un componente React a classe.
- Gli stili sono inline (valori esatti da riprodurre) più un blocco `<helmet><style>` con classi per hover, stati attivi e animazioni.

Per vederli nel browser: dalla cartella `mockup/` lanciare `python3 -m http.server 8000` e aprire `http://localhost:8000/N-Stanza.dc.html` (il file `support.js` è un piccolo runtime di anteprima, non fa parte del prodotto).

Traduzione consigliata: React o Svelte, un componente per blocco (vedi sezioni 5 e 6). Tutti i dati nei mockup sono **simulati**: vanno sostituiti con l'integrazione reale (sezione 8).

## Impianto reale

La casa ha 6 locali, 2 climatizzatori a pompa di calore e caloriferi in 4 zone; si misura solo la corrente presa dalla rete elettrica.

| Locale | Caloriferi | Climatizzatore | Sensore T/UR | Note |
| --- | --- | --- | --- | --- |
| Soggiorno | sì (zona soggiorno) | sì (`s`) | sì | due impianti sulla stessa stanza |
| Corridoio | no | sì (`c`) | sì | solo climatizzatore |
| Camera | sì (zona camera) | no | sì |  |
| Cameretta | sì (zona cameretta) | no | sì |  |
| Bagno | sì (zona bagno + ripostiglio) | no | sì | zona condivisa |
| Ripostiglio | sì (stessa zona del bagno) | no | **no** | temperatura sconosciuta, segue il bagno |

Regole che il software deve rispettare:

- **Caloriferi sempre attivi.** Non si accendono o spengono: cambia solo il target per fascia oraria. Nell'interfaccia non esiste un interruttore on/off dei caloriferi.
- **Ripostiglio senza sensore.** Mostrarlo ovunque come stanza «nessun sensore · segue il bagno», con lo stato dei caloriferi della zona bagno; non è selezionabile come stanza principale.
- **Consumi.** Nessun contatore gas né acqua, nessun fotovoltaico. La corrente misurata è il totale casa dalla rete; la quota climatizzatori si ricava dalla potenza dei due split (misurata o stimata). Il consumo dei caloriferi va dichiarato «non monitorato».
- **Modalità climatizzatori:** Caldo, Freddo, Deumidifica, Spento.

## Schermate e navigazione

Un solo menu in cima: il modulo Clima contiene le due viste, gli altri moduli stanno accanto.

- **Menu principale (header):** logo «Hestia» · gruppo **CLIMA** con due voci, *Stanza* e *Tutte le stanze* (quella attiva ha sfondo chiaro `#EEF2F4` e testo `#0E1215`) · *Energia* · *Luci* · *+ modulo*. A destra: data, ora e condizioni esterne in font monospazio. Niente voce Sicurezza.
- **Rotte suggerite:** `/clima/stanza/:id` e `/clima/tutte`. Da Tutte le stanze, «apri la stanza» porta a `/clima/stanza/:id` con la stanza preselezionata (nel mockup apre sempre il soggiorno per un limite del prototipo).
- **Stato condiviso tra le viste:** intervallo del grafico (24 ore / 7 giorni), modifiche al programma, modalità dei climatizzatori. Conviene tenerlo in uno store globale.
- **Estendibilità:** ogni modulo (Clima, Energia, Luci…) è una sezione del menu con le sue sottoviste; «+ modulo» apre l'elenco dei moduli installabili. Nessuna dipendenza del modulo Clima dagli altri.

**Ordine dei blocchi**

1. Schermata Stanza: header → schede stanza → riassunto a parole → termogramma (con editor fascia) → riga con *Corrente climatizzatori* (1/3) e *Programma della settimana* (2/3).
2. Schermata Tutte le stanze: header → pannello unico con una riga per stanza + riga Esterno, cursore sincronizzato.

## Design system

Tema scuro unico (palette di K · Termogramma); i token qui sotto vanno definiti come variabili CSS.

**Colori**

| Token | Valore | Uso |
| --- | --- | --- |
| `bg` | `#0E1215` | sfondo pagina |
| `panel` | `#151A1E` | pannelli, schede stanza, header group |
| `panel-2` | `#1E252A` | selettori segmentati, chip inattivi |
| `lane` | `#1A2025` | fondo delle barre programma/azione |
| `out-bg` | `#12171A` | fondo pannello esterno |
| `grid` | `#1F262B` | griglie, separatori |
| `border` | `#2A333A` / `#2E383F` | bordi chip e pulsanti |
| `text` | `#EEF2F4` | testo principale, linea temperatura |
| `text-2` | `#C9D1D6` | testo secondario |
| `muted` | `#98A3AB` | etichette, assi |
| `heat` | `#FF8A4C` | scalda, linea «adesso» |
| `target` | `#FFB07A` | linea target tratteggiata |
| `band` | `rgba(255,176,122,.16)` | fascia di comfort |
| `cool` | `#4FB3FF` | raffredda |
| `hum` | `#59D3B4` (area `rgba(89,211,180,.13)`) | umidità stanza; anche deumidifica |
| `out` | `#8EA2FF` | temperatura esterna |
| `out-hum` | `#7FD8C8` tratteggiato | umidità esterna |
| `ac-prog` | `#2E4A66` | fasce programmate del climatizzatore |
| `rad-lo` → `rad-hi` | `#3A5A8C` → `#C2622E` | colore delle fasce caloriferi, interpolato sul target 17–23° |
| `idle` | righe 135° `#46525B` / `#2A333A`, passo 3 px | standby |
| `dot-idle` | `#6A767F` | puntino impianto fermo |

**Tipografia**

- **Albert Sans** (200–800) per tutto il testo; **Martian Mono** (300–500) per orari, assi e numeri tecnici. Cifre con `font-variant-numeric: tabular-nums`.
- Riassunto: 40 px, peso 300, prima frase in grassetto 700, interlinea 1,15, letter-spacing −0,03 em.
- Titoli di pannello 18 px / 700; nomi stanza nelle schede 15 px / 700; stato impianti 11 px / 600; assi 10 px mono.

**Forme e spazi**

- Raggi: pannelli 28 px, schede stanza 16 px, chip e pulsanti 999 px, barre programma 6 px, barre azione 4 px.
- Contenitore massimo 1400 px, padding 22–32 px, distanza tra blocchi 18–20 px; pannelli con padding 22 px.
- Target tattili minimo 44 px (pulsanti ± 44, modalità 40 su desktop).

**Animazioni e micro-interazioni**

- Entrata a cascata dei blocchi: opacità 0→1 e translateY 14→0 px in 0,9 s, ritardi 0,08 s a passo.
- Linea temperatura misurata: rivelata da sinistra con `clip-path: inset(0 100% 0 0) → inset(0)` in 1,2 s. **Non** usare `stroke-dasharray` + `pathLength` con `vector-effect: non-scaling-stroke`: in Chrome la linea resta tronca.
- Linea prevista: dissolvenza dopo 1 s. Barre programma/azione: crescita `scaleX` da sinistra in 1 s.
- Cambi di dati (stanza, intervallo): transizione dei path SVG con `transition: d .6s`.
- Impianto attivo: puntino con anello pulsante (scala 0,6→1,9, opacità 0,9→0, ciclo 1,8 s).
- Linea «adesso» con pallino che pulsa (alone che si espande, 2,4 s).
- Editor della fascia: comparsa con leggero rimbalzo (cubic-bezier .3,1.4,.5,1, 0,45 s); pulsanti ± con scale 0,9 alla pressione.
- Rispettare `prefers-reduced-motion`: disattivare animazioni cicliche e cascate.

## Schermata Stanza

Il centro è il **termogramma**: un solo grafico con stanza, impianti ed esterno sulla stessa linea del tempo.

### Schede stanza

- Una scheda per stanza con sensore, in fila (wrap), alta ≥ 58 px: nome (15/700) + temperatura attuale (15/400, opacità .8) sulla prima riga; sotto, una voce per impianto: puntino + «caloriferi standby», «clima scalda»… (11/600).
- Puntino: quadrato 2 px di raggio per caloriferi, tondo per clima; arancio se scalda, blu se raffredda, `#6A767F` se fermo; anello pulsante solo se attivo.
- Scheda attiva: sfondo `#EEF2F4`, testo `#151A1E`. Cliccando si cambia stanza e si chiude l'editor.
- In coda la scheda tratteggiata «Ripostiglio · nessun sensore · segue il bagno», non cliccabile.

### Riassunto a parole

Una frase generata (sezione 7), es.: **«Soggiorno è a 21,8°.»** I caloriferi sono fermi: la stanza è sopra il target di 21,0°. Il climatizzatore scalda verso 21,5°. Alle 08:45 il climatizzatore si spegne. Sotto, in 15 px: «Umidità 47% · fuori 5,9° e 83%.»

### Termogramma

**Asse del tempo**

| Vista | Passato | Previsione | Passo | Posizione «adesso» | Etichette asse |
| --- | --- | --- | --- | --- | --- |
| 24 ore (default) | 24 h | 2 h | 30 min (52 campioni) | ≈ 93% della larghezza | ogni 4 h + «adesso» |
| 7 giorni | 7 giorni | 12 h | 30 min (360 campioni) | ≈ 93% | nome del giorno a mezzanotte («sab 14») + «adesso» |

Le etichette entro 5% da «adesso» si omettono. Il selettore 24 ore / 7 giorni sta nella barra del titolo del pannello, a destra, accanto al suggerimento «tocca una fascia futura per modificarla».

**Pannelli verticali (dall'alto)**

1. **Stanza, 260 px.** Scala °C 14–25 a sinistra (tacche 16–24 ogni 2°), scala umidità 30–80% a destra (verde). Strati: area + linea umidità → fascia di comfort (target −0,3/+0,2°) → target a gradini tratteggiato → temperatura misurata (linea piena 2,8 px) → temperatura prevista (puntini, dopo «adesso»).
2. **Una corsia per impianto, 50 px**: barra *programma* 24 px + 4 px + barra *azione* 14 px. Etichette a sinistra allineate: nome impianto (12/700) all'altezza del programma, «in azione» (11, muted) all'altezza della barra azione. Mai «programma/azione» su due righe: si legge «programmazione».
   - Programma caloriferi: sempre pieno; ogni fascia ha il colore del suo target (`rad-lo`→`rad-hi`) e il valore scritto se c'è spazio (≥ 6% di larghezza in 24 h, ≥ 2,2% in 7 giorni).
   - Programma clima: fasce `ac-prog` con il set; vuoto quando non programmato.
   - Azione: scalda / raffredda / deumidifica / standby (righe) / spento (vuoto). Dopo «adesso» opacità 0,5 (previsto).
3. **Esterno, 80 px.** Temperatura 0–15° (linea blu-lavanda) + umidità 50–100% (tratteggio + area tenue).

**Sovrapposizioni**

- Zona previsione: da «adesso» al bordo destro, righe diagonali `rgba(255,255,255,.035)`. Linea «adesso» 2 px `heat` che parte dal bordo superiore dell'area grafico (non sopra), pallino 10 px a −5 px.
- Cursore al passaggio del mouse: linea verticale + punto sulla temperatura + riquadro con ora («ore 00:30», «adesso · 08:30», «previsione · 10:00»; in 7 giorni anche il giorno), stanza T·UR, per ogni impianto target/set e azione colorata, esterno T·UR. Il riquadro passa a sinistra del cursore oltre il 60% della larghezza.

**Legenda:** sopra (misurata, prevista, target, range, umidità, esterno) e sotto (scalda, raffredda, standby, spento + «barra alta: programma e target · barra bassa: cosa fa l'impianto · dopo «adesso»: previsione»).

### Editor della fascia

- Cliccando una fascia del programma che **finisce dopo adesso** si apre, sotto il grafico, un pannello chiaro (`#EEF2F4`, testo scuro): «Caloriferi · fascia 06:00–23:00», nota, ± 0,5° attorno al valore, «Ripristina», «Fatto».
- La fascia selezionata ha un doppio anello; una fascia modificata ha un bordo interno.
- La modifica vale **da adesso in poi** (offset sulla voce del programma, limiti ±4°): il passato non cambia, la previsione si ricalcola subito. Fasce già concluse non sono cliccabili.

### Corrente climatizzatori (1/3 della riga)

- kW adesso (40 px), kWh e € delle ultime 24 ore, totale del mese, nota «i caloriferi non sono misurati».
- Se la stanza ha un climatizzatore: chip modalità Caldo / Freddo / Deumidifica / Spento (attiva chiara).

### Programma della settimana (2/3 della riga)

- 7 righe Lun–Dom (oggi in grassetto). Per stanza con caloriferi: barra 0–24 h con le fasce colorate per target e il valore se la fascia dura ≥ 3 h. Per stanza con clima: barra sottile 8 px con le fasce attive.
- Asse 00 · 06 · 12 · 18 · 24. Nel mockup il weekend è ipotizzato con partenza alle 7:30 invece delle 6:00: va letto dal programma reale.

## Schermata Tutte le stanze

Un solo pannello con una riga per stanza, tutte sulla stessa linea del tempo del termogramma (stesse viste 24 ore / 7 giorni, «adesso» al 93%). Niente riassunto in alto.

- **Barra del pannello:** legenda compatta (misurata, prevista, target, range, scalda, standby) a sinistra; a destra l'ora letta dal cursore e il selettore 24 ore / 7 giorni.
- **Tre colonne allineate per riga (112 px):**
  - sinistra 230 px: nome (16/700), temperatura attuale (26/300), una voce per impianto con puntino, link «apri la stanza →»;
  - centro: mini-termogramma 80 px (scala comune 15–24°) con fascia, target tratteggiato, misurata piena, prevista a puntini; sotto, una striscia azione 7 px per ogni impianto (opacità 0,5 dopo «adesso»);
  - destra 170 px: valori al cursore (temperatura 22/300, «target X°», azione di ogni impianto nel suo colore).
- **Ripostiglio:** riga con area a righe «Nessun sensore di temperatura · i caloriferi si accendono con quelli del bagno» + striscia azione della zona bagno; a destra «nessun sensore».
- **Esterno:** ultima riga 72 px con temperatura e umidità esterne; valore al cursore a destra.
- **Cursore unico** su tutte le righe, linea «adesso» e zona previsione come nella schermata Stanza; le etichette orarie sotto, posizionate in assoluto.

## Logica

Nel prodotto reale stato e azione degli impianti si **leggono** dai dispositivi; le regole qui sotto servono a etichettare, a riempire i buchi e a calcolare la previsione.

**Range e stati**

- Range di comfort = target −0,3° / +0,2° (isteresi del mockup, da allineare a quella reale dei termostati: decisione aperta).
- Caloriferi: *scalda* quando la valvola di zona è aperta (o T < target − 0,3 e finché T ≤ target + 0,2); altrimenti *standby*. Mai *spento*.
- Climatizzatore: *spento* se modalità Spento o fuori dalle fasce programmate; dentro una fascia, in Caldo *scalda* / *standby* con la stessa isteresi sul set, in Freddo *raffredda* se T > set + 0,3 altrimenti *standby*, in Deumidifica *deumidifica*.
- Stato di stanza (schede e righe): «caloriferi scaldano», «clima scalda», «clima raffredda» oppure «nel range».

**Riassunto a parole** (frasi nell'ordine, valori a una cifra decimale con virgola):

1. «<Stanza> è a <T>°.» (in grassetto)
2. Caloriferi: «stanno scaldando verso <target>°» (+ «, tra poco vanno in standby» se T è già sopra il range) · «sono fermi: la stanza è sopra il target di <target>°» · «sono in standby: <T>° è dentro il range <min>–<max>°».
3. Climatizzatore: «non è programmato adesso» · «scalda verso <set>°» · «raffredda verso <set>°» · «è acceso ma in standby, set <set>°».
4. Prossimo cambio di programma: «Alle hh:mm il target dei caloriferi passa a <x>°» / «il climatizzatore si accende a <x>°» / «il climatizzatore si spegne» (il più vicino tra caloriferi e clima, modifiche incluse).

**Previsione (dopo «adesso»)**

- Mockup: modello termico a un nodo, passo 30 min. Per ogni passo:

```
T[k+1] = T[k] + 0,42·r[k] + 0,38·a_caldo[k] − 0,35·a_freddo[k] − λ·(T[k] − (0,35·T_est + 12))
```

  con r, a = 1 se l'impianto è in azione, λ = 0,028–0,036 per stanza. Coefficienti inventati: in produzione vanno stimati dai dati storici di ogni stanza (oppure si usa la previsione del sistema domotico, se disponibile).
- Esterno previsto: dalle previsioni meteo (servizio da scegliere).
- La previsione usa il programma corrente più le modifiche fatte dall'editor; si ricalcola a ogni modifica e a ogni nuovo dato.

**Consumi climatizzatori**

- kW adesso = somma della potenza dei due split (misurata se c'è una presa/contatore dedicato, altrimenti stimata: nel mockup 0,8 kW soggiorno, 0,5 kW corridoio in azione, 0,02–0,04 kW in standby).
- kWh 24 h = integrale della potenza; € = kWh × tariffa (mockup 0,28 €/kWh, da rendere configurabile o leggere dal fornitore).

## Modello dati e integrazione

La fonte dei dati (Home Assistant, Tado, Netatmo, altro) non è ancora decisa: il frontend deve dipendere solo da questo contratto, con un adattatore per sorgente.

```typescript
type Mode = 'heat' | 'cool' | 'dry' | 'off';            // Caldo, Freddo, Deumidifica, Spento
type Action = 'heat' | 'cool' | 'dry' | 'idle' | 'off';  // cosa fa davvero l'impianto

interface Room {
  id: string;                 // 'soggiorno', 'corridoio', 'camera', 'cameretta', 'bagno', 'ripostiglio'
  name: string;
  hasSensor: boolean;         // false per il ripostiglio
  radiatorZoneId?: string;    // 'z-soggiorno' | 'z-camera' | 'z-cameretta' | 'z-bagno' (bagno + ripostiglio)
  acUnitId?: string;          // 'ac-soggiorno' | 'ac-corridoio'
}

interface Sample {            // serie a passo 30 min (o più fine, poi ricampionata)
  t: string;                  // ISO 8601
  tempC?: number;
  humidity?: number;          // %
}

interface RadiatorZone {
  id: string;
  roomIds: string[];          // la zona bagno contiene ['bagno', 'ripostiglio']
  schedule: WeeklySchedule;   // target per fascia, sempre attiva
  actions: { t: string; action: 'heat' | 'idle' }[];
  valvePct?: number;          // se disponibile
}

interface AcUnit {
  id: string;
  roomId: string;
  mode: Mode;
  schedule: AcSchedule;       // fasce on con set point; fuori fascia = spento
  actions: { t: string; action: Action }[];
  powerW?: number;            // potenza istantanea, se misurata
}

type WeeklySchedule = Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', { from: string; targetC: number }[]>; // from 'HH:MM'
type AcSchedule = Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', { from: string; to: string; setC: number }[]>;

interface Override {          // modifiche dall'editor: valgono da adesso in poi
  target: { kind: 'radiator'; zoneId: string; entryIndex: number } | { kind: 'ac'; unitId: string; entryIndex: number };
  deltaC: number;             // multipli di 0,5, limiti ±4
  validFrom: string;          // adesso
  validUntil?: string;        // fine della fascia o «sempre»: decisione aperta
}

interface Grid { powerW: number; samples: { t: string; houseW: number; acW?: number }[]; tariffEurKwh: number; }
interface Outdoor { now: Sample; history: Sample[]; forecast: Sample[]; }
```

**Endpoint minimi** (REST o equivalente):

| Metodo | Percorso | Restituisce / fa |
| --- | --- | --- |
| GET | `/rooms` | elenco stanze con impianti |
| GET | `/rooms/:id/series?from&to` | campioni T/UR della stanza |
| GET | `/zones`, `/ac-units` | stato, programma, storico azioni |
| GET | `/outdoor?from&to` | storico + previsione esterna |
| GET | `/grid?from&to` | potenza casa e quota clima |
| GET | `/forecast/rooms/:id?hours=2\|12` | previsione T e azioni (se calcolata lato server) |
| PATCH | `/ac-units/:id` | `{ mode }` |
| POST | `/overrides` | crea/aggiorna un `Override` |
| DELETE | `/overrides/:id` | ripristina la fascia |

- **Aggiornamento dal vivo:** WebSocket o SSE per stato impianti e potenza (aggiornamento ogni 10–30 s); le serie storiche si possono interrogare a intervalli.
- **Ora e fuso:** Europe/Rome; fasce orarie in ora locale, gestire il cambio ora legale.

## Accessibilità, formati, estendibilità e checklist

### Accessibilità

- Contrasto: testo principale e secondario su `bg`/`panel` ≥ 4,5:1; `muted` solo per etichette ≥ 10 px, verificarlo.
- Lo stato non è mai solo colore: ogni azione ha anche il testo («scalda», «standby») e lo standby ha la trama a righe.
- Grafici: `role="img"` + `aria-label` con il riassunto; tabella nascosta equivalente (ora, T, UR, target, azione) per lettori di schermo.
- Tastiera: schede stanza, selettore intervallo, fasce modificabili ed editor raggiungibili con Tab; frecce ←/→ per spostare il cursore sul grafico; Esc chiude l'editor.
- `prefers-reduced-motion` rispettato (sezione 4).

### Formati

- **Desktop** (≥ 1280 px): layout dei mockup, contenitore max 1400 px.
- **Tablet / finestre strette** (768–1279): schede stanza su più righe, energia e programma uno sotto l'altro, colonna etichette del grafico 96 px.
- **Android**: rinviato; il design mobile va rifatto. Il codice condiviso (contratto dati, logica, token) va tenuto separato dalla UI per riusarlo.
- **Display a parete** (futuro): direzione E · Vetro conservata a parte; stessi dati, modalità kiosk, target touch ≥ 56 px, attenuazione notturna.

### Estendibilità

- Il menu è modulare (Clima · Energia · Luci · + modulo): ogni modulo registra voce di menu, rotte e widget.
- Stanze e impianti vengono dalla configurazione, non dal codice: aggiungere una stanza o un nuovo split non richiede modifiche alla UI.
- Nuovi tipi di impianto (es. deumidificatore, VMC) = nuova corsia nel termogramma con le stesse regole programma/azione.

### Decisioni aperte

1. Nome: proposto **Hestia** (alternative Kelvin, Isotherm, Calor); da confermare e verificare il marchio.
2. Sorgente dati e integrazione con il sistema domotico.
3. Misura dei consumi dei climatizzatori: misurata (contatore dedicato) o stimata.
4. Durata delle modifiche dall'editor: solo la fascia corrente o permanente nel programma.
5. Isteresi reale dei termostati e modello di previsione.
6. Servizio meteo per la previsione esterna.
7. Programma reale del weekend.
8. Riprogettazione Android.

### Checklist di implementazione

- [ ] Token CSS e font (Albert Sans, Martian Mono) in self-host
- [ ] Header con menu modulare e gruppo Clima (Stanza / Tutte le stanze)
- [ ] Contratto dati + adattatore mock (riusare `reference-src/Neng.js` come generatore di dati finti)
- [ ] Schede stanza con stato impianti
- [ ] Riassunto a parole
- [ ] Termogramma: pannello stanza, corsie impianti, pannello esterno, previsione, linea «adesso»
- [ ] Selettore 24 ore / 7 giorni
- [ ] Cursore e riquadro valori
- [ ] Editor fasce future + chiamate `/overrides`
- [ ] Scheda corrente climatizzatori + modalità
- [ ] Programma della settimana
- [ ] Schermata Tutte le stanze con cursore condiviso
- [ ] Animazioni + `prefers-reduced-motion`
- [ ] Accessibilità (tastiera, aria, contrasto)
- [ ] Aggiornamento dal vivo (WebSocket/SSE)
- [ ] Adattatore reale per la sorgente scelta
- [ ] Verifica visiva contro gli screenshot e i mockup N-Stanza e N-Tutte
