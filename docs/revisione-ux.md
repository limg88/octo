# Revisione UX/UI di Octo

## Sintesi

In Oggi la coda occupa gran parte della prima schermata e lascia poco spazio alle urgenze.
In Allineamento la ripetizione dello stesso avviso allontana le liste, mentre l’export richiede di scorrere fino al fondo.
Le tabelle alternano allineamenti e trattamenti diversi. Il Previsionale mensile interrompe il confronto con una riga di spiegazione per commessa.
Gli interventi portano in vista le azioni frequenti, rendono più rapida la scansione e mantengono accessibili dati, dettagli e verifiche.

## Mappa degli screenshot

Tutte le schermate mostrano il tema scuro. La resa in chiaro e gli stati non fotografati sono da verificare durante l’esecuzione. I riferimenti al codice sono relativi alla radice di Octo e si riferiscono alla copia di lavoro esaminata.

| File | Sezione | Stato mostrato | Componente principale (percorso) |
| --- | --- | --- | --- |
| Screenshot 2026-11-17 alle 14.50.42.png | Oggi | Il Punto aperto, coda e inserimento rapido | `apps/desktop/src/renderer/TodayPoints.tsx` |
| Screenshot 2026-11-17 alle 14.50.48.png | Oggi | Stessa pagina, scorsa fino ad Adesso, criticità della settimana e dettaglio di una segnalazione | `apps/desktop/src/renderer/TodayView.tsx` |
| Screenshot 2026-11-17 alle 14.50.52.png | Oggi | Stessa pagina, scorsa fino a Messe da parte, valutazione e accesso alle impostazioni | `apps/desktop/src/renderer/TodayView.tsx` |
| Screenshot 2026-11-17 alle 14.50.59.png | Chiedi | Nuova chat vuota, con cronologia e suggerimenti | `apps/desktop/src/renderer/AskView.tsx` |
| Screenshot 2026-11-17 alle 14.51.05.png | Chiedi | Conversazione riaperta, inizio della risposta con fonte a lato | `apps/desktop/src/renderer/AskView.tsx` |
| Screenshot 2026-11-17 alle 14.51.10.png | Chiedi | Stessa risposta, parte finale con dati da confermare, passaggio a Deliverable e fonti | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.17.png | Deliverable | Catalogo dei tipi di documento | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.51.20.png | Deliverable | Nuova bozza di stato di avanzamento, modulo vuoto con modello associato | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.51.27.png | Deliverable | Documento approvato, file disponibili e rilettura a lato | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.51.31.png | Deliverable | Stesso documento, prima tabella larga dell’anteprima e rilettura | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.35.png | Deliverable | Stesso documento, tabelle di squadra e attività a metà anteprima | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.39.png | Deliverable | Stesso documento, continuazione delle tabelle di attività | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.42.png | Deliverable | Stesso documento, fine anteprima e informazioni da confermare | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.48.png | Deliverable | Stesso documento, inizio dell’elenco lungo delle citazioni | `apps/desktop/src/renderer/AnswerView.tsx` |
| Screenshot 2026-11-17 alle 14.51.51.png | Deliverable | Stesso documento, fine elenco e pannello della fonte citata | `apps/desktop/src/renderer/CitationPanel.tsx` |
| Screenshot 2026-11-17 alle 14.51.56.png | Deliverable | Registro con una riga e riepilogo dei tempi | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.52.08.png | Deliverable | Nuova bozza di modifiche al tracker, modulo vuoto, modello assente | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.52.13.png | Deliverable | Nuova bozza di email al cliente, modulo vuoto, modello assente | `apps/desktop/src/renderer/DeliverablesView.tsx` |
| Screenshot 2026-11-17 alle 14.52.27.png | Cruscotto → Bug | Periodo preimpostato, indicatori, filtri e primo bug selezionato | `apps/desktop/src/renderer/DashboardBugs.tsx` |
| Screenshot 2026-11-17 alle 14.52.35.png | Cruscotto → Bug | Stessa scheda e stesso bug, scorsa fino a commento e azioni | `apps/desktop/src/renderer/DashboardBugs.tsx` |
| Screenshot 2026-11-17 alle 14.52.41.png | Cruscotto → Bug | Stessa scheda, periodo personalizzato con campi data visibili | `apps/desktop/src/renderer/DashboardView.tsx` |
| Screenshot 2026-11-17 alle 14.52.44.png | Cruscotto → Sprint | Periodo personalizzato, sprint in corso, indicatori e lista storie | `apps/desktop/src/renderer/DashboardSprint.tsx` |
| Screenshot 2026-11-17 alle 14.52.51.png | Cruscotto → Sprint | Stessa scheda, fine riepilogo sprint e inizio requisiti poco chiari | `apps/desktop/src/renderer/DashboardSprint.tsx` |
| Screenshot 2026-11-17 alle 14.52.55.png | Cruscotto → Sprint | Stessa scheda, fondo dei requisiti e decisioni richiuse | `apps/desktop/src/renderer/DashboardSprint.tsx` |
| Screenshot 2026-11-17 alle 14.53.04.png | Cruscotto → Andamento | Periodo personalizzato, grafico, tempi di passaggio e commento su richiesta | `apps/desktop/src/renderer/DashboardTrend.tsx` |
| Screenshot 2026-11-17 alle 14.53.12.png | Ore | Confronto mensile popolato, quadratura riuscita e assenze attese | `apps/desktop/src/renderer/HoursView.tsx` |
| Screenshot 2026-11-17 alle 14.53.18.png | Previsionale → Mese | Dati mensili, correzioni in tabella, dettagli chiusi e dati mancanti | `apps/desktop/src/renderer/ForecastMonth.tsx` |
| Screenshot 2026-11-17 alle 14.53.23.png | Avanzamento | Vista per posizioni, riepilogo, fatture e ultima richiesta aperta | `apps/desktop/src/renderer/ProgressView.tsx` |
| Screenshot 2026-11-17 alle 14.53.26.png | Avanzamento | Stessa vista, scorsa fino alle azioni dell’ultima richiesta | `apps/desktop/src/renderer/ProgressView.tsx` |
| Screenshot 2026-11-17 alle 14.53.32.png | Avanzamento | Stessa vista, due richieste aperte da confrontare | `apps/desktop/src/renderer/ProgressView.tsx` |
| Screenshot 2026-11-17 alle 14.53.42.png | Avanzamento | Stessa vista, nuova richiesta senza importo e anteprima in attesa | `apps/desktop/src/renderer/ProgressRequestForm.tsx` |
| Screenshot 2026-11-17 alle 14.53.48.png | Allineamento | Risultati dello sprint con avvisi di classificazione e inizio lista Senza ticket | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.53.53.png | Allineamento | Stessa pagina, configurazione aperta con sprint, tag e perimetro | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.53.57.png | Allineamento | Stessa configurazione aperta, equivalenze, percorsi e salvataggio | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.54.01.png | Allineamento | Stessi risultati, scorsi fino alla prima lista dopo gli avvisi | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.54.05.png | Allineamento | Stessi risultati, export in fondo alla prima lista e inizio ticket da spostare | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.54.11.png | Allineamento | Stessa lista dei ticket da spostare, con stati coerenti e diversi | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.54.14.png | Allineamento | Stessa pagina, duplicati e liste vuote richiuse | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 14.54.21.png | Impostazioni → Collegamenti | Fonti collegate, letture riuscite e azione collettiva | `apps/desktop/src/renderer/ProjectSettings.tsx` |
| Screenshot 2026-11-17 alle 14.54.27.png | Impostazioni → Persone e calendario | Editor persone con scorrimento orizzontale e inizio calendario | `apps/desktop/src/renderer/TeamSection.tsx` |
| Screenshot 2026-11-17 alle 14.54.31.png | Impostazioni → Persone e calendario | Stessa scheda, fondo persone, calendario e salvataggio | `apps/desktop/src/renderer/TeamSection.tsx` |
| Screenshot 2026-11-17 alle 14.54.37.png | Impostazioni → Pagina «Oggi» | Indirizzi aggiuntivi, notifica attiva e un tipo nascosto | `apps/desktop/src/renderer/TodaySettings.tsx` |
| Screenshot 2026-11-17 alle 14.54.41.png | Impostazioni → Carta intestata | Carta intestata e modello presentazioni già impostati | `apps/desktop/src/renderer/ProjectSettings.tsx` |
| Screenshot 2026-11-17 alle 14.54.45.png | Impostazioni → Avanzate | Selezione dei modelli per risposte, scrittura e rilettura | `apps/desktop/src/renderer/ModelsSection.tsx` |
| Screenshot 2026-11-17 alle 14.54.57.png | Cruscotto → Attività | Altro progetto, unica scheda disponibile, registro e ore per persona | `apps/desktop/src/renderer/DashboardActivities.tsx` |
| Screenshot 2026-11-17 alle 14.55.04.png | Previsionale → Commessa | Stesso progetto della scheda Attività, ore e costi con origine e budget proposto | `apps/desktop/src/renderer/ForecastLifetime.tsx` |
| Screenshot 2026-11-17 alle 14.55.09.png | Avanzamento | Stesso progetto della scheda Attività, vista a corpo con riepilogo fatturazione | `apps/desktop/src/renderer/ProgressFixedPrice.tsx` |

## Principi

1. Nella prima schermata devono comparire il risultato o l’azione frequente. Le impostazioni locali e i dettagli consultati a richiesta occupano meno spazio del risultato.
2. Per ogni contesto operativo usa un solo pulsante pieno per l’azione principale. Le azioni secondarie mantengono un’etichetta esplicita.
3. Nei testi di interfaccia usa verbi concreti e una sola denominazione per lo stesso concetto. Mantieni l’aiuto ordinario entro due righe alla larghezza delle catture e scrivi istruzioni comuni una volta sola.
4. Allinea a destra intestazioni e valori delle misure e usa cifre tabulari, totali inclusi. Gli identificativi restano leggibili come testo.
5. Mostra una riga per elemento finché l’utente non apre un dettaglio. Quando serve scorrere in orizzontale, deve scorrere solo la tabella.
6. Ogni stato ha un testo riconoscibile. Verde per conferme, ambra per elementi da verificare, indicazione testuale durante l’attesa. Gli errori mantengono l’annuncio e l’eventuale azione di recupero.
7. Per selezione, focus, superfici e bordi riusa i token del tema e verifica il contrasto in chiaro e in scuro. Un indicatore di forma o peso distingue la scheda selezionata anche senza colore.
8. Un valore proposto deve provenire da un dato già configurato o letto. Mantieni la scelta modificabile e conserva il significato dei campi lasciati vuoti.

Per l’esecuzione seguire `CLAUDE.md`. Intervenire nei file esistenti con modifiche mirate, tenere identificatori e commenti di codice in inglese e centralizzare le nuove stringhe in `messages.ts`. In «Test», *riusa* indica un’asserzione che usa già la chiave aggiornata, *verifica* una copertura esistente da mantenere, *aggiorna* un’asserzione da adeguare o aggiungere nello stesso file.

## Interventi trasversali

### UX-01 · Rendi riconoscibile la scheda attiva

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.52.41.png`, `Screenshot 2026-11-17 alle 14.53.18.png`, `Screenshot 2026-11-17 alle 14.54.21.png`, `Screenshot 2026-11-17 alle 14.54.45.png`
- Dove: `apps/desktop/src/renderer/styles.css:851` `.tab-selected`, `.tab-selected:hover:not(:disabled)`
- Problema: Nelle schede interne il riempimento grigio si confonde con gli altri controlli. La navigazione principale segnala la selezione con un bordo viola.
- Modifica: Principio 7. Nella regola condivisa imposta `background: var(--accent-soft)`, `color: var(--accent-text)`, `font-weight: 600` e `box-shadow: inset 0 -2px var(--accent)`. Conserva il contorno di focus e le classi usate dalla navigazione verticale.
- Fatto quando: Su Cruscotto, Previsionale e Impostazioni solo la scheda attiva è sottolineata e ha maggior peso. Il focus a tastiera resta distinguibile in entrambi i temi.
- Test: Nessuna asserzione di stile da cambiare. Verifica la selezione in `apps/desktop/test/forecast.test.tsx:842`, `apps/desktop/test/dashboard.test.tsx:1114` e i temi in `apps/desktop/test/theme.test.tsx:47`.
- Dipende da: niente
- Rischio: Il testo più pesante può allargare di poco le schede. Controlla la fila di Impostazioni a finestra ridotta.

### UX-02 · Applica lo stile comune alle tabelle semplici

- Priorità: Alta
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 14.54.57.png`, `Screenshot 2026-11-17 alle 14.55.04.png`, `Screenshot 2026-11-17 alle 14.55.09.png`
- Dove: `apps/desktop/src/renderer/DashboardActivities.tsx:41` registro e seconda tabella alla riga 131, `apps/desktop/src/renderer/ForecastLifetime.tsx:111`, `apps/desktop/src/renderer/ProgressFixedPrice.tsx:43`, `apps/desktop/src/renderer/styles.css:1378` `table.data .number`, `apps/desktop/src/renderer/styles.css:1435` `.table-wide table`
- Problema: Le misure e i totali nelle quattro tabelle semplici hanno l’allineamento predefinito del browser. Le intestazioni centrate e le righe senza separatori rendono difficile seguire la colonna.
- Modifica: Principi 4, 5 e 7. Aggiungi `className="data"` alle quattro tabelle native e sostituisci `amount` con `number` su `th` e `td` delle misure, totali inclusi. Conserva `scope`, nomi accessibili e celle di dettaglio. Aggiungi `table-intrinsic` ai tre contenitori `.table-wide` esistenti e la regola `.table-wide.table-intrinsic > table { min-width: 0; }` dopo la regola generale da 960 px. Avvolgi anche la seconda tabella di Attività in `table-wide table-intrinsic`, così l’eventuale overflow è locale.
- Fatto quando: Ore, costi e percentuali hanno lo stesso allineamento delle tabelle di Ore. A finestra ridotta la pagina resta ferma in orizzontale e i valori più lunghi restano leggibili. Il diario si apre dalla stessa riga.
- Test: Verifica ruoli, nomi e contenuti in `apps/desktop/test/dashboard.test.tsx:1109`, `apps/desktop/test/forecast.test.tsx:840` e `apps/desktop/test/progress.test.tsx:625`. Nessuna query da rinominare.
- Dipende da: niente
- Rischio: In Attività verifica che il commento lungo vada a capo e che l’apertura del diario non sposti le colonne fuori vista.

### UX-03 · Allinea le intestazioni numeriche ordinabili ai valori

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.51.56.png`, `Screenshot 2026-11-17 alle 14.52.44.png`, `Screenshot 2026-11-17 alle 14.53.12.png`, `Screenshot 2026-11-17 alle 14.53.18.png`, `Screenshot 2026-11-17 alle 14.53.26.png`
- Dove: `apps/desktop/src/renderer/styles.css:1461` `button.sort`, `.sort-mark` alla riga 1482 e `table.data .number` alla riga 1378. Origine in `apps/desktop/src/renderer/DataTable.tsx:141`
- Problema: Le cifre sono già tabulari e a destra. Il pulsante dell’intestazione porta con sé lo spazio del simbolo di ordinamento a destra e arretra il testo rispetto alle cifre.
- Modifica: Principio 4. Per `table.data th.number > button.sort` imposta `display: block; position: relative; width: 100%; text-align: right; padding-inline-start: 13px`. Per il suo `.sort-mark` imposta `position: absolute; inset-inline-start: 0; inset-block-start: 0.25em; color: var(--accent-text)`. Conserva `aria-sort` e l’intera intestazione cliccabile.
- Fatto quando: In Ore le etichette e le cifre terminano sullo stesso bordo destro. Ordinando una misura il simbolo compare a sinistra senza spostare il testo. Le intestazioni testuali mantengono il loro allineamento.
- Test: Verifica ordinamento, gruppi e totali in `apps/desktop/test/tables.test.tsx`. Nessun ruolo o testo da aggiornare.
- Dipende da: niente
- Rischio: Le colonne più strette possono mandare l’etichetta su due righe. Controlla Scostamento e Giorni nello stato.

### UX-04 · Usa la stessa attesa all’apertura delle sezioni

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.53.12.png`, `Screenshot 2026-11-17 alle 14.53.18.png`, `Screenshot 2026-11-17 alle 14.53.23.png`, `Screenshot 2026-11-17 alle 14.53.48.png`, `Screenshot 2026-11-17 alle 14.55.04.png`, `Screenshot 2026-11-17 alle 14.55.09.png`
- Dove: `apps/desktop/src/renderer/HoursView.tsx:227`, `apps/desktop/src/renderer/ForecastView.tsx:205`, `apps/desktop/src/renderer/ForecastLifetime.tsx:57`, `apps/desktop/src/renderer/ProgressView.tsx:127`, `apps/desktop/src/renderer/ProgressFixedPrice.tsx:38`, `apps/desktop/src/renderer/AlignmentView.tsx:104`. Riuso di `apps/desktop/src/renderer/Spinner.tsx:61`. Chiavi esistenti `hours.loading`, `forecast.loading`, `forecast.lifetime.loading`, `progress.loading`, `progress.fixedPrice.loading`, `alignment.loading` in `messages.ts`. Riferimento `apps/desktop/src/renderer/DashboardView.tsx:295`. Stili riusati in `apps/desktop/src/renderer/styles.css:2723` e alla riga 2735.
- Problema: Attesa dedotta dal codice. Le sei viste usano un paragrafo con classe progress senza il ruolo annunciato da Waiting. Le catture mostrano il risultato già caricato.
- Modifica: Principio 6. Sostituisci ciascuno dei sei paragrafi di attesa iniziale con `Waiting` da `Spinner.tsx`, usando l’involucro `page-wait` di Cruscotto per le attese a pagina intera e il solo `Waiting` nella scheda Commessa già impaginata. Riusa il rispettivo `text.loading`. Mantieni ogni ramo `Failure` e il suo eventuale collegamento di recupero. Il nuovo indicatore prende il posto della barra attuale.
- Fatto quando: Con risposta ritardata si vede una sola attesa e si trova un solo `role="status"`. Quando arriva il risultato o un errore l’attesa scompare e l’errore appare nel ramo già previsto.
- Test: Aggiorna `apps/desktop/test/forecast.test.tsx` e `apps/desktop/test/progress.test.tsx` con un controllo mirato ciascuno per attesa e transizione, usando le chiavi esistenti. Verifica `apps/desktop/test/hours.test.tsx` e `apps/desktop/test/alignment.test.tsx` per eventuali query di ruolo non attese.
- Dipende da: niente
- Rischio: Con chiamate differite nei test il ruolo status può essere presente prima del salvataggio. Esegui le asserzioni di salvataggio dopo il caricamento.

### UX-05 · Riduci lo spazio riservato alle impostazioni chiuse

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.52.27.png`, `Screenshot 2026-11-17 alle 14.52.41.png`, `Screenshot 2026-11-17 alle 14.53.04.png`, `Screenshot 2026-11-17 alle 14.53.12.png`, `Screenshot 2026-11-17 alle 14.53.18.png`, `Screenshot 2026-11-17 alle 14.53.48.png`
- Dove: `apps/desktop/src/renderer/styles.css:1608` `.dashboard-settings summary`. Chiamanti osservati in `apps/desktop/src/renderer/DashboardView.tsx:428`, `apps/desktop/src/renderer/HoursView.tsx:281`, `apps/desktop/src/renderer/ForecastView.tsx:213` e `apps/desktop/src/renderer/AlignmentView.tsx:124`
- Problema: Le impostazioni locali chiuse appaiono come un pulsante a sé e il margine sotto aggiunge spazio al gap della pagina. Date, schede e risultati partono più in basso.
- Modifica: Principi 1 e 7. Sposta `margin-bottom: 12px` da `.dashboard-settings summary` a `.dashboard-settings[open] > summary`, con `margin-bottom: 8px`. Conserva bordo, segno di apertura e area cliccabile.
- Fatto quando: Con la configurazione chiusa la sezione successiva risale di 12 px. Con la configurazione aperta la prima riga del modulo resta separata dal comando.
- Test: Nessuna query da cambiare. Verifica apertura e salvataggio in `apps/desktop/test/dashboard.test.tsx`, `apps/desktop/test/hours.test.tsx`, `apps/desktop/test/forecast.test.tsx` e `apps/desktop/test/alignment.test.tsx`.
- Dipende da: niente
- Rischio: La regola condivisa vale anche al primo avvio. Controlla la configurazione già aperta quando è stato trovato un file.

## Interventi per sezione

### Oggi

### UX-06 · Mostra quattro punti aperti all’ingresso

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.50.42.png`, `Screenshot 2026-11-17 alle 14.50.48.png`
- Dove: `apps/desktop/src/renderer/TodayPoints.tsx:11` (`POINTS_LIMIT`, usato alle righe 210 e 289). Riuso di `today.points.more` in `apps/desktop/src/renderer/messages.ts:169`.
- Problema: I sette punti aperti in primo piano, con le loro azioni riga per riga, spingono Adesso verso il fondo. Il riepilogo urgente è quello che si cerca ogni giorno.
- Modifica: Principio 1. Porta `POINTS_LIMIT` da 7 a 4. Usa il comando esistente «Mostra gli altri» per vedere l’intera coda, con il conteggio ricalcolato e il ritorno al formato breve. Il limite riguarda la coda e lascia fuori dal conteggio le conferme in attesa.
- Fatto quando: Con la stessa coda della prima cattura si vedono quattro punti, il comando conta i rimanenti e Adesso ha più spazio. L’espansione mostra tutti i punti nello stesso ordine e una seconda pressione ripristina i quattro.
- Test: Aggiorna `apps/desktop/test/today.test.tsx:403`. Con la coda di prova di nove punti attendi 4 righe, «Mostra gli altri 5», poi 9 righe.
- Dipende da: niente
- Rischio: Chi lavora dal quinto punto in poi deve espandere la lista. Mantieni espansione, ordine, inserimento e azioni per riga.

### Chiedi

### UX-07 · Accorcia l’invito nella chat vuota

- Priorità: Bassa
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.50.59.png`
- Dove: `apps/desktop/src/renderer/messages.ts:558` `askChats.freshHint`. Renderizzato in `apps/desktop/src/renderer/AskView.tsx:185`
- Problema: La frase in alto ripete che la chat è nuova e chiede di fare una domanda. Il campo e il comando Nuova chat lo spiegano già.
- Modifica: Principio 3. Sostituisci l’intero messaggio con «In questa chat Octo tiene conto delle tue domande precedenti e ricontrolla le fonti a ogni risposta.»
- Fatto quando: La chat vuota spiega continuità e controllo delle fonti in una frase. Il campo e le domande pronte restano raggiungibili.
- Test: Riusa le verifiche di `chats.freshHint` in `apps/desktop/test/ask.test.tsx:178` e alle righe 206 e 250.
- Dipende da: niente
- Rischio: nessuno

### UX-08 · Distingui frase citata e conclusione nella fonte

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.51.05.png`, `Screenshot 2026-11-17 alle 14.51.10.png`, `Screenshot 2026-11-17 alle 14.51.51.png`
- Dove: `apps/desktop/src/renderer/messages.ts:1851` `citation.foundNote`. Renderizzato in `apps/desktop/src/renderer/CitationPanel.tsx:142`
- Problema: Sotto il badge verde una spiegazione lunga ripete il controllo della frase. Il passaggio da controllare è la conclusione della risposta.
- Modifica: Principi 3 e 6. Sostituisci il testo con «Leggi il contesto della fonte per valutare la conclusione.» Il badge conserva la scritta «Frase riscontrata nel file».
- Fatto quando: Per una citazione riscontrata il badge descrive il riscontro e la riga di aiuto invita a leggere il contesto. Apri l’originale e il messaggio per la citazione da verificare restano disponibili.
- Test: Riusa la query di `text.foundNote` in `apps/desktop/test/ask.test.tsx:81`.
- Dipende da: niente
- Rischio: nessuno

### Deliverable

### UX-09 · Contestualizza la rilettura di un documento approvato

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.51.27.png`, `Screenshot 2026-11-17 alle 14.51.31.png`, `Screenshot 2026-11-17 alle 14.51.35.png`, `Screenshot 2026-11-17 alle 14.51.39.png`
- Dove: `apps/desktop/src/renderer/DeliverablesView.tsx:462` pannello della rilettura, chiamata a `RedTeam` alla riga 466 e verdetto alla riga 609, `apps/desktop/src/renderer/messages.ts:1698` `deliverableRedTeamFix` e `review.exported` alla riga 1908
- Problema: Il pannello affianca un badge verde di approvazione e un invito ambra a correggere prima dell’uscita. Lo stato operativo e il giudizio storico sembrano contraddirsi.
- Modifica: Principi 3 e 6. Passa a `RedTeam` un booleano `approved` derivato dallo stato. Solo per un documento approvato con giudizio di correzione, usa la nuova chiave `deliverableRedTeamFixApproved` con «La rilettura segnalava correzioni prima dell’invio.» Rimuovi dal pannello la frase `review.exported`, già coperta dallo stato nel titolo e dal riquadro «File pronti». Elimina la chiave rimasta senza usi.
- Fatto quando: Sul documento approvato i file sono ancora in cima, i rilievi rimangono leggibili e il giudizio è al passato. Durante la revisione il messaggio di correzione resta attuale e le azioni funzionano.
- Test: Aggiorna `apps/desktop/test/deliverables.test.tsx:176` aggiungendo il caso approvato accanto al caso in revisione. Cerca la nuova chiave e la presenza dei file nel caso approvato.
- Dipende da: niente
- Rischio: Il giudizio storico deve restare visibile. Mantieni gravità, rilievi e stato di approvazione distinti.

### UX-10 · Richiudi gli elenchi lunghi di fonti

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.51.10.png`, `Screenshot 2026-11-17 alle 14.51.48.png`, `Screenshot 2026-11-17 alle 14.51.51.png`
- Dove: `apps/desktop/src/renderer/AnswerView.tsx:94` elenco `.sources` e `messages.sources`, `apps/desktop/src/renderer/styles.css:3149` `.answer .sources`
- Problema: L’elenco lungo di fonti occupa più schermate anche quando si usa direttamente un richiamo numerato. Le liste brevi in Chiedi sono già leggibili.
- Modifica: Principi 1 e 5. Con più di otto citazioni, rendi l’attuale intestazione «Fonti · [conteggio]» il `summary` di un `details` nativo chiuso all’ingresso. Usa il medesimo contenuto di lista per il ramo breve e per quello richiudibile, conservando numeri, id, selezione e pulsanti. Sostituisci il titolo esistente nel ramo richiudibile. Aggiungi `cursor: pointer; width: fit-content; font-weight: 600; color: var(--accent-text)` al `summary` limitato alla lista fonti di `.answer`, con una classe applicata al solo `details` della lista.
- Fatto quando: Sul documento lungo il conteggio è subito leggibile e l’elenco intero si ottiene con un clic o Invio. Un richiamo nel testo aggiorna il pannello anche con l’elenco chiuso. Nella risposta breve la lista continua a vedersi direttamente.
- Test: Aggiorna `apps/desktop/test/deliverables.test.tsx` con una risposta di oltre otto fonti e verifica apertura e selezione. Conserva in `apps/desktop/test/ask.test.tsx` la copertura del pannello e dei richiami.
- Dipende da: niente
- Rischio: Le fonti con numerazione non consecutiva devono mantenere i valori originali. Evita di reimpostare la fonte selezionata all’apertura.

### UX-11 · Spiega che il registro misura tempi

- Priorità: Bassa
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.51.56.png`
- Dove: `apps/desktop/src/renderer/messages.ts:1661` `deliverableRegisterIntro`. Renderizzato in `apps/desktop/src/renderer/DeliverablesView.tsx:706`
- Problema: «Che cosa è costato» fa pensare a un costo economico, mentre il registro riporta tempi di scrittura, revisione e giri già nominati nell’intestazione.
- Modifica: Principio 3. Sostituisci l’intero testo con «Qui trovi i tempi e i giri di revisione. Le pause oltre 20 minuti sono escluse dal tempo di revisione.»
- Fatto quando: La frase chiarisce in quale misura si legge il registro e conserva la regola sulle pause. Colonne, riepilogo e unità continuano a essere visibili.
- Test: Nessuna query sul testo introduttivo da cambiare. Verifica dati della riga in `apps/desktop/test/deliverables.test.tsx:379`.
- Dipende da: niente
- Rischio: nessuno

### Cruscotto

### UX-12 · Porta le azioni del bug sopra il commento

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.52.27.png`, `Screenshot 2026-11-17 alle 14.52.35.png`
- Dove: `apps/desktop/src/renderer/DashboardBugs.tsx:320` blocchi di nota e commento, azioni e modulo dalla riga 334
- Problema: Il commento può occupare tutta la parte visibile del dettaglio. Chiedere del bug, annotarlo o aprirlo nel tracker richiede uno scorrimento supplementare.
- Modifica: Principi 1 e 2. Sposta il blocco `editing ? … : …` subito dopo la riga dei dati del bug e prima della nota e dell’ultimo commento. Tieni le condizioni su `onAsk`, `OpenItem`, il testo completo del commento e la bozza della nota.
- Fatto quando: Selezionando il bug le azioni appaiono sopra il commento anche se è lungo. «Scrivi una nota» sostituisce quella fila con il modulo. Dopo salvataggio l’azione torna visibile.
- Test: Verifica in `apps/desktop/test/dashboard.test.tsx` le query per `text.askAbout`, `text.addNote` e il comando al tracker. Nessun nome o ruolo da cambiare.
- Dipende da: niente
- Rischio: L’ordine di focus cambia con l’ordine visivo. Controlla Tab e il ritorno alla vista dopo Annulla.

### Ore

### UX-13 · Distingui un’assenza prevista da una quadratura riuscita

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.53.12.png`
- Dove: `apps/desktop/src/renderer/HoursView.tsx:420` classe dello stato, `apps/desktop/src/renderer/messages.ts:1291` `hours.status.expected`, `apps/desktop/src/renderer/styles.css:785` `.status`
- Problema: «Atteso» usa lo stesso verde di «Torna». A colpo d’occhio una differenza prevista sembra un confronto riuscito e «Atteso» può suggerire un dato ancora in arrivo.
- Modifica: Principi 3 e 6. Usa «Assenza prevista» per `hours.status.expected` e mantieni `status-ok` solo per `ok`. Per il ramo `expected` usa `status status-neutral`. Aggiungi `.status-neutral { background: var(--hover); color: var(--muted); }` accanto alla base `.status`. L’etichetta sostituisce quella attuale. Non modificare le soglie e la regola che riconosce l’assenza.
- Fatto quando: Una riga con assenza prevista appare neutra e con testo esplicito. Le righe riuscite restano verdi e quelle che richiedono verifica restano ambra.
- Test: Aggiorna `apps/desktop/test/hours.test.tsx:227` e alla riga 232 verificando il testo di stato distinto dopo l’azione esistente. Le query su `text.markExpected` restano valide.
- Dipende da: niente
- Rischio: La stringa di stato fa parte della ricerca e dell’ordinamento testuale. Controlla il filtro per «prevista».

### Previsionale

### UX-14 · Mostra il calcolo solo nel dettaglio della commessa

- Priorità: Alta
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 14.53.18.png`
- Dove: `apps/desktop/src/renderer/ForecastMonth.tsx:443` callback `detail`, apertura alla riga 231, `apps/desktop/src/renderer/messages.ts:1069` `forecast.moreData`, `forecast.howComputed` alla riga 1110 e `forecast.inputsHint` alla riga 1115. Il rendering facoltativo è in `apps/desktop/src/renderer/DataTable.tsx:173`.
- Problema: Ogni commessa ha una seconda riga permanente con il metodo di calcolo. I dati consecutivi risultano separati e l’aiuto sopra la tabella ripete a parole i gruppi dell’intestazione.
- Modifica: Principi 3 e 5. Da `detail` restituisci `null` per codici chiusi. Per il codice aperto metti l’attuale nota di calcolo, se presente, prima di `CodeDetails`. Sostituisci `forecast.moreData` con «Calcolo e dettagli», conservando il codice nel nome accessibile. Sostituisci `forecast.inputsHint` con «I campi sono facoltativi. Se scrivi i ricavi corretti, sostituiscono quelli calcolati. Nel modello Excel ritrovi anche Da fatturare e Tua nota.»
- Fatto quando: A dettagli chiusi c’è una riga per commessa. Aprirne una mostra nota e campi della sola commessa selezionata. Un collegamento da «Dati che mancano» apre ancora il dettaglio giusto.
- Test: Riusa `text.moreData` e le query sul gruppo di dettaglio in `apps/desktop/test/forecast.test.tsx:286`, `apps/desktop/test/forecast.test.tsx:383` e `apps/desktop/test/forecast.test.tsx:699`. Aggiorna il controllo della nota per verificare che segua l’espansione.
- Dipende da: niente
- Rischio: Se il filtro esclude la riga aperta mantiene lo stato corrente. Verifica che gli input già digitati restino nel draft dopo chiusura e riapertura.

### UX-15 · Mostra Giorni e Avanzamento quando si applicano

- Priorità: Media
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 14.53.18.png`
- Dove: `apps/desktop/src/renderer/ForecastMonth.tsx:134` righe del mese, colonne alle righe 274 e 283, gruppo calcolato alla riga 418 e totale dalla riga 424, `apps/desktop/src/renderer/styles.css:2004` `.forecast-month`, minimo di tabella alla riga 2027
- Problema: Il mese fotografato riserva una colonna intera ad Avanzamento, che per le commesse a giornate contiene solo trattini. A finestra più stretta quella larghezza compete con i campi della destra.
- Modifica: Principi 4 e 5. Calcola `showDays` con `rows.some(row => !row.values.quantityIsShare)` e `showProgress` con `rows.some(row => row.values.quantityIsShare)`, sull’intero mese prima di cercare o ordinare. Includi le colonne esistenti secondo i due flag. Sottrai dal `COMPUTED_COLUMNS` iniziale una posizione per ciascuna colonna esclusa. Nel totale rendi condizionali sugli stessi flag la cella dei giorni e la cella vuota dell’avanzamento. Rimuovi `overflow-x: auto` da `.forecast-month`, conservandolo sul `.table-wide` già presente. Mantieni le larghezze delle altre colonne e il minimo di 1120 px.
- Fatto quando: Solo giornate mostra Giorni, solo quote mostra Avanzamento, un mese misto mostra entrambe. Intestazioni raggruppate, totali e dettaglio coprono le colonne presenti. In finestra ridotta scorre la tabella e il pulsante di salvataggio resta fermo.
- Test: Mantieni il caso misto in `apps/desktop/test/forecast.test.tsx:149`. Aggiorna il caso a riga singola alla riga 190 con un’asserzione sui titoli e sostituisci il controllo dei trattini alla riga 211 con uno sulla cella pertinente. Aggiungi il caso di sole quote nello stesso file.
- Dipende da: niente
- Rischio: Errori di colSpan possono far slittare margini e input. Verifica i tre tipi di mese con il footer, una riga aperta e il filtro.

### UX-16 · Accorcia la spiegazione sul periodo della commessa

- Priorità: Bassa
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.55.04.png`
- Dove: `apps/desktop/src/renderer/messages.ts:1137` `forecast.lifetime.through`. Renderizzato in `apps/desktop/src/renderer/ForecastLifetime.tsx:93`
- Problema: Il paragrafo sopra le cifre ripete i tipi di ore. La tabella ha una colonna Fonte e sotto spiega come si stimano le ore del tracker.
- Modifica: Principi 3 e 6. Sostituisci il template di `through(month)` con «Dall’inizio della commessa a [mese]. Per i mesi ancora da leggere in NetSuite, le ore del tracker sono una stima.» Conserva la nota specifica sotto la tabella quando ci sono stime.
- Fatto quando: Il periodo e la spiegazione delle stime sono leggibili in due frasi. Con ore stimate il dettaglio di fonte e la nota restano visibili.
- Test: Verifica la resa e il dettaglio stimato in `apps/desktop/test/forecast.test.tsx:915`. Nessuna query su `through` da aggiornare.
- Dipende da: niente
- Rischio: nessuno

### Avanzamento

### UX-17 · Porta Nuova richiesta prima della tabella delle fatture

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.53.23.png`, `Screenshot 2026-11-17 alle 14.53.26.png`, `Screenshot 2026-11-17 alle 14.53.42.png`
- Dove: `apps/desktop/src/renderer/ProgressView.tsx:181` blocco `ProgressInvoices`, avvisi alla riga 190 e comando o modulo alla riga 202. Titolo del modulo in `apps/desktop/src/renderer/ProgressRequestForm.tsx:94`.
- Problema: Per aggiungere una richiesta si attraversa il riepilogo delle posizioni fatturate. Anche il modulo aperto resta sotto la tabella, benché dipenda dall’azione appena scelta.
- Modifica: Principi 1 e 2. Sposta il blocco `ProgressInvoices` dopo il blocco condizionale del comando o di `ProgressRequestForm`, prima dello storico. Lascia gli avvisi di calcolo immediatamente sopra il comando o modulo. Conserva la condizione `nothingToAsk` e i collegamenti alle azioni di registrazione. Al montaggio di `ProgressRequestForm`, porta il focus sul suo titolo esistente usando un ref e `tabIndex={-1}`. Così anche «Correggi» dallo storico porta al modulo aperto in alto.
- Fatto quando: Dopo i totali e gli eventuali avvisi si vede «Nuova richiesta». Aprendola, il modulo compare nello stesso punto. Per un ordine interamente fatturato senza fatture da registrare il comando resta assente. «Correggi» porta il focus al titolo del modulo corrispondente.
- Test: Verifica il comando in `apps/desktop/test/progress.test.tsx:214` e il ramo in cui è assente alla riga 564. Conserva le query di ruolo. Prova anche Correggi dallo storico con una lista lunga.
- Dipende da: niente
- Rischio: Per chi corregge dallo storico il modulo si apre più in alto. Controlla il percorso a tastiera e che il modulo sia raggiungibile.

### UX-18 · Usa uno stato neutro per le posizioni ancora da fatturare

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.53.23.png`, `Screenshot 2026-11-17 alle 14.53.26.png`
- Dove: `apps/desktop/src/renderer/ProgressInvoices.tsx:61` rami dello stato, `progress.invoices.notBilled` invariato. Riuso di `apps/desktop/src/renderer/styles.css:785` `.status-neutral` da UX-13, accanto a `.status`
- Problema: Ogni posizione ancora da fatturare è ambra, anche in una lista ordinaria di avanzamento. I casi che richiedono un intervento competono con uno stato previsto del processo.
- Modifica: Principio 6. Nel ramo senza fattura usa `className="status status-neutral"` in luogo di `status-warning`. Conserva «Non fatturata» e mantieni ambra il riquadro separato delle fatture non registrate.
- Fatto quando: Le posizioni non fatturate si distinguono per testo e tono neutro. Quando ci sono fatture da registrare emerge il riquadro ambra, mentre «Fatturata» resta verde.
- Test: Riusa la query per `words.notBilled` in `apps/desktop/test/progress.test.tsx:538`. Verifica la registrazione dal riquadro nello stesso file.
- Dipende da: UX-13
- Rischio: Controlla che le fatture non registrate restino riconoscibili dal riquadro dedicato.

### Allineamento

### UX-19 · Accorpa le differenze di classificazione in un avviso

- Priorità: Alta
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 14.53.48.png`, `Screenshot 2026-11-17 alle 14.53.57.png`, `Screenshot 2026-11-17 alle 14.54.01.png`
- Dove: `apps/desktop/src/renderer/AlignmentView.tsx:305` ciclo `stateMismatches`, `apps/desktop/src/renderer/messages.ts:799` `alignment.stateMismatch` e nuove chiavi accanto a questa, `apps/desktop/src/renderer/styles.css:805` `.warning`, con variante locale `.alignment-mismatches`
- Problema: Più riquadri ambra ripetono la stessa spiegazione. I risultati iniziano molto più in basso e «qui sotto» indica la direzione sbagliata per raggiungere la configurazione.
- Modifica: Principi 1, 3 e 6. Con almeno una differenza sostituisci i paragrafi con un solo `details.warning.alignment-mismatches` chiuso all’ingresso. Il `summary` usa `alignment.stateMismatchSummary(count)` con «Uno stato è letto in modo diverso dal Cruscotto» al singolare e «[conteggio] stati sono letti in modo diverso dal Cruscotto» al plurale. Dentro rendi un `ul` con una voce per differenza e riscrivi `alignment.stateMismatch(state, group, dashboardPhase)` come ««[stato]» appartiene al gruppo «[gruppo]» qui e alla fase «[fase]» nel Cruscotto.» Dopo la lista usa `alignment.stateMismatchHelp` con «I conti dello sprint possono differire. Per allinearli, cambia il gruppo in “Che cosa confronto” oppure la fase in “Impostazioni del cruscotto”, sotto “Come leggo gli stati dei bug”.» Usa `align-self: flex-start; max-width: min(100%, 720px)` sul riquadro, `cursor: pointer; font-weight: 600` sul suo `summary` e `margin-block: 6px; padding-inline-start: 20px` sulla lista.
- Fatto quando: Con lo stesso confronto si vede un solo avviso compatto. Un clic mostra tutte le associazioni e un solo rimando alle due configurazioni. L’avviso di quadratura fallita conserva il suo ruolo alert.
- Test: Aggiorna `apps/desktop/test/alignment.test.tsx:147` con il riepilogo, l’apertura con il comando nativo e il dettaglio. Verifica zero, una e più differenze nello stesso file.
- Dipende da: niente
- Rischio: Il dettaglio richiede un clic. Mantieni il conteggio nel riepilogo e l’ordine delle differenze fornito dall’app.

### UX-20 · Metti l’export dei ticket prima delle righe

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.53.48.png`, `Screenshot 2026-11-17 alle 14.54.05.png`
- Dove: `apps/desktop/src/renderer/AlignmentView.tsx:186` `List`, unico uso con `children` dalla riga 324, posizione dei figli alla riga 241. Riuso di `alignment.exportMissing` in `apps/desktop/src/renderer/messages.ts:839`
- Problema: Per creare il file di import bisogna scorrere fino in fondo alla lista «Senza ticket». Anche la conferma dell’export resta lontana dall’inizio della lista.
- Modifica: Principi 1 e 2. Nel ramo aperto di `List` sposta `{children}` dopo il titolo e l’eventuale introduzione, prima di filtro e tabella. I figli sono usati dalla sola lista «Senza ticket». Mantieni il controllo sulle righe mancanti, il solo pulsante primario e il risultato con l’azione per aprire il file.
- Fatto quando: L’export è sotto il titolo «Senza ticket». Dopo l’export il risultato e «Apri il file» sono accanto alla relativa azione. Con zero righe il pulsante è assente.
- Test: Verifica `apps/desktop/test/alignment.test.tsx:178` per zero righe e `apps/desktop/test/alignment.test.tsx:195` per l’export. Nessuna stringa da aggiornare.
- Dipende da: niente
- Rischio: Controlla che il filtro resti sotto il comando e che l’export mantenga il perimetro attuale anche con il filtro attivo.

### Impostazioni

### UX-21 · Dai un nome esplicito alla lettura collettiva

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.54.21.png`
- Dove: `apps/desktop/src/renderer/messages.ts:1715` `guideFill`. Il comando chiama la lettura in `apps/desktop/src/renderer/SetupGuide.tsx:50` ed è renderizzato alla riga 75.
- Problema: «Riempi la memoria ora» suona come un’azione di primo avvio anche quando le fonti sono già collegate. I pulsanti delle singole fonti parlano già di lettura.
- Modifica: Principi 2 e 3. Sostituisci `guideFill` con «Leggi tutte le fonti». Conserva `guideFilling` e il dettaglio degli esiti, inclusa la conversione di documenti del flusso esistente.
- Fatto quando: Il pulsante pieno rende evidente l’azione collettiva e le righe conservano «Leggi ora» per la singola fonte. Dopo il clic si vede il progresso e poi il riepilogo.
- Test: Riusa le query su `messages.guideFill` in `apps/desktop/test/guide.test.tsx:78` e alla riga 108.
- Dipende da: niente
- Rischio: Il comando comprende anche la conversione dei documenti. Controlla che l’esito Documenti resti nominato.

### UX-22 · Usa la larghezza disponibile per l’editor Persone

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.54.27.png`, `Screenshot 2026-11-17 alle 14.54.31.png`
- Dove: `apps/desktop/src/renderer/TeamSection.tsx:145` form `.settings-form.wide-form`, colonne delle persone alla riga 17 e calendario alla riga 164, `apps/desktop/src/renderer/styles.css:1935` `.wide-form` e base `.rows-scroll` alla riga 1699. La griglia è composta da `apps/desktop/src/renderer/RowsField.tsx:77`.
- Problema: L’editor ha un limite di 1000 px e fa scorrere in orizzontale le ultime colonne anche con spazio libero a destra. Chi cerca note e rimozione deve scorrere dentro il riquadro.
- Modifica: Principi 4 e 5. Aggiungi `team-form` al form di `TeamSection`. Estendi il limite solo per quel form con `.settings-form.wide-form.team-form { max-width: 1280px; }`. Aggiungi `calendar-rows` a un contenitore del solo RowsField del calendario e imposta `.team-form .calendar-rows { max-width: 1000px; }`. Tieni lo scorrimento locale in `.rows-scroll` per finestre più strette.
- Fatto quando: Alla larghezza della cattura si vedono anche la colonna finale e il comando di rimozione senza scroll laterale. A finestra ridotta scorre il riquadro e il calendario mantiene la sua misura. Filtra, modifica e salva una riga senza spostare i dati in un’altra.
- Test: Verifica editor, salvataggio e nomi dei campi in `apps/desktop/test/team.test.tsx:112` e alla riga 144. Nessuna query da cambiare.
- Dipende da: niente
- Rischio: Controlla che il focus e le segnalazioni di validazione restino associati alle stesse righe.

### UX-23 · Spiega cosa significa Predefinito nei modelli

- Priorità: Bassa
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 14.54.45.png`
- Dove: `apps/desktop/src/renderer/messages.ts:719` `models.intro`. Renderizzato in `apps/desktop/src/renderer/ModelsSection.tsx:51`. Il valore proposto per una scelta vuota è alla riga 69.
- Problema: L’introduzione ripete l’elenco dei tre menu prima di spiegare il modello dipendente dal computer.
- Modifica: Principi 3 e 8. Sostituisci il testo con «Con “Predefinito” usi il modello di Claude Code su questo computer. Accanto alla risposta o al deliverable trovi il modello usato.» Conserva le scelte salvate e la mappatura del predefinito a valore assente.
- Fatto quando: La spiegazione è in due frasi brevi. Selezionando Predefinito si può tornare alla scelta del computer con il salvataggio esistente.
- Test: Verifica il valore vuoto e il salvataggio in `apps/desktop/test/models.test.tsx:25`. Nessuna query sul testo introduttivo da aggiornare.
- Dipende da: niente
- Rischio: nessuno

## Ordine di esecuzione

1. **Schede, controlli e attese** · UX-01, UX-04, UX-05. Cambia scheda e percorri la barra con la tastiera nei due temi. Ritarda una risposta e simula un errore. Apri e richiudi le impostazioni in Cruscotto e Ore.
2. **Tabelle condivise e moduli** · UX-02, UX-03, UX-22. Confronta l’allineamento del registro Attività, di Commessa e di Ore. Ordina una misura e apri un diario. Allarga e restringi Persone e calendario e salva una modifica.
3. **Lettura quotidiana e azioni** · UX-06, UX-12, UX-17, UX-19, UX-20. Passa da Oggi al bug, apri una nuova richiesta e correggine una dallo storico. In Allineamento espandi l’avviso e crea il file dalla testa della lista.
4. **Chiedi e Deliverable** · UX-07, UX-08, UX-09, UX-10, UX-11. Apri una chat nuova, segui un richiamo, confronta la rilettura di una bozza con quella di un documento approvato e apri l’elenco delle fonti lungo. Controlla anche il registro.
5. **Ore e Previsionale** · UX-13, UX-14, UX-15, UX-16. Riconosci le assenze previste. Confronta mesi a giornate, a corpo e misti. Apri il calcolo, salva i dati e ricontrolla le stime in Commessa.
6. **Stati di fatturazione e testi delle impostazioni** · UX-18, UX-21, UX-23. Dopo il lotto 5, verifica l’ambra sulle fatture da registrare e il tono neutro sulle posizioni ancora da fatturare. Prova la lettura collettiva e il predefinito dei modelli.

Al termine di ogni lotto usa dati di prova per la verifica visiva e confronta le pagine alle dimensioni delle catture e a finestra più stretta. Rispetta i momenti di esecuzione dei test previsti da `CLAUDE.md`. Da radice, per i test mirati usa `pnpm exec vitest run apps/desktop/test/<file>.test.tsx` con i file indicati. I comandi generali sono `pnpm test`, `pnpm test:coverage`, `pnpm lint` e `pnpm build`. Per la demo di chiusura segui la convenzione del repository.

## Da decidere

- **Approvazione con rilievi gravi** · Lascia la decisione al PM conservando il giudizio storico, oppure rendi il giudizio vincolante prima dell’approvazione. Raccomando la prima opzione per questa revisione. Il secondo comportamento è una scelta di processo. UX-09 interviene sulla leggibilità dello stato già salvato.
- **Valori iniziali di Persone e calendario** · Conserva allocazioni, tetti e date vuoti quando il dato è sconosciuto, oppure proponi un valore solo se esiste una regola di progetto con una fonte dichiarata e il PM può modificarlo. Raccomando i campi vuoti: le catture mostrano casi diversi e il codice usa questi valori nei controlli di Ore e nei costi. UX-22 riguarda solo la larghezza dell’editor.
- **Predefinito per i modelli** · Segui la configurazione di Claude Code del computer, oppure scegli modelli espliciti per progetto. Raccomando il predefinito locale come punto di partenza e modelli espliciti quando il progetto richiede la stessa scelta su più computer. UX-23 spiega il comportamento attuale.

## Non toccare

- Il raggruppamento della navigazione per frequenza, il badge di Oggi e la visibilità delle sezioni per tipo di progetto. Si vedono in `Screenshot 2026-11-17 alle 14.50.42.png` e `Screenshot 2026-11-17 alle 14.54.57.png`. La sequenza e la navigazione a frecce sono in `apps/desktop/src/renderer/sections.ts:29` e `apps/desktop/src/renderer/SectionNav.tsx:20`.
- Il richiamo numerato che mostra la fonte a fianco della risposta e il passaggio da risposta a Deliverable, visibili in `Screenshot 2026-11-17 alle 14.51.05.png` e `Screenshot 2026-11-17 alle 14.51.10.png`.
- L’accesso ai file approvati in cima al documento e l’associazione del modello al singolo tipo, visibili in `Screenshot 2026-11-17 alle 14.51.20.png`, `Screenshot 2026-11-17 alle 14.51.27.png` e `Screenshot 2026-11-17 alle 14.52.08.png`.
- Il grafico con legenda e accesso ai numeri, in `Screenshot 2026-11-17 alle 14.53.04.png`. Mantieni la possibilità di aprire la tabella dal grafico.
- La quadratura in Ore, gli avvisi sui dati mancanti e la distinzione tra ore lette e ore stimate, visibili in `Screenshot 2026-11-17 alle 14.53.12.png`, `Screenshot 2026-11-17 alle 14.53.18.png` e `Screenshot 2026-11-17 alle 14.55.04.png`.
- Il presidio «Documento interno» del Previsionale e il collegamento da Avanzamento a Previsionale, in `Screenshot 2026-11-17 alle 14.55.04.png` e `Screenshot 2026-11-17 alle 14.55.09.png`.
- L’apertura simultanea di richieste per confrontarle e la proposta della data «Dal» usando la fine dell’ultima richiesta, in `Screenshot 2026-11-17 alle 14.53.32.png` e `Screenshot 2026-11-17 alle 14.53.42.png`. La proposta modificabile è in `apps/desktop/src/renderer/ProgressRequestForm.tsx:35`.
- Il cambio sprint fuori dalla configurazione in Allineamento, visibile in `Screenshot 2026-11-17 alle 14.53.48.png`. Lo sprint frequente si cambia dalla pagina dei risultati.

## Integrazione sui pannelli di configurazione

Le 24 catture aggiuntive sono tutte in tema scuro. UX-05 riguarda la configurazione chiusa. UX-22 e UX-23 coprono rispettivamente la larghezza di Persone e calendario e il predefinito dei modelli. Le attività qui sotto riguardano i pannelli aperti e si possono consegnare in incrementi separati. I punti di inserimento si riferiscono alla copia di lavoro durante l’implementazione del primo piano. Se le righe si spostano, cerca il simbolo o la chiave indicati.

| File | Sezione | Stato mostrato | Componente principale (percorso) |
| --- | --- | --- | --- |
| Screenshot 2026-11-17 alle 15.36.58.png | Oggi | Registro dei rischi aperto, nessun rischio accettato e proposte con fonti | `apps/desktop/src/renderer/RiskRegister.tsx` |
| Screenshot 2026-11-17 alle 15.37.20.png | Impostazioni → Collegamenti | Posta aperta, filtri, opzioni avanzate richiuse e azioni in fondo | `apps/desktop/src/renderer/SourcesView.tsx` |
| Screenshot 2026-11-17 alle 15.37.26.png | Impostazioni → Collegamenti | Stessa scheda, Riunioni aperto con cartella e data | `apps/desktop/src/renderer/MeetingsSection.tsx` |
| Screenshot 2026-11-17 alle 15.37.39.png | Impostazioni → Collegamenti | Altro progetto, Azure DevOps aperto con accesso e perimetro | `apps/desktop/src/renderer/FeedSection.tsx` |
| Screenshot 2026-11-17 alle 15.37.44.png | Impostazioni → Collegamenti | Stessa scheda, Jira aperto con accesso e progetti | `apps/desktop/src/renderer/FeedSection.tsx` |
| Screenshot 2026-11-17 alle 15.37.48.png | Impostazioni → Collegamenti | Stessa scheda, Confluence aperto con accesso e spazi | `apps/desktop/src/renderer/FeedSection.tsx` |
| Screenshot 2026-11-17 alle 15.37.58.png | Impostazioni → Collegamenti | Stessa scheda, NetSuite aperto con accesso e commesse | `apps/desktop/src/renderer/FeedSection.tsx` |
| Screenshot 2026-11-17 alle 15.38.07.png | Impostazioni → Collegamenti | Stesso modulo NetSuite, ricerca commesse con risultati | `apps/desktop/src/renderer/FeedSection.tsx` |
| Screenshot 2026-11-17 alle 15.39.08.png | Impostazioni → Avanzate | Stessa schermata dei modelli già mappata nel primo piano. Coperta da UX-23 | `apps/desktop/src/renderer/ModelsSection.tsx` |
| Screenshot 2026-11-17 alle 15.39.17.png | Avanzamento | Impostazioni aperte, file del modello e mappa delle celle | `apps/desktop/src/renderer/ProgressSetup.tsx` |
| Screenshot 2026-11-17 alle 15.39.21.png | Avanzamento | Stesso modulo, colonne Excel e inizio dell’ordine | `apps/desktop/src/renderer/ProgressSetup.tsx` |
| Screenshot 2026-11-17 alle 15.39.24.png | Avanzamento | Stesso modulo, riepilogo posizioni e salvataggio | `apps/desktop/src/renderer/ProgressSetup.tsx` |
| Screenshot 2026-11-17 alle 15.39.34.png | Allineamento | Configurazione aperta, sprint, periodo e tag. Stessa vista delle catture iniziali | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 15.39.37.png | Allineamento | Stessa configurazione, equivalenze, percorsi e salvataggio | `apps/desktop/src/renderer/AlignmentView.tsx` |
| Screenshot 2026-11-17 alle 15.39.48.png | Previsionale | Impostazioni aperte, tipi delle commesse e inizio tariffe | `apps/desktop/src/renderer/ForecastView.tsx` |
| Screenshot 2026-11-17 alle 15.39.52.png | Previsionale | Stesse impostazioni, tariffe, esterni e costi orari | `apps/desktop/src/renderer/ForecastView.tsx` |
| Screenshot 2026-11-17 alle 15.39.56.png | Previsionale | Stesse impostazioni, salvataggio e ritorno alla scheda Mese nello scorrimento | `apps/desktop/src/renderer/ForecastView.tsx` |
| Screenshot 2026-11-17 alle 15.40.02.png | Ore | Impostazioni aperte, esportazioni, codici, data e prima lista di eccezioni | `apps/desktop/src/renderer/HoursView.tsx` |
| Screenshot 2026-11-17 alle 15.40.06.png | Ore | Stesse impostazioni, entrambe le liste di eccezioni | `apps/desktop/src/renderer/HoursView.tsx` |
| Screenshot 2026-11-17 alle 15.40.14.png | Ore | Stesse impostazioni, nomi equivalenti e passaggio ai risultati | `apps/desktop/src/renderer/HoursView.tsx` |
| Screenshot 2026-11-17 alle 15.40.20.png | Cruscotto | Impostazioni aperte, file e liste di tag e tipi | `apps/desktop/src/renderer/DashboardSettingsForm.tsx` |
| Screenshot 2026-11-17 alle 15.40.24.png | Cruscotto | Stesse impostazioni, tipi, filtri e soglie | `apps/desktop/src/renderer/DashboardSettingsForm.tsx` |
| Screenshot 2026-11-17 alle 15.40.27.png | Cruscotto | Stesse impostazioni, associazione fra stati e fasi e salvataggio | `apps/desktop/src/renderer/DashboardSettingsForm.tsx` |
| Screenshot 2026-11-17 alle 15.40.39.png | Deliverable | Creazione di un tipo personalizzato, modulo vuoto | `apps/desktop/src/renderer/DeliverablesView.tsx` |

### Trasversali e Collegamenti

### UX-24 · Richiudi le liste lunghe di opzioni nei moduli

- Priorità: Alta
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 15.39.34.png`, `Screenshot 2026-11-17 alle 15.40.02.png`, `Screenshot 2026-11-17 alle 15.40.06.png`, `Screenshot 2026-11-17 alle 15.40.14.png`, `Screenshot 2026-11-17 alle 15.40.20.png`, `Screenshot 2026-11-17 alle 15.40.24.png`
- Dove: `apps/desktop/src/renderer/KnownList.tsx:29`, `apps/desktop/src/renderer/DashboardSettingsForm.tsx:84`, `apps/desktop/src/renderer/HoursView.tsx:623`, `apps/desktop/src/renderer/AlignmentView.tsx:556`, `apps/desktop/src/renderer/messages.ts:1805` `knownList.showOptions` nuova chiave, `apps/desktop/src/renderer/styles.css:1274` `.known-list` e `.checks-scroll`
- Problema: Le liste di tag, tipi ed eccezioni aprono tutte una superficie di ricerca e scorrimento. Nel Cruscotto si attraversano tre liste prima di vedere le soglie; in Ore le due liste interrompono il confronto tra le eccezioni già scelte.
- Modifica: Principi 1 e 5. Aggiungi a `KnownList` un prop opzionale `foldOptions`. Passalo a tag, tipi bug e tipi storie nel Cruscotto, alle due eccezioni di Ore e ai tag di Allineamento. Con `foldOptions` e `searchable` veri mantieni i valori scelti e la rimozione a vista e racchiudi ricerca ed elenco già esistenti in un `details` chiuso inizialmente. Il `summary` sostituisce la ricerca in vista a riposo e usa `knownList.showOptions(count)` con «Scegli tra [numero] opzioni». Usa la classe `advanced` che già stila il `summary` e un contenitore con `display: flex; flex-direction: column; gap: 8px` per ricerca e lista. Con liste brevi o immissione manuale mantieni il ramo esistente.
- Fatto quando: Il modulo aperto mostra prima le scelte correnti. Un clic apre ricerca e caselle; scegliere, togliere e salvare funziona anche con un valore storico assente dalle opzioni lette. Una lista breve resta in vista.
- Test: Mantieni il ramo standard in `apps/desktop/test/tables.test.tsx:140` e aggiungi un caso con `foldOptions`. Verifica le query sui gruppi in `apps/desktop/test/dashboard.test.tsx:1199` e `apps/desktop/test/hours.test.tsx:184`.
- Dipende da: niente
- Rischio: Più clic per aggiungere un valore. Verifica apertura da tastiera e leggibilità dei valori già scelti senza espandere.

### UX-25 · Dichiara quale configurazione usa Leggi ora

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.37.20.png`, `Screenshot 2026-11-17 alle 15.37.26.png`, `Screenshot 2026-11-17 alle 15.37.39.png`, `Screenshot 2026-11-17 alle 15.37.44.png`, `Screenshot 2026-11-17 alle 15.37.48.png`, `Screenshot 2026-11-17 alle 15.37.58.png`, `Screenshot 2026-11-17 alle 15.38.07.png`
- Dove: `apps/desktop/src/renderer/SourcesView.tsx:217`, `apps/desktop/src/renderer/MeetingsSection.tsx:161`, `apps/desktop/src/renderer/FeedSection.tsx:328`, `apps/desktop/src/renderer/messages.ts:635` nuova chiave `readSavedSource`
- Problema: Nel modulo aperto Leggi ora è accanto a Salva o Prova e salva. Sembra applicare quello che si è appena digitato. I tre handler di lettura passano il progetto all’API, mentre i valori in modifica sono passati all’API di salvataggio. In Posta l’anteprima riceve invece i filtri in modifica.
- Modifica: Principi 2 e 3. Usa «Leggi con le impostazioni salvate» come `readSavedSource` per il solo pulsante dentro ciascuno dei tre moduli. Mantieni le etichette brevi e i comandi nella testata della fonte quando il pannello è chiuso. Il nuovo testo prende il posto di quello ambiguo. Lascia Anteprima disponibile in Posta.
- Fatto quando: Con modifiche in corso il pulsante nomina le impostazioni salvate. Anteprima in Posta continua a usare la bozza. Lo stato di collegamento e la disponibilità dei pulsanti seguono i rami esistenti.
- Test: Aggiorna le query del pulsante nei moduli in `apps/desktop/test/sources.test.tsx:103`, `apps/desktop/test/meetings.test.tsx:126` e `apps/desktop/test/feeds.test.tsx:74` usando la nuova chiave. Verifica nei tre file le altre occorrenze delle chiavi brevi distinguendo testata e modulo.
- Dipende da: niente
- Rischio: La nuova etichetta è più larga. Prova il gruppo di azioni di Posta e dei connettori anche a finestra ridotta.

### UX-26 · Nomina correttamente il server di NetSuite

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.37.58.png`
- Dove: `apps/desktop/src/renderer/messages.ts:651` `feedFields.host`, `apps/desktop/src/renderer/FeedSection.tsx:429`
- Problema: L’etichetta afferma che serve un nome. La cattura mostra un indirizzo nel campo. Il controllo esistente accetta anche indirizzi IPv4 privati, come si vede in `packages/connectors/src/private-hosts.ts:124`.
- Modifica: Principio 3. Sostituisci l’intera etichetta con «Server (nome DNS o indirizzo IPv4 privato)». Conserva la validazione della connessione e i valori già configurati.
- Fatto quando: Il campo nomina entrambe le forme accettate e la compilazione con un indirizzo privato di prova resta possibile.
- Test: Riusa la query basata su `fields.host` nel flusso NetSuite in `apps/desktop/test/feeds.test.tsx:268`.
- Dipende da: niente
- Rischio: nessuno

### UX-27 · Porta la scelta delle commesse accanto ai codici

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.37.58.png`, `Screenshot 2026-11-17 alle 15.38.07.png`
- Dove: `apps/desktop/src/renderer/FeedSection.tsx:242` (renderer dei campi) e `apps/desktop/src/renderer/FeedSection.tsx:306` (ricerca e risultati). Riuso di `feedChoicesCodes` e `feedChoicesCodesTitle` in `apps/desktop/src/renderer/messages.ts:1751`.
- Problema: Dopo la ricerca NetSuite il pannello dei risultati si inserisce prima del campo email e allontana i codici che il clic modifica.
- Modifica: Principi 1 e 3. Nel solo ramo `dwsi` rendi il campo `ownerEmail` prima di ricerca e risultati. Rendilo una sola volta, escludendolo dal successivo blocco `scope`, che continua con `projectCodes` e `since`. Ottieni i campi filtrando la definizione esistente e riusa il medesimo `FieldInput`. Lascia la ricerca e le scelte negli altri connettori come sono.
- Fatto quando: In NetSuite il pannello segue email e Cerca le tue commesse ed è subito sopra i codici. La scelta aggiunge il codice una sola volta. La ricerca continua a usare l’identità prevista dal collegamento.
- Test: Mantieni il salvataggio NetSuite in `apps/desktop/test/feeds.test.tsx:268`. Aggiungi nello stesso file una risposta sintetica di `feedChoices`, verifica l’ordine dei controlli e controlla che il codice scelto compaia una sola volta.
- Dipende da: niente
- Rischio: Se il campo email viene renderizzato due volte, i due controlli risultano duplicati. Verifica l’unicità per nome accessibile.

### Oggi e Deliverable

### UX-28 · Rendi la fonte del rischio un comando breve e leggibile

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.36.58.png`
- Dove: `apps/desktop/src/renderer/RiskRegister.tsx:210` (`Source`), `apps/desktop/src/renderer/messages.ts:445` (`risks.source`), `apps/desktop/src/renderer/styles.css:3139` (`.today .today-judgement`).
- Problema: Nelle proposte, la scritta Fonte e il pulsante con il percorso occupano due righe distinte. Il percorso centrato allontana la citazione e richiede di leggere dettagli tecnici prima dell’estratto.
- Modifica: Principi 3 e 7. Nel riquadro `Source` sostituisci la dicitura separata e il percorso a vista con un pulsante «Apri la fonte», usando la chiave `risks.source` dopo averne verificato gli usi. Mantieni `title={source.path}` sul pulsante e passa lo stesso percorso a `onOpen`. Avvolgi estratto e badge in elementi distinti e applica al solo pulsante `align-self: flex-start`. Mantieni il testo della citazione e l’esito del controllo.
- Fatto quando: Il comando è allineato a sinistra e l’estratto si legge subito sotto. Con più rischi, il pulsante di ogni riquadro apre il proprio file.
- Test: Aggiorna la query sul percorso in `apps/desktop/test/today.test.tsx:1565` cercando il comando nel riquadro del rischio. Mantieni il controllo del percorso passato all’API.
- Dipende da: niente
- Rischio: Verifica che la funzione riusata per proposte e rischi accettati mostri ancora l’esito della fonte in entrambi i casi.

### UX-29 · Trasforma la sintassi delle domande in un aiuto di campo

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.40.39.png`
- Dove: `apps/desktop/src/renderer/DeliverablesView.tsx:796` (`textarea` delle domande), `apps/desktop/src/renderer/messages.ts:1621` (`ownKindQuestions` e nuova `ownKindQuestionsHint`).
- Problema: Il titolo del campo incorpora sia l’istruzione sulle righe sia il simbolo per l’obbligatorietà. Il formato operativo si perde nella frase.
- Modifica: Principio 3. Rinominare il campo in «Domande da fare prima della bozza». Estrai la parte operativa dal titolo e usa come aiuto, associato con `aria-describedby`, «Scrivi una domanda per riga. Aggiungi * alla fine delle domande obbligatorie.» Riusa `.hint` e lascia invariato il formato delle righe passato al salvataggio.
- Fatto quando: Il titolo è breve. L’aiuto è leggibile sotto il campo e viene annunciato quando lo si raggiunge. Salvando domande con e senza asterisco si mantengono i rispettivi comportamenti.
- Test: In `apps/desktop/test/deliverables.test.tsx:368` aggiungi un controllo sul nome e sulla descrizione del campo. Conserva la prova di creazione del tipo.
- Dipende da: niente
- Rischio: nessuno

### Cruscotto e Ore

### UX-30 · Avvicina ogni fase allo stato del tracker

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.40.27.png`
- Dove: `apps/desktop/src/renderer/styles.css:1649` (`.settings-form .phase-row span`), origine in `apps/desktop/src/renderer/DashboardSettingsForm.tsx:150`. Riuso di `dashboard.phasesTitle` e `dashboard.phasesHint`.
- Problema: Per passare dal nome dello stato alla fase bisogna seguire ogni riga fino al margine destro di un riquadro largo. Tutti i menu hanno lo stesso aspetto e la riga è facile da perdere.
- Modifica: Principi 4 e 7. Limita il solo fieldset in questione con una classe `phase-mapping` e usa per `.settings-form .phase-mapping .phase-row` `display: grid; grid-template-columns: minmax(0, 1fr) minmax(9rem, max-content); gap: 12px; max-width: 32rem; align-items: center`. Sostituisci la regola `flex: 1` sullo span con `min-width: 0; overflow-wrap: anywhere`. Conserva il nome accessibile del menu.
- Fatto quando: I menu partono tutti allo stesso bordo e restano vicini agli stati. Uno stato molto lungo va a capo. Cambiare una fase modifica solo lo stato selezionato.
- Test: Verifica la modifica delle fasi in `apps/desktop/test/dashboard.test.tsx:530`. Nessun testo o ruolo da aggiornare.
- Dipende da: niente
- Rischio: Misura le voci più lunghe del menu e lo stato con nome più lungo a finestra stretta.

### UX-31 · Spiega la data limite del confronto Ore

- Priorità: Media
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.40.02.png`, `Screenshot 2026-11-17 alle 15.40.06.png`
- Dove: `apps/desktop/src/renderer/HoursView.tsx:560` (helper `field` e chiamata alla riga 622), `apps/desktop/src/renderer/messages.ts:1274` (`hours.cutoff` e nuova `hours.cutoffHint`).
- Problema: «Ultimo giorno completo» è seguito da una parentesi lunga. Un campo vuoto sembra indicare un giorno mancante, mentre significa che la data non limita il confronto.
- Modifica: Principi 3 e 8. Chiamalo «Confronta fino al». Estrai l’attuale istruzione dal titolo e usa «Le ore dei giorni successivi restano fuori dal confronto. Lascia vuoto per usare tutto il periodo scelto.» come aiuto `.hint` associato con `aria-describedby`. Passa dal helper un aiuto facoltativo e assegna un id stabile distinto al testo. Conserva il valore vuoto e il `type="date"`.
- Fatto quando: Si capisce che il campo limita la data finale e che è facoltativo. Impostare o svuotare la data produce lo stesso confronto previsto per i due casi.
- Test: In `apps/desktop/test/hours.test.tsx:267` verifica l’editor e cerca le eventuali query con la chiave aggiornata. Aggiungi il controllo della descrizione del campo nello stesso test di configurazione.
- Dipende da: niente
- Rischio: nessuno

### Previsionale

### UX-32 · Distingui il formato del mese da un mese già impostato

- Priorità: Alta
- Taglia: P
- Screenshot: `Screenshot 2026-11-17 alle 15.39.48.png`
- Dove: `apps/desktop/src/renderer/ForecastView.tsx:588` (campo `startMonth`), `apps/desktop/src/renderer/messages.ts:1067` (`forecast.columnStartMonth` e nuova `forecast.startMonthFormat`).
- Problema: Il mese grigio nelle celle sembra un valore proposto dalla lettura degli ordini. È un esempio fisso del placeholder, quindi una cella che sembra compilata può essere vuota.
- Modifica: Principi 3 e 8. Sostituisci `forecast.columnStartMonth` con «Mese di inizio (AAAA-MM)» e il placeholder fisso con `forecast.startMonthFormat`, «AAAA-MM». Il valore trovato da NetSuite continua a essere mostrato nel campo come valore vero ed è modificabile.
- Fatto quando: Una cella vuota mostra solo AAAA-MM. Un mese letto è visualizzato come valore e si può correggere o lasciare vuoto secondo il flusso esistente.
- Test: Verifica la query sul mese trovato in `apps/desktop/test/forecast.test.tsx:693` e aggiungi un caso col valore vuoto. Il test deve distinguere value e placeholder.
- Dipende da: niente
- Rischio: nessuno

### UX-33 · Richiudi le tariffe finché non servono

- Priorità: Media
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 15.39.48.png`, `Screenshot 2026-11-17 alle 15.39.52.png`, `Screenshot 2026-11-17 alle 15.39.56.png`
- Dove: `apps/desktop/src/renderer/ForecastView.tsx:626` (ramo `byTheDay`, validazione alla riga 463), `apps/desktop/src/renderer/styles.css:1881` (`details.advanced > summary`). Riuso di `forecast.rates` e `forecast.ratesHint` in `messages.ts`.
- Problema: Le tariffe giornaliere aprono subito un editor lungo. Se il PM vuole solo modificare una commessa o un costo orario, deve scorrere anche il blocco delle tariffe.
- Modifica: Principi 1 e 5. Nel ramo `byTheDay`, sostituisci il titolo con `summary` che usa `text.rates`, dentro un `details.advanced` chiuso all’ingresso. Metti al suo interno descrizione, RowsField e FieldProblems già presenti. Usa un contenitore `display: flex; flex-direction: column; gap: 8px`. Quando `submit` trova problemi in `found.rates`, apri quel `details` tramite un ref prima di mostrare gli errori. Mantieni l’editor montato, così un’apertura o chiusura lascia al suo posto il draft.
- Fatto quando: Con il blocco chiuso i campi esterni e orari sono più vicini. Aprendolo si possono filtrare e modificare tutte le tariffe. Un tentativo di salvataggio con una tariffa errata apre il blocco e mostra il messaggio esistente.
- Test: Aggiorna `apps/desktop/test/forecast.test.tsx:452` per aprire il blocco prima di cercare il gruppo. Verifica che un progetto senza commesse a giornate continui a seguire il ramo già testato alla riga 488.
- Dipende da: niente
- Rischio: Un errore nascosto renderebbe il salvataggio indecifrabile. Verifica anche che la lista non perda i dati digitati se viene richiusa.

### Avanzamento e Allineamento

### UX-34 · Indica la cella che riceverà il dato della richiesta

- Priorità: Alta
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 15.39.17.png`, `Screenshot 2026-11-17 alle 15.39.21.png`
- Dove: `apps/desktop/src/renderer/ProgressSetup.tsx:145` (selezione e stato), `apps/desktop/src/renderer/ProgressSetup.tsx:216` (editor e inserimento), `apps/desktop/src/renderer/RowsField.tsx:142` (rimozione), `apps/desktop/src/renderer/messages.ts:921` (`progress.setup.insert` e nuova `progress.setup.insertInto`).
- Problema: I pulsanti dicono che agiscono sulla riga selezionata, ma non mostrano quale sia. Il codice parte dalla prima riga e ripiega sull’ultima se l’indice supera il numero di righe. Dopo una rimozione l’indice può puntare a una cella diversa.
- Modifica: Principi 2, 3 e 8. Parti con `activeCell` nullo, aggiornalo con `onFocusRow` e azzeralo al cambio delle impostazioni. Estendi RowsField con `onRemoveRow?` per notificare l’indice rimosso. In ProgressSetup azzera la selezione alla rimozione della riga attiva e riduci l’indice di uno se è stata rimossa una riga precedente. Attiva i pulsanti solo quando la riga scelta esiste e il suo riferimento, ripulito, corrisponde a `CELL`. Sostituisci l’attuale frase con «Scegli una riga con una cella valida per inserire un dato.» se il riferimento manca, oppure con «Inserisci nella cella [riferimento]» usando `progress.setup.insertInto(ref)`. La pressione accoda alla riga indicata, senza ripiego su altre righe.
- Fatto quando: I pulsanti sono disattivati all’apertura e la destinazione è esplicita dopo aver scelto una riga. Togliere la riga attiva disattiva i pulsanti. Togliere una riga precedente conserva la destinazione.
- Test: Estendi `apps/desktop/test/progress.test.tsx:349` ai due casi di rimozione e verifica il riferimento. Mantieni le asserzioni di rimozione e filtro di RowsField in `apps/desktop/test/tables.test.tsx`.
- Dipende da: niente
- Rischio: Controlla che filtro e aggiunta della riga vuota non facciano scrivere in una cella diversa. Il pulsante deve continuare ad accodare il token esistente.

### UX-35 · Fai andare a capo gli stati equivalenti mentre si scrivono

- Priorità: Media
- Taglia: M
- Screenshot: `Screenshot 2026-11-17 alle 15.39.37.png`
- Dove: `apps/desktop/src/renderer/AlignmentView.tsx:38` (`GROUP_COLUMNS`), `apps/desktop/src/renderer/RowsField.tsx:5` (`RowsColumn.kind`) e `apps/desktop/src/renderer/RowsField.tsx:129` (rendering dei campi), `apps/desktop/src/renderer/styles.css:1724` (`.rows`) e `apps/desktop/src/renderer/styles.css:1967` (larghezza dei campi nella griglia).
- Problema: Nella colonna centrale le liste separate da virgole scompaiono oltre il bordo del campo. Prima di salvare è difficile verificare tutti gli stati associati.
- Modifica: Principi 4 e 5. Aggiungi `textarea` ai tipi di RowsColumn e rendi un controllo con `rows={2}` per tale tipo, conservando `aria-label`, valore, focus, cambio riga e rimozione esistenti. Applicalo solo a `item` e `ticket` di `GROUP_COLUMNS`. Dal CSS comune riusa la misura dei campi con `.rows textarea { width: 100%; min-width: 0; resize: vertical; }`. Imposta `160px` per il nome del gruppo e `minmax(160px, 1fr)` per ciascuna lista, così il contenitore continua a scorrere localmente su finestre strette. Conserva la separazione con virgole e il parser attuale.
- Fatto quando: I campi delle due liste mostrano più di una riga e il testo va a capo mentre si digita. Aggiunta e rimozione conservano nome e stati della riga giusta. I valori salvati continuano a essere liste separate da virgole nella UI.
- Test: Verifica campi, validazione e salvataggio in `apps/desktop/test/alignment.test.tsx:273`. Se un test tipizza il controllo come HTMLInputElement, adattalo a HTMLTextAreaElement. Mantieni il test base di RowsField in `apps/desktop/test/tables.test.tsx`.
- Dipende da: niente
- Rischio: L’altezza delle righe aumenta. Verifica che le intestazioni restino a vista e che le liste lunghe si leggano senza scorrimento orizzontale del campo.

### Lotti per l’integrazione

1. **Moduli condivisi** · UX-24, UX-25. Apri le liste complete con tastiera e mouse e salva una modifica. Verifica che la lettura delle fonti e l’anteprima della posta dichiarino e usino le rispettive configurazioni.
2. **Accesso e perimetro** · UX-26, UX-27. Apri NetSuite, riconosci il formato del server e aggiungi un codice di prova dai risultati. Ripeti una consultazione su un altro connettore.
3. **Istruzioni e associazioni** · UX-28, UX-29, UX-30, UX-31. Apri una fonte di rischio, crea un tipo con una domanda obbligatoria, cambia una fase e prova il confronto Ore con e senza data limite.
4. **Configurazioni lunghe** · UX-32, UX-33, UX-34, UX-35. Distingui il mese proposto dal campo vuoto, provoca un errore in una tariffa, inserisci un dato del modulo dopo aver rimosso una riga e salva le equivalenze con più stati.

### Scelte del proprietario

- **Apertura delle tariffe** · Aprire sempre il blocco oppure aprirlo a richiesta. Raccomando a richiesta, come in UX-33, perché le tariffe già scritte restano salvate e chi entra per altri campi le supera senza scorrere. La modalità sempre aperta è preferibile se la tariffazione è l’uso prevalente del pannello.
- **Valori proposti** · Mantenere le proposte fondate sul singolo file trovato o sui dati letti, oppure scegliere a priori codici, mesi e soglie comuni. Raccomando di mantenere le proposte già motivate dai dati. I campi senza dato devono dichiarare formato ed effetto del vuoto, come in UX-31 e UX-32.

### Non toccare nei pannelli

- La ricerca dei progetti, degli spazi e delle commesse già disponibile nei connettori, come in `Screenshot 2026-11-17 alle 15.38.07.png`. Preserva l’aggiunta esplicita dei codici e i controlli delle credenziali.
- Il filtro per riga e la somma di controllo delle posizioni in Avanzamento, visibili in `Screenshot 2026-11-17 alle 15.39.17.png` e `Screenshot 2026-11-17 alle 15.39.24.png`.
- Le funzioni che riusano file già letti quando il percorso è vuoto, visibili in `Screenshot 2026-11-17 alle 15.39.37.png`. Il campo vuoto conserva il suo significato.
