# Lo stile di Octo, com'è oggi

Ciò che Claude Design deve rispettare o cambiare dichiarandolo. La fonte è una sola: `apps/desktop/src/renderer/styles.css` (4.054 righe, i token nelle prime 50). Se questo file e il CSS non coincidono, vale il CSS.

## Che cos'è

App desktop (Electron + React 19), finestra da 1280×860 nelle catture, minima 900×600. Niente libreria di componenti: HTML semantico e un solo foglio di stile. Tema chiaro e scuro con `light-dark()`: ogni colore è una coppia.

## Colori

| Token | Chiaro | Scuro | A che cosa serve |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0a0a0b` | fondo della pagina |
| `--surface` | `#ffffff` | `#111112` | riquadri |
| `--panel` | `#f6f6f6` | `#101011` | colonna di sinistra, intestazioni di tabella |
| `--hover` | `#f0f0f2` | `#202022` | passaggio del puntatore |
| `--text` | `#171719` | `#f5f5f5` | testo |
| `--muted` | `#606064` | `#a9a9af` | testo secondario |
| `--line` | `#dedee1` | `#2a2a2d` | separatori |
| `--field-line` | `#c8c8cd` | `#3b3b40` | bordo di pulsanti e riquadri |
| `--input-line` | `#8c8c93` | `#6c6c73` | bordo dei campi in cui si scrive (3:1 sul fondo) |
| `--accent` | `#5040c4` | `#b9acff` | viola: azione principale, selezione, focus, citazione in vista, marchio |
| `--accent-soft` | `#f0edff` | `#24203b` | fondo della voce selezionata |
| `--accent-edge` | `#c9bff3` | `#504479` | bordo della voce selezionata |
| `--on-accent` | `#ffffff` | `#1a1139` | testo sul viola |
| `--source` / `-bg` / `-edge` | `#225a88` / `#eaf4ff` / `#bcd7ef` | `#a6d1ff` / `#142739` / `#3b5b77` | blu: ciò che nomina una fonte |
| `--warning` / `-bg` / `-edge` | `#80500e` / `#fff5e1` / `#dbb46f` | `#ffd08a` / `#302319` / `#795528` | ambra: scadenza, cosa ferma, cosa da controllare |
| `--ok` / `-bg` | `#1a6b46` / `#e6f4ec` | `#6fcf9f` / `#13281d` | verde: conferma, frase riscontrata |
| `--danger` | `#b42318` | `#d14343` | errore, azione che toglie |

Regola d'uso: i fondi sono neutri; il colore porta un significato solo (viola = agire/selezione, blu = fonte, ambra = da verificare, verde = confermato, rosso = errore).

## Testo

- Carattere: Inter (variabile), di sistema come riserva. Monospazio: IBM Plex Mono, per identificativi, etichette di sezione in maiuscoletto e numeri dei riquadri del cruscotto.
- Base 14 px, interlinea 1,5, spaziatura −0,006 em (titoli −0,012 em).
- Scala in uso: 11 · 12 · 13 (controlli, la più frequente) · 14 (testo) · 15 · 17 · 20–24 (titolo di sezione e cifre grandi).
- Pesi: 400 testo, 500 controlli, 600 titoli e voce selezionata.
- Misure a destra con cifre tabulari, totali inclusi.

## Forme e misure

- Raggio 6 px (controlli), 8 px (riquadri). Altezza dei controlli 30 px.
- Ombre quasi assenti: `--shadow-control` sui pulsanti, `--shadow-raised` solo per ciò che sta sopra la pagina (dialoghi, menu).
- Colonna di sinistra 232 px; testata con nome del progetto in maiuscoletto e titolo della sezione.
- Soglie di larghezza già gestite: 1240, 1120, 1040, 1000, 960 px.
- Movimento minimo (0,12 s su fondo e bordo), spento con `prefers-reduced-motion`.

## Componenti che esistono

| Componente | Dove si vede | File |
|---|---|---|
| Colonna di sinistra: selettore del progetto, sezioni raggruppate per frequenza, badge | tutte | `SectionNav.tsx`, `ProjectSwitcher.tsx` |
| Schede interne (viola tenue, riga sotto) | Commessa, Cruscotto, Impostazioni | `styles.css`, regola delle `tab` |
| Pulsante pieno (uno per contesto), normale, «quieto» (solo testo viola) | tutte | `styles.css` |
| Riquadro con cifra | Commessa, Cruscotto | `ProjectSheetSummary.tsx`, `DashboardParts.tsx` |
| Tabella dati, colonne trascinabili e ridimensionabili | Commessa, Oggi, Impostazioni | `DataTable.tsx`, `Resizable.tsx` |
| Etichette colorate (fonte, scadenza, stato) | Oggi, Deliverable | `styles.css` |
| Avviso a tutta larghezza (ambra, verde) con azione | Oggi, Commessa | `SavedNote.tsx`, `Failure.tsx` |
| Elenco con dettaglio a fianco | Oggi, Cruscotto, Deliverable | `TodayView.tsx`, `DashboardBugs.tsx` |
| Risposta con richiami numerati e fonte a lato | Chiedi, Deliverable | `AnswerView.tsx`, `CitationPanel.tsx` |
| Campo di scrittura della chat | Chiedi | `AskView.tsx` |
| Dialogo | gestione dei progetti | `Dialog.tsx`, `ProjectDialogs.tsx` |
| Attesa con testo | tutte | `Spinner.tsx` |

## Parole

Le parole dell'interfaccia sono in `docs/glossario.md`: una cosa ha un nome solo («sezione», non «tab»; «fonte», non «connettore»; «leggere», non «sincronizzare»). Una proposta che cambia un'etichetta deve dirlo.
