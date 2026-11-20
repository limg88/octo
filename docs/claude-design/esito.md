# Esito della revisione con Claude Design

Elenco di consegna per lo sviluppo, del 20/11/2026. Le tavole (prima e dopo, nei due temi) sono qui: <https://claude.ai/artifact/Sqai5SiWggncvg2njtpsLF>.

Da applicare a `apps/desktop/src/renderer/styles.css` e ai componenti React, una sezione per incremento.

## Dopo l'applicazione

Che cosa è cambiato rispetto a questo elenco quando Claude Code lo ha applicato, e che cosa resta da fare.

### Da correggere

Nulla.

### Da verificare

- **«Ordinato» con NetSuite letto.** La cifra è sempre quella tenuta con il previsionale (scritta a mano o presa da «Leggi ordinato da NetSuite»); con NetSuite letto la colonna «Fonte» dice «NetSuite» anche per lei. Fatturato e ricavi riconosciuti vengono davvero dalla lettura.
- **Nota del previsionale in altezza.** Il campo cresce con `field-sizing: content`: provato nei test solo che è un campo a più righe, la crescita va guardata nell'app.

### Confermato

- «Credenziale»: «di chi condivide la cartella» solo se la vista della fonte porta una lettura di un altro computer (`readBy`); collegata ma letta da nessuno, «nessuna». Chiuso il 20/11/2026 in `SourceHeader.tsx`.
- «Richiamo scelto: [1] della risposta 2 di 3» al posto di «Richiamo in vista»; il comportamento non cambia.
- «Fonte» senza NetSuite letto: «Previsionale» (neutra) per ordinato, fatturato e ricavi riconosciuti; «non nota» dove la cifra manca. Nessuna cella vuota.
- Nota del previsionale: campo a più righe che cresce con il testo, senza finestra.
- Sotto «Ordinato»: «ordine SO-17» con un ordine, «N ordini di vendita» con più d'uno.
- Scostamento a zero: etichetta verde «Nessuno».
- Numeri al posto degli ordinali nel richiamo («risposta 2 di 3»).
- La scheda di una riunione parte chiusa.
- «Compila il modello Excel» resta accanto a «Salva i dati del mese», come pulsante normale.

### Decisioni del 20/11, dopo l'audit

- **Barra laterale su citazione e giudizio: tolta.** Una frase citata sta in un riquadro con bordo intero `--source-edge`; il giudizio di Claude in un riquadro con bordo `--accent-edge` su fondo `--accent-soft`; la scheda della riunione ha un bordo intero `--line`. La frase evidenziata dentro una fonte aperta tiene solo il fondo `--accent-soft`. Resta una barra solo sulla voce e sulla riga scelte.
- **Colonna «Credenziale» in «Collegamenti»: tolta.** Lo stato della lettura dice già chi ha letto e quando; la nota sotto l'elenco resta. Tolti anche `credentialPlace` e i suoi quattro testi.
- **Tablet e telefono: non deciso.** Resta un obiettivo in `PRODUCT.md`; nessun codice per larghezze sotto i 900 px finché non è deciso come arrivano i dati.

- **Misure per il dito: verificate con il tocco emulato.** Con `pointer: coarse` pulsanti, schede, voci, selettore del periodo e campi sono alti 44 px. Il testo dei campi resta a 14 px: a 16 px le date uscivano dalla colonna, e l'ingrandimento automatico riguarda solo i telefoni, che oggi non sono raggiungibili.
- **Freccia dei menu:** disegnata nel grigio del testo secondario di ciascun tema, non più un grigio unico.
- **Maniglia delle colonne:** larga 12 px (era 7), dentro la propria intestazione.

### Nomi veri nel codice

| In questo elenco | Nel codice |
|---|---|
| `.today-aside` (dettaglio di «Da fare oggi», 440 px) | `.split-detail` |
| `.known-list` (catalogo dei deliverable) | il catalogo è in `DeliverablesView.tsx`; `.known-list` è altro |
| `.chip` (categorie di «Oggi») | `pill pill-source` |

Le tabelle qui sotto sono aggiornate con questi nomi.

## Avvertenze

- I nomi delle classi vengono dall'elenco dei selettori di `styles.css`, i nomi dei file dall'elenco dei componenti: le regole e il codice non sono stati letti. **L'abbinamento fra nome e schermata va verificato prima di cambiare.**
- Le tavole non sono state riaperte dopo la pubblicazione: la resa va guardata sulla tela.
- Non disegnati: stati vuoti e d'errore, dialoghi dei progetti, ingresso, finestra 900×600 (per questa valgono le regole in fondo).
- Dati supposti nelle tavole, da confermare:
  - Commessa · Sintesi: fonte «NetSuite» e nota «ordine SO-17» per «Ordinato»; fonte «Octo» per «Margine a finire».
  - Commessa · Fatturazione: fonte «NetSuite» per le due tabelle.
  - Commessa · Previsionale: i campi «Ricavi corretti», «Da fatturare», «Tua nota» (i nomi vengono dal testo d'aiuto).
  - Commessa · Ore: lo stato prima delle letture; il risultato dopo le letture non è disegnato.
  - Collegamenti: i valori «su questo computer» (Posta) e «non serve» (Documenti) della colonna «Credenziale».
  - Persone: i campi «Come scrivergli» e «Tu / lei» con le opzioni «come nelle mail», «tu», «lei».

## Token

| Token | Oggi | Proposto | Motivo |
|---|---|---|---|
| `--danger` (scuro) | `#d14343` | `#f47067` | testo a 4,33:1 su `--bg` e 4,13:1 su `--surface`, sotto 4,5; con il nuovo valore 6,94:1 e 6,61:1 |
| `--ok-edge` (nuovo) | — | `light-dark(#9fcfb5, #2f6b4c)` | bordo dell'etichetta verde, come ambra e blu |

Gli altri token restano. Minimi misurati, chiaro / scuro: `--muted` 5,44 / 6,68 (su `--accent-soft`); `--accent` 6,36 / 7,74; `--source` su `--source-bg` 6,54 / 9,56; `--warning` su `--warning-bg` 6,32 / 10,61; `--ok` su `--ok-bg` 5,72 / 8,23; `--on-accent` su `--accent` 7,31 / 8,80; `--input-line` 3,34 / 3,62. `--field-line` (1,67 / 1,69) solo su pulsanti e riquadri, mai su un campo in cui si scrive.

## Regole comuni

| Nome di oggi | Che cosa cambia |
|---|---|
| `.status`, `.status-ok`, `.status-warning`, `.status-neutral` | forma unica dello stato: `height: 20px; padding: 0 6px; border-radius: 4px; border: 1px solid; font-size: 12px; font-weight: 500`. `.status-ok`: `border-color: var(--ok-edge)`. `.status-neutral`: `background: var(--hover); border-color: var(--field-line); color: var(--text)`. Nessuno stato dentro un riquadro con l'aspetto di un pulsante |
| `pill pill-source` (etichette di categoria) | colori di `.status-neutral`; i colori `--source*` solo quando l'etichetta nomina una fonte |
| Intestazione di sezione (`.today-title` e simili) | `font: 600 15px Inter; letter-spacing: -0.012em; text-transform: none`. Il maiuscoletto IBM Plex Mono 11 px resta ai sottogruppi |
| Riga di elenco | `display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 5px 12px; border-top: 1px solid var(--line)`; titolo 600 e nota `--muted` 13 px con `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| Riga scelta | `background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent)` |
| Fascia di cifre | un riquadro con `display: grid; grid-template-columns: repeat(N, minmax(0, 1fr))`, un bordo esterno, divisori `border-left: 1px solid var(--line)`; cella `padding: 12px 14px`; cifra `font: 600 22px Inter` |
| Pulsante pieno | uno per contesto; gli altri normali o quieti |

## Oggi (01)

| Nome di oggi | Che cosa cambia |
|---|---|
| `TodayView.tsx` | ordine: avviso, `TodayPoints`, «Adesso», «Da fare oggi», `TodayWeek`, «Da tenere d'occhio», valutazione. Una criticità con lo stesso testo dell'avviso in cima non entra in `TodayWeek` |
| `TodayAgenda.tsx`, `.today-meetings` | non è più una sezione: ogni riunione di oggi è una riga di `.today-now`, per ora. `TodayPrep.tsx` si apre sotto la riga da «N cose da portare» e cita una mail una volta sola |
| `TodayPoints.tsx`, `.today-point-form` | senza open point: una riga con lo stato, «Aggiungi», «Chiudi la giornata». Il modulo compare dopo «Aggiungi». «Riduci» solo con almeno un open point |
| `.today-now`, `.week-entry`, `.today-watch`, `.today-item` | riga unica. In `.week-entry`: data 84 px, categoria 150 px, azione 150 px a destra |
| `.split-detail` | `width: 440px`. Le ore in `DataTable` (Persona, Timesheet, Tracker; misure a destra). «Apri «…»» pieno, «Fatto» normale, «Rimanda», «Segna come open point», «Non mi interessa» quiete su una riga |
| `.today-evaluation` | due righe: titolo con «Aggiorna la valutazione» e «Valuta di nuovo tutte»; dettagli con «Impostazioni di «Oggi»» a destra |

## Deliverable (08, 09, 10, 11)

| Nome di oggi | Che cosa cambia |
|---|---|
| `DeliverablesView.tsx`, `.deliverable-list` | `width: 248px`. Una riga per documento: titolo con ellissi e `.status-warning` «Da rivedere» o `.status-ok` «Approvato». «Nuovo deliverable» pieno solo nel catalogo |
| `.deliverable-body` | sotto il titolo: «tipo · destinatario · N giri · modello». Via tempi di scrittura, revisione e ultimo giro. «Per il cliente» testo `--muted`, non `.pill-warning` |
| `.review-panel`, `.review-head`, `.missing` | larghezza 336 px. Due blocchi: «Calcolato da Octo» (citazioni, mancanti e l'elenco `.missing`, tolto dal fondo del testo) e «Valutato da Claude» (verdetto, «Tutti i rilievi rivisti» come testo, `.review-fold`, campo, «Chiedi modifica», «Approva»). Approvato: niente campo né pulsanti |
| Catalogo: `DeliverablesView.tsx`, `ScriptedDeliverables.tsx` | elenco: nome 250 px in 600, descrizione con ellissi. Gruppi «Per il cliente» e «Interno»: `min-height: 28px; background: var(--panel)`. Azioni del tipo «Tuo» e «Aggiungi al progetto» a destra nella riga. «Crea un tipo tuo» nella riga del titolo |
| Registro (`DataTable.tsx`) | colonne Data, Tipo, Oggetto (600, una riga, `min-width: 200px`), Stato (`.status`), tre misure a destra. Totali in una riga di tabella in 600: «Approvati: 2» su quattro colonne, poi le somme |

## Chiedi (06, 07)

| Nome di oggi | Che cosa cambia |
|---|---|
| `AskView.tsx` | «Nuova chat» senza la classe del pulsante pieno. Invio: `width: 30px; height: 30px; border-radius: 15px; background: var(--accent); color: var(--on-accent)`. Domande pronte come pulsanti normali |
| `AnswerView.tsx`, `CitationPanel.tsx` | un solo `CitationPanel` per chat: `width: 320px; position: sticky; top: 20px`, sul richiamo scelto, o sul primo dell'ultima risposta. «Fonti · N», l'elenco e «Prepara un deliverable da questa risposta» in una riga `display: flex; gap: 8px`. Risposte separate da `border-bottom: 1px solid var(--line)` |
| `.marker`, `.marker-warning` | richiamo scelto: `box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` |

## Cruscotto (12, 13)

| Nome di oggi | Che cosa cambia |
|---|---|
| `DashboardView.tsx`, `.chips`, `.chip-selected` | ordine: schede, poi una riga con periodo, spazio, `.status-ok` della lettura, «Leggi da Azure DevOps», «Impostazioni del cruscotto» quieto. Periodo come gruppo unito: `border: 1px solid var(--field-line); border-radius: 6px`, voci alte 28 px; scelta in `--accent-soft` e `--accent` |
| `DashboardParts.tsx`, `.metrics`, `.metric`, `.metric-value`, `.metric-selected` | fascia di cifre a 5. Ordine nella cella: etichetta, cifra, nota. `.metric-value` in Inter, non monospazio. `.metric-selected`: `background: var(--accent-soft); box-shadow: inset 0 -2px 0 var(--accent)` |
| `DashboardBugs.tsx` | riga unica: id in monospazio 12 px, titolo, persona, `.status-neutral`, tempo o «tempo non noto». Ricerca e ordinamento sulla riga di «Da sollecitare». Dettaglio 440 px; pulsanti con `white-space: nowrap` |
| `TrendChart.tsx` | Entrati `fill: var(--muted)`. Usciti `fill: var(--surface); stroke: var(--input-line)`. Aperti a fine periodo `stroke: var(--text); stroke-width: 2`. Assi `--field-line`, griglia `--line`, testi `--muted` 12 px |
| `DashboardTrend.tsx` | fascia a tre cifre. Senza dato: «nessun dato» in `--muted` 15 px. «Commenta il periodo» nella riga del titolo |

## Commessa (02, 03, 04, 05)

| Nome di oggi | Che cosa cambia |
|---|---|
| `ProjectSheetView.tsx`, `.sheet-header`, `HoursView.tsx`, `ForecastView.tsx` | il titolo resta «Commessa» in tutte le schede. L'avviso «Documento interno» resta com'è, sempre subito sotto le schede, «Ore» compresa |
| `ProjectSheetSummary.tsx`, `.figures-four`, `.figure` | fascia a 5: Ordinato, Fatturato (NetSuite), Costi a oggi, Margine a oggi, Scostamento da NetSuite con `.status-warning` «Da verificare» se diverso da zero, `.status-ok` altrimenti. Le altre cifre in una tabella «Ordine, ricavi e da regolare» (Voce, Valore, Fonte) |
| `ProjectSheetSummary.tsx`, tabelle | colonna «Fonte» con `.status`: fonte letta in `--source*`, «Octo» neutro, «senza timesheet, dichiarate» `.status-warning`. Due colonne da 1.120 px in su. «Copia i dati per un report» nella riga del titolo |
| `.box-warning` (avviso sugli esterni) | sotto la fascia; pulsante normale a destra «Apri «Previsionale»» |
| `ProjectSheetBilling.tsx` | via `.figures-four` in «Dai fornitori». Tabella con colonna «Da fatturare», riga «Totale», colonna «Fonte» di 140 px |
| `HoursView.tsx` | due righe: nome 210 px, `.status-neutral` con lo stato della lettura, nota, `InfoTip` con il paragrafo di oggi, pulsante. Pieno solo sulla prima lettura mancante. Segnaposto: `border: 1px dashed var(--field-line); padding: 28px 16px` |
| `ForecastView.tsx`, `ForecastMonth.tsx` | riga comandi: `MonthField`, spazio, «Impostazioni del previsionale» quieto, «Salva i dati del mese» pieno. Tabella con le sole otto colonne calcolate. Dettaglio sotto la riga scelta: tre campi (160 px, 160 px, `1fr`), i primi due a destra. Cella vuota: `.status-warning` «manca» |
| `MonthField.tsx` | etichetta «Mese» in linea a sinistra; campo di 150 px |

## Impostazioni (14, 15, 16, 17, 18)

| Nome di oggi | Che cosa cambia |
|---|---|
| `SetupGuide.tsx` | niente riquadro: titolo 17/600, una riga `--muted`, «Leggi tutte le fonti» pieno a destra |
| `SourcesView.tsx`, `SourceHeader.tsx`, `FeedSection.tsx`, `MeetingsSection.tsx`, `DocumentsSection.tsx` | un riquadro con sette righe: Fonte 150 px, Stato `1fr`, Credenziale 200 px, azioni 180 px a destra. «Collega» senza la classe del pulsante pieno. Nota sulla credenziale e nota di «Documenti» una volta sotto l'elenco, `max-width: 760px` |
| `TeamSection.tsx`, `RowsField.tsx` | elenco di sola lettura (Nome, Ruolo, Parte, Allocazione %, Dal, Al) e dettaglio di 400 px con i nove campi su due colonne, `gap: 12px`. Celle vuote con testo: «dall'inizio», «c'è ancora», «non indicata». «Salva persone e calendario» nella riga del titolo, con lo stato accanto |
| `TeamSection.tsx`, disposizione (corretto il 20/11 dopo il controllo a vista) | due colonne con `display: flex; gap: 16px; align-items: flex-start`. A sinistra (`flex: 1; min-width: 0`, in colonna con `gap: 16px`): l'elenco delle persone e, sotto, «Calendario: periodi e sprint». A destra il dettaglio di 400 px. Così il calendario resta nel primo schermo e sotto l'elenco non resta un vuoto. Nel calendario le colonne «Dal» e «Al» sono di 130 px |
| Dettaglio della persona, intestazione | il comando che toglie la persona è il pulsante quieto «Togli», non «×» (accanto al nome sembrava «chiudi»). `aria-label="Togli <nome>"` |
| `GlossarySection.tsx` | con zero righe è chiuso: una riga con titolo, «0 righe», «Chiedi a Claude le coppie» |
| `TodaySettings.tsx` | tre righe, `max-width: 880px; padding: 12px; gap: 16px`: colonna sinistra di 320 px con titolo 600 e nota, comando a destra |
| Scheda «Carta intestata» (`ModelFile.tsx`) | due righe: nome 220 px, `.status-neutral` o `.status-ok`, azione a destra. Spiegazioni sotto |
| `ModelsSection.tsx` | tre righe: etichetta 600 a sinistra, menu di 320 px a destra. «Salva i modelli» nella riga del titolo, con lo stato accanto |

## Etichette nuove, tolte o cambiate

Da riportare in `docs/glossario.md` se accettate.

- **Tolte:** «Riunioni di oggi» come sezione; «Riduci» quando «Il punto» è vuoto.
- **Nuove:** «Valutato da Claude»; «Octo» nella colonna «Fonte»; colonne «Timesheet» e «Tracker»; «Ordine, ricavi e da regolare»; azione «Apri «Previsionale»»; colonna «Credenziale» con i suoi quattro valori; «dall'inizio», «c'è ancora», «non indicata»; «Nessuna modifica da salvare»; «Non letti per …», «Non lette per …»; «Il confronto delle ore compare qui dopo le due letture.»; «manca»; «Richiamo scelto: [N] della risposta N di N»; gruppi «Per il cliente» e «Interno» nel catalogo; «tempo non noto»; «nessun dato»; «Notifica del sistema».
- **Cambiate:** «Scostamento da NetSuite: 560,00.» in fondo a «Costi secondo NetSuite» diventa «Lo scostamento è nella fascia in alto.»; «Modifica Nota di rilascio» ed «Elimina Nota di rilascio» diventano «Modifica» ed «Elimina», con il nome intero in `aria-label`.
- **Cambiata dopo il controllo a vista:** «×» nel dettaglio della persona diventa «Togli».
- **Accorciate:** le istruzioni di «Persone», l'introduzione di «Avvio del progetto», i paragrafi di «Ore» (interi dietro la «i»).

## Finestra minima 900×600

- Sotto 1.120 px vanno sotto il contenuto, a tutta larghezza: il dettaglio di «Da fare oggi», la colonna «Rilettura» e «Fonte citata», il riquadro della fonte in «Chiedi», il dettaglio di «Persone» e del bug, la seconda colonna di tabelle di «Commessa».
- Sotto 1.040 px le fasce di cifre vanno su due righe (3 + 2) e nelle criticità sparisce la colonna della categoria.
- Scorre in orizzontale solo una tabella dentro il suo riquadro.

## Tablet e telefono

Proposta di adattamento, del 20/11/2026. **Non è un incremento da applicare ora:** Octo è un'app desktop che legge una cartella del computer, e su tablet e telefono serve prima un'altra via ai dati. I problemi sono dedotti dalla struttura delle schermate a 1.280 px, non da schermate strette. Tavole nella fascia «Tablet e telefono» della tela: Oggi, Chiedi con risposta, Deliverable da rivedere, Commessa · Sintesi, a 768 e 390 px nei due temi. Le altre quattordici schermate seguono le stesse regole e non sono disegnate.

### Che cosa ostacola

| Gravità | Dove | Che cosa |
|---|---|---|
| Alta | Colonna di sinistra | fissa a 232 px: toglie il 30% della larghezza a 768 px, il 60% a 390 px |
| Alta | Tutti i comandi | controlli alti 30 px, azioni quiete di solo testo, «×» da 16 px: sotto i 44 px |
| Alta | Elenco con dettaglio a fianco | Oggi, Cruscotto, Deliverable, Persone, fonte di «Chiedi»: a 390 px due colonne non ci stanno |
| Alta | Campi in cui si scrive | testo a 13 px: sotto i 16 px il telefono ingrandisce la pagina a ogni tocco |
| Media | Tabelle larghe | Previsionale (8 colonne), Registro (7); colonne trascinabili e ridimensionabili inservibili al dito |
| Media | Ciò che vive sul puntatore | fondo al passaggio e spiegazioni dietro la «i» devono aprirsi con un tocco |
| Media | Commessa | «Documento interno» scorre via: al telefono deve restare in vista |
| Bassa | Testata | «Cartella del progetto» e tema vanno sotto «Altro» al telefono |

### Regole per larghezza

| Larghezza | Che cosa succede |
|---|---|
| Da 1.120 px in su | come nel resto di questo elenco |
| Tablet, da 768 a 1.119 px | la colonna di sinistra diventa due fasce in alto: marchio e progetto, poi le sezioni in riga con i quattro gruppi e i loro nomi. Contenuto su una colonna. Il dettaglio si apre sotto la riga scelta. «Rilettura» e «Fonte citata» a fianco, a 300 px. Fasce di cifre su tre colonne |
| Telefono, sotto 768 px | sezioni in una barra in basso: Oggi (con il badge), Chiedi, Deliverable, Cruscotto, Altro. Ogni elemento su due righe: etichette, poi titolo; le azioni della riga nel dettaglio. «Fonte citata» riquadro compatto sotto il testo. «Approva» e «Chiedi modifica» in una barra fissa in basso. Fasce di cifre su due colonne. Le tabelle scorrono nel loro riquadro |
| Al tocco, a ogni larghezza | pulsanti e schede alti 44 px, righe almeno 48 px, campi con testo a 16 px. Colonne non trascinabili né ridimensionabili |

### Valori

| Nome | Valori |
|---|---|
| Soglie | `@media (max-width: 1119px)` tablet, `@media (max-width: 767px)` telefono, `@media (pointer: coarse)` per le misure al tocco |
| `SectionNav.tsx`, `ProjectSwitcher.tsx` | tablet: fascia `padding: 8px 16px; background: var(--panel)`, poi sezioni in riga, voci `min-height: 44px; padding: 0 12px`, gruppi divisi da `border-left: 1px solid var(--line)`, voce scelta `background: var(--accent-soft); box-shadow: inset 0 -2px 0 var(--accent)`. Telefono: `position: sticky; bottom: 0; border-top: 1px solid var(--line)`, cinque voci `flex: 1; min-height: 52px; font-size: 12px`, scelta con `box-shadow: inset 0 2px 0 var(--accent)` |
| Pulsanti, schede, righe, campi | al tocco: pulsanti e schede `height: 44px; font-size: 14px`; righe `min-height: 48px`; campi `min-height: 44px; font-size: 16px` |
| Riga di elenco al telefono | `flex-wrap: wrap; row-gap: 2px; padding: 8px 12px`; titolo `flex: 1 1 100%; order: 2; white-space: normal`; azioni quiete e categoria nascoste, nel dettaglio |
| `.split-detail` e le altre colonne a fianco | tablet: 300 px. Telefono: `flex-direction: column`, larghezza piena; «Rilettura» prima del documento (`order: -1`) |
| Fasce di cifre | tablet: `grid-template-columns: repeat(3, minmax(0, 1fr))`, la quinta cifra su due colonne. Telefono: due colonne, la quinta a tutta larghezza. Divisori con `gap: 1px; background: var(--line)` |
| `DataTable.tsx`, `Resizable.tsx` | sotto 1.120 px niente trascinamento né ridimensionamento. Riquadro con `overflow-x: auto`; al telefono celle `padding: 10px 8px`, prima colonna `white-space: normal` |
| «Approva», «Chiedi modifica» | telefono: barra `position: sticky; bottom: 61px; padding: 8px 16px; border-top: 1px solid var(--line)`, pulsanti `flex: 1`. «Che cosa vuoi cambiare?» si apre da «Chiedi modifica» |

### Deroghe ai vincoli del brief

- **Una riga per elemento (vincolo 6):** al telefono un elemento occupa due righe.
- **Fonte a fianco della risposta:** al telefono la fonte sta sotto il testo; il richiamo numerato resta.
- **Gruppi della colonna di sinistra:** tutti presenti al tablet; al telefono «Ogni giorno» e «Lavoro» nella barra, «Ogni mese» e «Progetto» sotto «Altro».
- **Etichette nuove:** «Altro»; «Chat di oggi · N» al posto dell'elenco delle chat; il titolo del documento come selettore.

### Non disegnati

I dettagli aperti al tocco, il menu «Altro», la tastiera aperta, il tablet in orizzontale (1.024 px: vale la regola del tablet).

## Ordine consigliato degli incrementi

1. Token e regole comuni (stati, intestazioni, riga, fascia).
2. Oggi.
3. Deliverable.
4. Commessa.
5. Cruscotto.
6. Chiedi.
7. Impostazioni.

Dopo ogni incremento: `pnpm galleria` per rifare le schermate.
