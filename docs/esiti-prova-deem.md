# Esiti della prova da zero (R6c)

Prova del 18/11/2026 sul primo dei due progetti reali, con la build 0.10.0 del ramo `feat/r6b-ripartenza` e il copione `ripartenza-da-zero.md`. Restano da provare gli altri deliverable e il secondo progetto: i rilievi che verranno si aggiungono in fondo e si mettono in coda.

Questo documento è il passaggio di consegne: i rilievi, la causa trovata o ciò che resta da riprodurre, la scelta presa dal PM, l'incremento che li chiude. Nessun nome, sigla o testo dei clienti.

## Regole

- Ramo nuovo `feat/r6c-esiti-prova`, creato da `feat/r6b-ripartenza`. Commit a ogni incremento, con test e demo come da `CLAUDE.md`. Niente subagenti.
- Niente push, pull request, tag, cambi di versione o rilasci. La cronologia di git non si riscrive.
- Nel repository non entra nessun dato dei clienti. Le cartelle reali sono in sola lettura: le prove si fanno su una copia in una cartella temporanea, contando e cronometrando, senza riportare contenuti. `secrets.json` non si apre.
- Tetti: 50.000 righe in tutto, 20.000 in `apps/desktop/src`. Ultima misura 43.732 / 17.468, presa prima delle ultime quattro correzioni di R6b: **il vincolo vero è il tetto dell'interfaccia**, circa 2.500 righe di margine. Si rimisura a ogni incremento con il comando di «Tetto del codice» in `roadmap.md`.
- Ordine deciso dal PM: tutto di fila, da I1 a I6, una build sola alla fine.

## Rilievi

Stato: tutti **aperti**.

| N. | Dove | Rilievo | Incremento |
|---|---|---|---|
| 1 | Ovunque | Le fonti sono markdown: vanno viste in un lettore dentro Octo, già alla riga citata | I5 |
| 2 | Ovunque | Il logo va sostituito con quello del progetto precedente | I5 |
| 3 | Riunioni | Le sigle sentite male nelle trascrizioni non vengono riportate alla forma giusta | I5 |
| 4 | Ovunque | Cambiando sezione le richieste a Claude sembrano interrompersi (visto in «Commessa» e in «Deliverable») | I1 |
| 5 | Tabelle | Le colonne devono essere ridimensionabili | I5 |
| 6 | Oggi | Quando una voce entra in «Adesso» arriva la notifica? | I2 |
| 7 | Oggi, «Il punto» | Troppo rumore: attività non del PM, e riunioni agganciate al progetto sbagliato | I2 |
| 8 | Oggi, «Adesso» | Il clic su una voce non fa nulla | I1 |
| 9 | Oggi, «Adesso» | «Perché contano oggi» è già tutto aperto al caricamento | I1 |
| 10 | Oggi, «Criticità della settimana» | Impaginato male | I2 |
| 11 | Oggi, «Da fare oggi» | Le riunioni fanno rumore: vanno agganciate al progetto in automatico, insieme a Verbale | I2 |
| 12 | Oggi, «Da tenere d'occhio» | Troppo rumore: solo ciò che tocca al PM | I2 |
| 13 | Oggi, «Valutazione di Claude» | Troppa prosa: poche parole | I2 |
| 14 | Chiedi | «Con calcoli» non si capisce e sembra messo a caso | I4 |
| 15 | Chiedi | Non si possono allegare file | I4 |
| 16 | Deliverable, email | La mail dà del lei a una persona a cui il PM dà del tu | I3 |
| 17 | Deliverable | La rilettura critica è prolissa | I3 |
| 18 | Deliverable | Su ogni rilievo della rilettura si deve poter rigenerare solo quel passo, dicendo che cosa cambiare | I3 |
| 19 | Deliverable | Il campo di correzione generale deve restare, precompilato con una proposta | I3 |
| 20 | Deliverable, stima | Lentissima; spostandosi in un'altra sezione si è interrotta | I1 |
| 21 | Commessa, «Sintesi» | Non si carica mai | I1 |
| 22 | Commessa, «Fatturazione» | Non si carica mai | I1 |
| 23 | Commessa, «Previsionale» | «Calcolo e dettagli» aperto occupa troppo spazio ed è impaginato male | I5 |
| 24 | Commessa, «Previsionale» | «Dati che mancano» è impaginato male | I5 |

## I1 — Guasti che bloccano la prova

**Richieste perse cambiando sezione (4, 20).** Causa trovata: `apps/desktop/src/renderer/App.tsx` (il blocco che sceglie la vista in base a `tab`) monta una sola vista per volta. Uscendo, la vista si smonta e il suo stato va perso; in `apps/desktop/src/main/ipc.ts` la richiesta continua, perché nessun `abort` parte al cambio di sezione, ma la risposta non ha più chi la riceve. Correzione: le viste già aperte del progetto restano montate e nascoste, con una prop `active` per rileggere i dati al rientro; nella colonna di sinistra (`SectionNav.tsx`) un segno dice in quale sezione Claude sta lavorando. Cambiare progetto smonta, come oggi.

**«Sintesi» e «Fatturazione» (21, 22).** Tutte e due leggono `projectSheets` (`ProjectSheetView.tsx` → `packages/application/src/project-sheet.ts`, `list`). Ipotesi: in un progetto da zero ogni mese dall'inizio è «non letto» e `readings.readMissing` li chiede tutti al sistema dell'azienda, senza avanzamento a schermo; uscendo dalla sezione il risultato va perso per il guasto qui sopra. **Da riprodurre con i tempi** su una copia del progetto in una cartella temporanea: può essere anche un errore non mostrato, o un codice commessa senza mese di inizio. Poi: avanzamento mese per mese nella vista, lettura che riprende da dove era arrivata, errore detto.

**«Adesso» (8, 9).** `TodayView.tsx`: il clic su una riga (`SignalRow` → `select`) seleziona la voce, ma il dettaglio non compare in vista. Da riprodurre; il dettaglio va mostrato accanto o sotto la voce scelta. «Perché contano oggi» si apre a richiesta.

**Stime lente (20).** Misurare dove va il tempo (lettura delle fonti, scrittura, rilettura critica) su dati sintetici grandi. Avanzamento a fasi visibile; la rilettura critica non trattiene la bozza.

Verifica: demo con una richiesta lunga (Claude finto con ritardo), cambio di sezione e risposta ritrovata al rientro; «Sintesi» che mostra l'avanzamento e arriva in fondo su dati sintetici con dodici mesi non letti; e2e del clic in «Adesso».

**Esito di I1 (18/11/2026): codice chiuso, criterio da verificare** (R6c.1-R6c.4 in `verifiche-da-fare.md`). Demo `demo/68-richieste-che-restano`, `pnpm e2e:esiti`.
- *Richieste perse*: «Oggi», «Chiedi», «Deliverable», «Cruscotto» e «Commessa» restano montate e nascoste dopo la prima apertura, finché il progetto è lo stesso; al rientro rileggono i dati senza perdere ciò che mostrano. «Impostazioni» riparte ogni volta. Accanto alla sezione in cui Claude lavora c'è una rotella.
- *«Sintesi» e «Fatturazione»*: riprodotto solo in parte. Su una copia delle sole impostazioni del progetto reale (contando, senza contenuti): sei codici, tutti con il mese di inizio, il più vecchio dodici mesi prima; con lo stato vuoto Octo chiedeva quindi dodici mesi di timesheet in una sola lettura, senza dire nulla, dopo aver chiesto ordini e fatture; uscendo dalla sezione il risultato andava perso. **I tempi veri non sono misurati**: la lettura passa dalla credenziale di NetSuite, che non ho aperto (R6c.2). Non è un codice senza mese di inizio, e non ho trovato un errore taciuto diverso dal fallimento della lettura, che ora è detto. Correzione: un mese alla volta, ognuno tenuto appena letto; la pagina dice il mese e il conto; chi arriva mentre una lettura è in corso vede gli stessi passi; se si ferma la pagina dice perché e «Riprendi la lettura» chiede solo ciò che manca. Sui dati sintetici (dodici mesi, NetSuite finto lento) arriva in fondo.
- *«Adesso»*: riprodotto. Il clic sceglieva la voce, ma il dettaglio compariva nel riquadro accanto a «Da fare oggi», più in basso e fuori vista. Ora si apre sotto la voce; «Perché contano oggi» è chiuso all'apertura.
- *Stime lente*: non misurabili con Claude finto. Ora la riga di attesa dice la fase, la bozza si mostra appena le fonti sono controllate e la rilettura critica continua da sola; accanto ai tempi resta scritto dove è andato l'ultimo giro (R6c.4). La parte del codice, il controllo delle fonti, non era il collo di bottiglia nei test.

## I2 — «Oggi» senza rumore

**Solo ciò che tocca al PM (7, 12).** «Il punto» e «Da tenere d'occhio» tengono le voci rivolte o assegnate al PM, con una regola di Octo (`ownPeopleKeys`, indirizzi del PM). Il resto esce, o sta in una riga di conteggio che si apre.

**Riunioni agganciate al progetto (7, 11).** Scelta del PM: regola, e Claude solo dove serve, con un modello piccolo.
- Regola: una riunione è del progetto se fra i partecipanti c'è una persona del progetto, o una parola chiave nel titolo.
- Le dubbie: giudizio di Claude con il modello piccolo (`claude-haiku-5-5`), con la frase su cui si fonda.
- Ciò che resta dubbio sta in un elenco «Da assegnare» e non entra in «Oggi».
- Vale per il calendario e per i verbali che entrano da soli da Verbale.

**Impaginazione (10, 13).** «Criticità della settimana» (`TodayWeek.tsx`) nello stile delle altre liste. La valutazione di Claude in tre righe al massimo, con l'istruzione nel prompt e il limite nello schema; il resto dietro «Dettagli».

**Notifica (6).** È costruita: `App.tsx` la mostra quando una voce entra in «Adesso», `main.ts` la decide (`firstEntered`), e si accende progetto per progetto con «Avvisami con una notifica del sistema…». Da verificare sulla build non firmata: permesso di macOS e opzione accesa. Se l'opzione nasce spenta, l'avvio del progetto lo deve dire. Voce in `verifiche-da-fare.md`.

## I3 — Deliverable

**Tu o lei (16).** Scelta del PM: chi scrive segue il registro delle mail già mandate a quella persona; senza mail usa il lei; sulla persona del progetto un campo «tu / lei» lo fissa a mano. Tocca `packages/domain/src/team/model.ts`, `TeamSection.tsx`, `packages/infrastructure/src/claude/deliverable-writer.ts` e `apps/desktop/resources/catalogo/email-cliente/istruzioni.md`, dove oggi il registro formale è scritto fisso.

**Rilettura critica (17, 18, 19).** Rilievi di una frase, con il limite nello schema. Su ogni rilievo «Correggi questo», con un campo per dire che cosa cambiare: rigenera solo quel passo della bozza. Il campo generale resta, precompilato con una richiesta costruita dai rilievi.

## I4 — Chiedi

**«Con calcoli» (14).** Spiegato accanto all'opzione con `InfoTip` (che cosa fa, quando serve) e spostato vicino al pulsante di invio. Il comportamento non cambia.

**File nella chat (15).** «Allega» copia il file nella cartella della conversazione, dentro `_octo/.lavori/`, e lo passa a chi risponde con i lettori di documenti che Octo ha già. Un formato che Octo non legge è rifiutato con il motivo.

## I5 — Trasversali

**Lettore delle fonti (1).** Aprendo una citazione o una fonte markdown, un pannello di Octo mostra il file impaginato e posizionato sulla riga citata, evidenziata (`CitationPanel.tsx`, `openEvidence` in `ipc.ts`). «Apri con il sistema» resta. Nessuna libreria nuova se basta ciò che `AnswerView.tsx` usa già.

**Colonne (5).** In `DataTable.tsx`: maniglia sull'intestazione, larghezze ricordate per tabella. Le tabelle scritte a mano (`ProjectSheetSummary`, `ProjectSheetBilling`, `ForecastMonth`) passano da `DataTable` dove costa poco.

**Sigle (3).** Glossario del progetto in `_octo/.impostazioni/glossario.json` (forma sentita → forma giusta), applicato alle trascrizioni all'ingresso e dato a chi scrive. Claude propone le coppie candidate, il PM approva. Una sezione piccola nelle impostazioni.

**Logo (2).** Confermato dal PM il 18/11/2026: è il PNG del polpo del progetto `octobrief` (fuori dal repository, in `apps/studio/public/octobrief.png`, usato dal componente `Brand`). Va copiato nelle risorse di Octo; sostituisce `Logo.tsx` e l'icona dell'app.

**Previsionale (23, 24).** «Calcolo e dettagli» compatto, non a tutta larghezza; «Dati che mancano» come elenco ordinato (`ForecastMonth.tsx`, `ForecastView.tsx`, `FieldProblems.tsx`).

## I6 — Chiusura

- `pnpm typecheck && pnpm lint && pnpm test:coverage`, `pnpm e2e` e gli e2e delle sezioni toccate.
- Misura delle righe, scritta in «Stato» di `roadmap.md`.
- Build per Mac arm64 come quella di R6b.
- `ripartenza-da-zero.md` aggiornato dove i gesti cambiano; lo stato di ogni rilievo scritto qui; ciò che solo il PM può dire chiuso va in `verifiche-da-fare.md`.

## Che cosa non si fa

- La posta su Windows: ferma in attesa della risposta dell'IT (`richiesta-it-posta.md`).
- Nessun riporto di dati reali nel repository.
