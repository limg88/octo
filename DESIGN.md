---
name: Octo
description: Lo strumento da banco del Project Manager, dove ogni frase e ogni cifra mostra la sua fonte.
colors:
  accent: "light-dark(#5040c4, #b9acff)"
  accent-hover: "light-dark(#5f50cb, #c6bbff)"
  accent-soft: "light-dark(#f0edff, #24203b)"
  accent-edge: "light-dark(#c9bff3, #504479)"
  on-accent: "light-dark(#ffffff, #1a1139)"
  source: "light-dark(#225a88, #a6d1ff)"
  source-bg: "light-dark(#eaf4ff, #142739)"
  source-edge: "light-dark(#bcd7ef, #3b5b77)"
  warning: "light-dark(#80500e, #ffd08a)"
  warning-bg: "light-dark(#fff5e1, #302319)"
  warning-edge: "light-dark(#dbb46f, #795528)"
  ok: "light-dark(#1a6b46, #6fcf9f)"
  ok-bg: "light-dark(#e6f4ec, #13281d)"
  ok-edge: "light-dark(#9fcfb5, #2f6b4c)"
  danger: "light-dark(#b42318, #f47067)"
  on-danger: "#ffffff"
  bg: "light-dark(#ffffff, #0a0a0b)"
  surface: "light-dark(#ffffff, #111112)"
  panel: "light-dark(#f6f6f6, #101011)"
  hover: "light-dark(#f0f0f2, #202022)"
  text: "light-dark(#171719, #f5f5f5)"
  muted: "light-dark(#606064, #a9a9af)"
  line: "light-dark(#dedee1, #2a2a2d)"
  field-line: "light-dark(#c8c8cd, #3b3b40)"
  input-line: "light-dark(#8c8c93, #6c6c73)"
  logo-tile: "#f1efff"
typography:
  headline:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 680
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  headline-narrow:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 680
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  subhead:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.065em"
  sort-mark:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "9px"
  title:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.012em"
  figure:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.012em"
    fontFeature: "tnum"
  body:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.006em"
  label:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.006em"
  mark:
    fontFamily: "Inter Variable, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
  eyebrow:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.05em"
  info-glyph:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
rounded:
  mark: "4px"
  control: "6px"
  large: "8px"
  chat-chip: "14px"
  chat-bubble: "16px"
  chat-composer: "18px"
  pill: "999px"
spacing:
  row-x: "12px"
  page-x: "24px"
  section-gap: "16px"
  cell: "8px 10px"
components:
  button:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-hover:
    backgroundColor: "{colors.hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "30px"
  button-disabled:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "5px 10px"
    height: "32px"
  status:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
    typography: "{typography.mark}"
    rounded: "{rounded.mark}"
    padding: "0 6px"
    height: "20px"
  status-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok}"
  status-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
  pill-source:
    backgroundColor: "{colors.source-bg}"
    textColor: "{colors.source}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  tab-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  nav-item-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
  figure:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.figure}"
    padding: "12px 14px"
---

# Design System: Octo

Registrato il 20/11/2026 dal codice (`apps/desktop/src/renderer/styles.css`), dopo la revisione dell'interfaccia. Se questo file e il CSS non coincidono, vale il CSS.

## Overview

**Creative North Star: "Lo strumento da banco"**

Octo è un attrezzo di precisione, non una vetrina. Ogni comando sta al suo posto, la forma non chiede attenzione e il colore compare solo come segnale. Chi lo usa è un Project Manager che lo apre più volte al giorno, spesso fra una riunione e l'altra: legge molto, scrive poco, e deve potersi fidare di ciò che legge.

Per questo la pagina è densa e piatta. I fondi sono neutri nei due temi, distinti da piccoli scarti di luminosità; i riquadri hanno un bordo sottile e quasi nessuna ombra; i controlli sono bassi. I componenti sono sobri nella forma ed espliciti nel testo: la forma tace, la parola parla. Uno stato è sempre scritto, mai affidato al solo colore.

Il tema chiaro e quello scuro sono lo stesso sistema: ogni colore è una coppia `light-dark()`, e nessuna proposta vale se non regge in entrambi.

**Key Characteristics:**
- Denso e piatto: una riga per elemento, controlli da 30 px, ombre quasi assenti.
- Fondi neutri; cinque colori, ognuno con un significato solo.
- Ogni stato ha un testo; nessuno stato ha l'aspetto di un pulsante.
- Un solo pulsante pieno per contesto.
- Misure a destra, con cifre tabulari.
- Chiaro e scuro alla pari.

## Colors

Fondi neutri e cinque colori di segnale: ognuno dice una cosa sola.

### Primary
- **Viola dell'azione** (`accent`): l'azione principale, ciò che è scelto, il fuoco della tastiera, il richiamo scelto, il marchio. Il suo fondo tenue (`accent-soft`) e il suo bordo (`accent-edge`) segnano la voce scelta nella colonna di sinistra, la scheda in uso e la riga scelta di un elenco. Sul viola pieno il testo è `on-accent`.

### Secondary
- **Blu della fonte** (`source`, con `source-bg` e `source-edge`): solo ciò che nomina una fonte, cioè da dove viene una frase o una cifra.

### Tertiary
- **Ambra della verifica** (`warning`, con `warning-bg` e `warning-edge`): una scadenza, una cosa ferma, una cosa da controllare.
- **Verde della conferma** (`ok`, con `ok-bg` e `ok-edge`): ciò che è riscontrato o approvato.
- **Rosso dell'errore** (`danger`): l'errore e l'azione che toglie. Come testo regge 4,5:1 su entrambi i fondi.

### Neutral
- **Fondo** (`bg`) e **riquadro** (`surface`): la pagina e ciò che vi poggia sopra.
- **Pannello** (`panel`): la colonna di sinistra e le intestazioni di tabella.
- **Passaggio** (`hover`): il fondo sotto il puntatore e il fondo delle etichette neutre.
- **Testo** (`text`) e **testo secondario** (`muted`).
- **Separatore** (`line`), **bordo di pulsanti e riquadri** (`field-line`), **bordo dei campi in cui si scrive** (`input-line`).

### Named Rules
**La regola del significato solo.** Viola per agire e scegliere, blu per la fonte, ambra per ciò che va verificato, verde per ciò che è confermato, rosso per l'errore. Un colore non prende mai in prestito il significato di un altro: una categoria non è blu, un destinatario non è ambra.

**La regola dei fondi neutri.** Nessun fondo colorato per decorare. Un fondo tinto esiste solo dentro un'etichetta di stato, un avviso o una voce scelta.

**La regola del bordo che si vede.** Il bordo di un campo in cui si scrive (`input-line`) sta almeno a 3:1 sul fondo. `field-line` è più tenue e non va mai su un campo.

## Typography

**Display Font:** Inter Variable (con Inter, poi il carattere di sistema)
**Body Font:** Inter Variable
**Label/Mono Font:** IBM Plex Mono (con il monospazio di sistema)

**Character:** Un solo carattere per tutta l'interfaccia, usato piccolo e stretto; il monospazio compare poco, per identificativi e per i piccoli titoli in maiuscoletto.

### Hierarchy
- **Headline** (680, 24 px, interlinea 1,15, spaziatura −0,04 em): il titolo della sezione nella testata. Sotto i 960 px di larghezza scende a 20 px (**Headline narrow**).
- **Subhead** (650, 17 px, interlinea 1,25, spaziatura −0,02 em): il titolo di un dettaglio aperto, della guida d'avvio e il primo titolo dentro una risposta.
- **Wordmark** (750, 21 px, spaziatura −0,065 em): solo la scritta «octo» accanto al marchio.
- **Title** (600, 15 px, spaziatura −0,012 em): il titolo di un gruppo dentro la pagina. Maiuscole e minuscole normali.
- **Figure** (600, 22 px, interlinea 1,3, cifre tabulari): la cifra di un riquadro in «Commessa» e «Cruscotto».
- **Body** (400, 14 px, interlinea 1,5, spaziatura −0,006 em): il testo.
- **Label** (500, 13 px): pulsanti, schede, tabelle. È la misura più frequente.
- **Mark** (500, 12 px, interlinea 1,45): le etichette di stato e di categoria.
- **Eyebrow** (IBM Plex Mono 600, 11 px, spaziatura 0,05 em, maiuscolo): il nome del progetto sopra il titolo della sezione e i titoli dei sottogruppi («In corso · 1», «Calcolato da Octo»).

- **Info glyph** (Georgia corsivo 600, 12 px): solo la «i» del pulsante tondo da 18 px che apre una spiegazione. È l'unico punto in cui compare un carattere con le grazie, e non va usato altrove.

### Named Rules
**La regola delle misure a destra.** Ore, importi, percentuali e conteggi sono allineati a destra con `font-variant-numeric: tabular-nums`, totali compresi.

- **Sort mark** (9 px): il solo segno dell'ordinamento nell'intestazione di una colonna. È un glifo, non testo da leggere.

**La regola dei pesi.** 400 per il testo, 500 per i controlli, 600 per i titoli di gruppo e per ciò che è scelto. Salgono oltre solo i titoli grandi (650–680) e la scritta del marchio (750): Inter è variabile e questi pesi intermedi sono voluti.

## Layout

Due colonne: quella di sinistra è fissa a 232 px, su fondo `panel`, con il selettore del progetto e le sezioni raggruppate per frequenza d'uso (Ogni giorno, Lavoro, Ogni mese, Progetto). A destra una testata con il nome del progetto e il titolo della sezione, poi il contenuto con 24 px di margine laterale.

Dentro la pagina vale una riga per elemento finché non si apre un dettaglio. L'elenco con il dettaglio a fianco è lo schema ricorrente: l'elenco prende lo spazio, il dettaglio una colonna fissa (da 336 a 440 px secondo la sezione). Nella prima schermata stanno il risultato o l'azione frequente; impostazioni e dettagli occupano meno spazio del risultato.

La finestra di riferimento è 1280×860; la minima è 900×600 e deve restare usabile. Le soglie già in uso sono 1120, 1040, 1000 e 960 px: sotto 1120 px ciò che sta a fianco va sotto, a tutta larghezza. Se serve scorrere in orizzontale, scorre solo la tabella dentro il suo riquadro.

## Elevation & Depth

Il sistema è piatto. La profondità è data da bordi sottili e da piccoli scarti di luminosità fra `bg`, `surface` e `panel`, non da ombre.

### Shadow Vocabulary
- **Controllo** (`box-shadow: 0 1px 1px light-dark(rgba(15, 16, 20, 0.05), rgba(0, 0, 0, 0.3))`): sotto pulsanti e campi, appena percettibile.
- **Intestazione di tabella** (`box-shadow: 0 2px 4px light-dark(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.5))`): sotto l'intestazione che resta in vista mentre le righe scorrono.
- **Sollevato** (`box-shadow: 0 1px 2px light-dark(rgba(15, 16, 20, 0.06), rgba(0, 0, 0, 0.4)), 0 8px 28px light-dark(rgba(15, 16, 20, 0.12), rgba(0, 0, 0, 0.5))`): solo per ciò che sta sopra la pagina, cioè dialoghi e menu.

### Named Rules
**La regola del piatto.** Un riquadro nella pagina non ha ombra. L'ombra «sollevato» dice una cosa sola: questo sta sopra il resto.

## Shapes

Angoli appena smussati: 4 px per le etichette, 6 px per i controlli, 8 px per i riquadri. I bordi sono di 1 px. La voce scelta nella colonna di sinistra ha una barra interna di 2 px sul lato sinistro; la scheda in uso ha una riga interna di 2 px in basso. Nessuna forma decorativa.

La chat di «Chiedi» è l'unica famiglia più morbida: 14 px per le domande pronte e gli interruttori, 16 px per la bolla della domanda (con un angolo da 4 px verso chi scrive), 18 px per il campo in cui si scrive. Fuori dalla chat questi raggi non si usano. Il raggio pieno (999 px) è solo del badge con il conteggio e della barra di avanzamento.

**Citazione e giudizio.** Una frase citata da una fonte sta in un riquadro con bordo intero di 1 px nel blu delle fonti (`source-edge`) su fondo `panel`. Il giudizio di Claude in «Oggi» sta in un riquadro con bordo intero `accent-edge` su fondo `accent-soft`. Nessuna barra su un lato solo: l'unica barra laterale del sistema è quella della voce scelta nella colonna di sinistra e nella riga scelta di un elenco.

Nel tema scuro il marchio, che è scuro, poggia su una tessera chiara (`logo-tile`) con angoli da 6 px.

## Components

Sobri nella forma, espliciti nel testo.

### Buttons
- **Shape:** angoli da 6 px, altezza minima 30 px, margine interno `0 12px`, testo 13 px in peso 500.
- **Normale:** fondo `bg`, bordo `field-line`, ombra «controllo». Al passaggio il fondo diventa `hover`.
- **Pieno:** fondo e bordo `accent`, testo `on-accent`; al passaggio `accent-hover`. Uno solo per contesto: l'azione per cui il modulo o il risultato esistono.
- **Quieto:** senza bordo né fondo, testo viola; per l'azione dentro una riga. Al passaggio prende il fondo `hover`.
- **Che toglie:** fondo `danger`, testo `on-danger`.
- **Non disponibile:** fondo `panel`, bordo `line`, testo `muted`. Grigio su grigio, leggibile, non un colore sbiadito.
- **Fuoco:** contorno di 2 px `accent`, staccato di 2 px.
- **Bersaglio:** un comando più piccolo di 24 px (la «i» da 18 px, il richiamo numerato da 20 px) ha intorno un'area invisibile che lo porta a 26 px. Con il dito (`pointer: coarse`) pulsanti, schede, voci della colonna, selettore del periodo e campi sono alti 44 px; il testo dei campi resta a 14 px, perché a 16 px una data non entra più nella sua colonna.
- **Transizione:** 0,12 s su fondo e bordo.

### Chips
- **Etichetta di stato o di categoria:** altezza minima 20 px, margine interno `0 6px`, angoli da 4 px, bordo di 1 px, testo 12 px in peso 500. Neutra: fondo `hover`, bordo `field-line`.
- **Varianti:** verde (confermato), ambra (da verificare), blu (solo quando nomina una fonte).
- **Regola:** sempre con la sua parola, mai con il solo colore, mai con l'aspetto di un pulsante.
- **Richiamo numerato:** il numero accanto a una frase che rimanda alla fonte; verde se la frase è riscontrata nel file, ambra se non lo è.

### Cards / Containers
- **Corner Style:** 8 px.
- **Background:** `surface`.
- **Shadow Strategy:** nessuna (vedi «Elevation & Depth»).
- **Border:** 1 px `field-line`; i divisori interni sono `line`.
- **Riquadro con cifra:** margine interno `12px 14px`; etichetta 13 px `muted`, cifra 22 px in peso 600 con cifre tabulari, nota 13 px `muted`. Più cifre affiancate formano una fascia con un solo bordo esterno e divisori interni.

### Inputs / Fields
- **Style:** altezza minima 32 px (68 px per un'area di testo), margine interno `5px 10px`, angoli da 6 px, fondo `bg`, bordo `input-line`.
- **Passaggio:** il bordo diventa `muted`.
- **Focus:** bordo `accent` e alone di 3 px (`accent-ring`), senza contorno.
- **Menu:** freccia disegnata a 11 px dal bordo destro.
- **Casella di spunta:** 15 px, colore `accent`.

### Navigation
- **Colonna di sinistra:** voci alte 28 px, testo 14 px in peso 400, senza bordo. I titoli dei gruppi sono 13 px in peso 500, `muted`.
- **Voce scelta:** fondo `accent-soft`, barra interna di 2 px `accent` a sinistra, peso 600.
- **Badge:** pastiglia `accent` con il conteggio, accanto a «Oggi».
- **Schede interne:** alte 28 px, testo `muted`; quella in uso ha fondo `accent-soft`, testo viola in peso 600 e una riga interna di 2 px `accent` in basso.

### Tabella dati
- Testo 13 px con cifre tabulari; celle `8px 10px`; righe divise da `line`.
- L'intestazione resta in vista mentre le righe scorrono: fondo `panel`, peso 600.
- La riga sotto il puntatore prende il fondo `panel`.

### Risposta con fonte
Il componente che distingue Octo. Ogni frase di una risposta o di un deliverable porta un richiamo numerato; a fianco, un riquadro mostra la fonte del richiamo scelto: da dove viene, la frase citata, e se il codice l'ha riscontrata nel file. Ciò che il codice non trova resta nel testo, marcato in ambra.

## Do's and Don'ts

### Do:
- **Do** usare un solo pulsante pieno per contesto; gli altri sono normali o quieti.
- **Do** scrivere ogni stato con la sua parola, dentro l'etichetta di stato.
- **Do** allineare le misure a destra con cifre tabulari, totali compresi.
- **Do** tenere una riga per elemento finché non si apre un dettaglio.
- **Do** verificare ogni proposta nei due temi: testo ad almeno 4,5:1, bordo dei campi ad almeno 3:1.
- **Do** distinguere a vista ciò che calcola Octo da ciò che valuta Claude.
- **Do** rispettare `prefers-reduced-motion`: il movimento è minimo e si spegne.

### Don't:
- **Don't** usare il blu per una categoria o l'ambra per un destinatario: il blu è la fonte, l'ambra è ciò che va verificato.
- **Don't** colorare un fondo per decorare.
- **Don't** dare a uno stato l'aspetto di un pulsante, né a un comando l'aspetto di un testo.
- **Don't** mettere `field-line` sul bordo di un campo in cui si scrive.
- **Don't** dare ombra a un riquadro nella pagina.
- **Don't** segnare un riquadro con una barra su un lato solo: bordo intero e fondo tenue.
- **Don't** far scorrere in orizzontale la pagina: scorre solo una tabella nel suo riquadro.
- **Don't** introdurre parole inglesi o un secondo nome per una cosa che il glossario ha già nominato.
