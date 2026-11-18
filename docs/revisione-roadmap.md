# Revisione della roadmap (18/11/2026)

Analisi di sola lettura del codice, della documentazione, del vault della Suite v0 e del progetto pilota, più una prova eseguita del recinto. Non modifica `docs/roadmap.md`: è la proposta da approvare.

Come leggere le prove:
- **verificato**: l'ho controllato io, con `path:riga` o con il comando.
- **inventario**: rilevato da un subagente di sola lettura, con il riferimento che ha dato; non l'ho ricontrollato riga per riga.
- **deduzione**: conclusione mia, non una misura.

Nessun nome, cifra o testo del cliente è riportato: del vault e della cartella di progetto ci sono solo conclusioni generali e ordini di grandezza.

---

## 1. Conclusioni e roadmap proposta

### Conclusioni

1. **Il vincolo è l'interfaccia, non il totale.** Il codice è a 46.878 righe su 50.000 e l'interfaccia a 19.700 su 20.000: restano 300 righe di interfaccia. Il lavoro previsto non entra se prima non esce qualcosa (verificato, §3.1).
2. **Nessun criterio di uscita è verificato per intero.** Di F1 è fatta la metà sul Mac; F2, F3, F4, F5, T1 e T2 sono da verificare, e niente è mai girato sul PC Windows del pilota. Le prove sui dati reali sono tutte sul Mac del PM (inventario, §4).
3. **Le ipotesi della sessione precedente reggono, con due correzioni** (§2). L'accorpamento delle sezioni economiche era già stato valutato e sconsigliato; la debolezza sulla posta viene dalla lettura, non dalla mancanza di una sintesi.
4. **Il recinto funziona sul Mac, ma solo con la sandbox di Claude Code.** Con le sole regole sugli strumenti, un `python3` autorizzato scrive fuori dal progetto e raggiunge la rete. Con la sandbox attiva il progetto resta di sola lettura e Claude calcola e scrive solo nella cartella di lavoro (verificato, §6). Su Windows nativo quella sandbox non esiste.
5. **Octo copre bene il «tenere sotto controllo» e il «rispondere»; copre poco il «produrre con calcoli».** Delle 29 attività reali del vault, 9 sono coperte, 13 in parte, 5 scoperte e 2 fuori scopo. Quasi tutte quelle scoperte o parziali chiedono calcolo, file su modello o memoria curata (§5).
6. **La parte economica va ridotta, non ampliata** (decisione del PM del 18/11, §10). Le schede progetto fanno già la gestione e migreranno su un altro applicativo: in Octo resta una vista di riepilogo che assorbe Ore e Previsionale, l'esportazione del previsionale in Excel e la copia dei dati per un report. Budget, mesi, piano di fatturazione e anagrafica escono.

### Roadmap proposta

Totali di partenza: **46.878** righe in tutto, **19.700** di interfaccia (verificato, comando di `docs/roadmap.md:51`). Le righe in entrata e in uscita sono stime mie (deduzione), tranne dove indico i file misurati.

| # | Incremento | Scopo | Entrano | Escono | Totale dopo | Interfaccia dopo |
|---|---|---|---|---|---|---|
| R0 | Fissare che cosa resta | committare il lavoro delle demo 57-59 così com'è, per non perderlo; togliere le cifre reali da `docs/verifica-deem-petrolvalves.md`; nessun codice nuovo | 0 | 0 | 46.878 | 19.700 |
| R1 | Economia a riepilogo | «Commessa» diventa il riepilogo e assorbe Ore e Previsionale; escono budget, mesi, piano di fatturazione, anagrafica; l'avanzamento si legge da NetSuite | 230 | 1.775 | 45.333 | 18.610 |
| R2 | Verifica di T0 su ciò che resta | chiudere i criteri di F1-F4 sul Mac e la prima sessione con il pilota; riunioni assegnate da sole quando è certo; per il resto solo correzioni | 420 | 0 | 45.753 | 18.780 |
| R3 | Recinto sul Mac | Claude calcola e scrive nella cartella di lavoro, con un interprete incluso nell'app; tabella con fonte in Chiedi | 1.200 | 0 | 46.953 | 19.180 |
| R4 | Deliverable del progetto con script e modello | F5; Avanzamento e Allineamento escono dal codice e tornano come deliverable del progetto | 1.400 | 3.090 | 45.263 | 17.560 |
| R4b | Catalogo in file | i dieci tipi del catalogo diventano cartelle distribuite con l'app, correggibili a parole | 150 | 500 | 44.913 | 17.560 |
| R5 | Memoria: pagine scritte da Claude | pagine curate in `_octo/progetto/`, approvate dal PM, lette per prime da Chiedi | 400 | 0 | 45.313 | 17.660 |
| R6 | Windows: WSL2 e posta | recinto dentro WSL2 sul PC del pilota; lettore della posta su Windows | 900 | 0 | 46.213 | 17.860 |
| R7 | Ciò che resta di T1 e T2 | due persone su SharePoint; server del distillato (programma a parte, fuori dal conto) | da stimare | — | — | — |

Il picco è dopo R3 (46.953 in tutto, 19.180 di interfaccia): sta sotto i due tetti solo perché R1 viene prima. Per questo l'ordine non è scambiabile.

Dettaglio di ogni incremento:

**R0. Fissare che cosa resta.**
- Criterio di uscita: `git status` pulito sul ramo; questa proposta approvata e riportata in `docs/roadmap.md`; in `docs/verifica-deem-petrolvalves.md` importi e conteggi sostituiti da ordini di grandezza e i nomi di riunioni e temi da descrizioni generiche (ciò che è già nella cronologia di git resta).
- Dipendenze: nessuna. Rischio: basso.

**R1. Economia a riepilogo.**
- Scopo: in Octo serve avere la situazione sotto controllo e rispondere alle domande, non gestire i dati della commessa.
- Che cosa resta: sintesi della commessa da NetSuite (ordinato, fatturato, riconosciuto, costi, margine), riconciliazione delle ore come scheda, previsionale del mese con esportazione in Excel, copia dei dati per un report.
- Che cosa esce (misurato): `ProjectSheetPlan.tsx` 584, la parte di piano di `ProjectSheetBilling.tsx` (circa 190 su 291), circa 130 righe di testi, circa 300 righe fra `HoursView.tsx`, `ForecastView.tsx` e navigazione nel passaggio a schede; fuori dall'interfaccia `economics/plan.ts` (circa 450 su 542, il resto serve al previsionale), lo store `sheet-plan.json` e l'esportazione «Dati».
- Dati del PM: `_octo/.impostazioni/sheet-plan.json` (budget, mesi, tappe di fatturazione, avanzamento dichiarato, anagrafica) non si migra; prima della rimozione si esporta una volta in un file leggibile. `forecast.json` e `hours.json` restano.
- Criterio di uscita: sui due progetti reali le cifre del riepilogo coincidono con NetSuite per ogni commessa; il previsionale di un mese vero esce in Excel; interfaccia sotto 18.700 righe.
- Avanzamento: non si scrive più in Octo e non si legge dalla scheda progetto. Viene da NetSuite, in quest'ordine: (1) l'avanzamento della vista `dw_prod_projectpercentcomplete`, già dichiarata nei connettori (verificato, `packages/connectors/src/dwsi/views.ts:256-267`), con la data del dato; (2) altrimenti ricavi riconosciuti su ordinato (`amountrecognized`, `views.ts:249`); (3) altrimenti costi a oggi su costi totali, mostrato come stima calcolata. La pagina dice sempre quale delle tre fonti ha usato. Stima: 80 righe fuori dall'interfaccia.
- Perché così: Octo resta indipendente dalla scheda e dal suo formato, che cambierà con la migrazione; il ricavo mostrato coincide con NetSuite per costruzione. Si perde la correzione dell'avanzamento dentro Octo: si corregge nella scheda e Octo lo vede alla lettura successiva.
- Criterio di uscita aggiuntivo: sul NetSuite vero la vista dell'avanzamento è popolata per le commesse a corpo dei due progetti e se ne conosce la frequenza di aggiornamento; se è vuota, vale il passo (2) e lo si scrive.
- Dipendenze: R0. Rischio: medio. `forecast.ts:262-263` legge il piano con `settingsWithPlans`: va sciolto questo legame.

**R2. Verifica di T0 su ciò che resta.**
- Sul Mac: tre giorni di fila senza alimentare DEEM a mano, con la data scritta; le cinque domande di F1 ripetute ora che la posta è nella cartella; due deliverable reali inviati, con tempi e giri nel registro.
- Con il pilota: prima qualcuno prepara il PC una volta sola (WSL2 e accesso a Claude Code dentro la distribuzione); poi, a PC preparato, il pilota installa Octo, trova il seat e collega un progetto in meno di 30 minuti senza aiuto. Nella stessa sessione si rileva quale Outlook ha.
- Riunioni: una riunione entra da sola nel progetto quando tutti i partecipanti noti appartengono a quel solo progetto; negli altri casi resta la segnalazione in «Oggi». Stima 120 righe. Si misura su due settimane di riunioni vere prima di dichiarare chiuso il criterio di T1.
- Criterio di uscita: ogni riga della tabella di §4 ha un esito scritto, «raggiunto» o «fallito, con il perché».
- Dipendenze: R1 (non si verifica ciò che esce). Rischio: medio; dipende dal tempo del pilota e da chi prepara il suo PC. Oltre alle riunioni si pagano solo le correzioni.

**R3. Recinto sul Mac.**
- Scopo: analisi su misura con calcoli e verifica dei conti di un documento, che oggi Claude non può fare.
- Come: la configurazione D4 di §6 (progetto di sola lettura, cartella di lavoro scrivibile, rete negata, sandbox obbligatoria). Octo copia i risultati approvati in `_octo/`.
- Criterio di uscita: un'analisi con calcoli scelta fra quelle del vault è rifatta con le stesse cifre; la prova ostile di §6 passa come test di integrazione sul Mac; se la sandbox non parte, Octo rifiuta di eseguire invece di proseguire senza.
- Interprete: incluso nell'app da subito, con le librerie per Excel e CSV, così i risultati sono uguali per tutti e non dipendono dal computer. Costa un installatore più pesante, una cosa in più da aggiornare e firmare, e una seconda copia per Linux dentro WSL2 (R6). Stima 150 righe in più, oltre agli script di costruzione che sono fuori dal conto.
- Dipendenze: R2. Rischio: medio; il comportamento della sandbox può cambiare con gli aggiornamenti di Claude Code, quindi il test ostile va tenuto. Da provare per primo: che l'interprete incluso giri dentro la sandbox, perché la prova di §6 ha usato quello del sistema.

**R4. Deliverable del progetto con script e modello.**
- Scopo: chiudere F5 e liberare interfaccia. Lo script e il modello stanno nel progetto, il PM li corregge a parole, Claude li esegue nel recinto.
- Che cosa esce (misurato): Avanzamento, 1.267 righe di interfaccia e 564 fra dominio e caso d'uso; Allineamento, 659 di interfaccia e 515 altrove; più i gestori in `ipc.ts` e i segnali di «Oggi» che ne dipendono (circa 85).
- Dati del PM: `progress.json` (ordine, posizioni, richieste, mappa delle celle) e `alignment.json` (sprint, prefissi, gruppi di stato) diventano la configurazione dei due deliverable.
- Criterio di uscita: il modulo di una richiesta reale e l'elenco dei ticket mancanti escono come deliverable del progetto con lo stesso risultato delle sezioni; solo allora le sezioni si tolgono. La collega produce un deliverable reale.
- Dipendenze: R3. Rischio: alto; è il passo che sposta più codice e l'unico con dati del PM da convertire.

**R4b. Catalogo in file.**
- Scopo: correggere a parole anche i tipi del catalogo, senza una nuova versione di Octo. Ogni tipo diventa una cartella (istruzioni, contratto di output, modello) distribuita con l'app, come nel disegno di F4 (`docs/roadmap.md:251`).
- Che cosa esce: `domain/deliverables/catalog.ts`, 527 righe misurate, meno ciò che serve a caricare i file (stima: escono 500, entrano 150).
- Criterio di uscita: i dieci tipi producono le stesse bozze di prima sulle demo esistenti; il PM corregge l'istruzione di un tipo in meno di 5 minuti, senza codice.
- Dipendenze: R4 riuscito su un caso vero. Rischio: medio; si perde la garanzia data dai test sulle costanti, quindi serve un controllo dei file all'avvio.

**R5. Memoria: pagine scritte da Claude.**
- Scopo: il passo più piccolo verso la wiki del vault (§8).
- Criterio di uscita: cinque domande che chiedono contesto ricevono risposte che citano le pagine di memoria; il PM corregge una pagina a parole in meno di 5 minuti.
- Dipendenze: R3 (scrittura nel recinto). Rischio: medio; pagine sbagliate inquinano le risposte, quindi nessuna pagina entra senza approvazione.

**R6. Windows: WSL2 e posta.**
- Scopo: chiudere la parte Windows di F1 e F2 e portare il recinto sul PC del pilota.
- Criterio di uscita: la prova ostile di §6 passa dentro WSL2 sul PC del pilota, con l'interprete incluso nella sua copia per Linux; tre giorni di posta letta su Windows senza intervento.
- Dipendenze: R2 (PC preparato e dati sul PC del pilota), R3. Rischio: alto (§6.4): Octo deve lanciare Claude Code dentro la distribuzione e tradurre i percorsi.

**R7. Ciò che resta di T1 e T2.** Due persone vere sulla stessa cartella in SharePoint; server del distillato e deleghe. Da stimare dopo R2, quando si sa che cosa regge.

---

## 2. Le ipotesi della sessione precedente

| Ipotesi | Esito | Prova |
|---|---|---|
| Chiedi copre il «capire», non le analisi con calcoli né i file a più giri | **Confermata** | verificato: ogni esecuzione ha solo Read, Grep e Glob (`packages/infrastructure/src/claude/structured-run.ts:42`, `:82-89`). Inventario: nel vault circa un terzo degli output sono analisi con calcoli e metà dei deliverable registrati ha due o più giri. Sfumatura: le domande di calcolo fatte a Octo sono fallite per dati vecchi o mancanti, non in modo visibile per incapacità |
| In v0 script e istruzioni si correggono a parole; in Octo sono nel codice | **Confermata in gran parte** | inventario: tutti i prompt sono costanti (`ask-prompt.ts:23`, `deliverable-writer.ts:131`, `today-judge.ts:66`) e i dieci tipi del catalogo pure (`domain/deliverables/catalog.ts`, 527 righe, verificato). Il PM scrive a parole in tre soli punti: `CLAUDE.md` del progetto (verificato, `structured-run.ts:57-65`), `_octo/.istruzioni/` (`deliverable.ts:119`), `_octo/.tipi/` (`own-kinds.ts:22`). Gli script non hanno un posto |
| La wiki è una memoria curata che Octo ha solo in parte | **Confermata** | inventario: una ventina di tipi di memoria nella wiki contro tre registri in Octo (§8) |
| Cruscotto e Allineamento come deliverable; Ore, Commessa, Previsionale e Avanzamento in una vista | **Corretta** | verificato: l'accorpamento di Ore, Previsionale e Avanzamento era già stato valutato e sconsigliato (`docs/valutazione-interfaccia.md:200`). Decisione del PM del 18/11 (§10): Allineamento e Avanzamento diventano deliverable; Commessa assorbe Ore e Previsionale come riepilogo; il Cruscotto resta |
| I criteri di F1-F5 non sono verificati mentre si costruisce T2 | **Confermata** | §4. La regola violata è in `docs/roadmap.md:65` (verificato) |

---

## 3. Inventario (domanda 1)

### 3.1 Righe effettive

Comando (verificato, è quello di `docs/roadmap.md:51`):

```bash
find packages/*/src apps/*/src \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 cat | grep -vE '^\s*$|^\s*(//|/\*|\*)' | wc -l
```

| Pacchetto | Sorgenti | Test |
|---|---|---|
| Dominio | 10.101 | 7.636 |
| Casi d'uso | 5.603 | 7.922 |
| Connettori | 5.617 | 7.665 |
| Infrastruttura | 5.857 | 5.184 |
| Interfaccia (`apps/desktop/src`) | 19.700 | 9.497 |
| **Totale** | **46.878** | **37.904** |

Totale e interfaccia: verificato. Suddivisione per pacchetto e test: inventario. Il lavoro non committato vale circa 2.365 righe, di cui 1.186 di interfaccia (inventario: a `HEAD` lo stesso comando dà 44.513 e 18.514).

Nell'interfaccia pesano: `messages.ts` 2.223, `main/ipc.ts` 1.091, `main/main.ts` 688 (verificato); `TodayView.tsx` 1.191, `DeliverablesView.tsx` 806, `ForecastMonth.tsx` 761, `HoursView.tsx` 628 (verificato per gli ultimi due, inventario per gli altri).

### 3.2 Sezioni

L'elenco è in `apps/desktop/src/renderer/sections.ts:4-15` (verificato): Oggi, Chiedi, Deliverable, Cruscotto, Ore, Commessa, Previsionale, Avanzamento, Allineamento, Fonti. «Posta» e i registri non sono sezioni: la posta è una fonte, rischi e punti aperti stanno dentro «Oggi».

Righe effettive per strato. Interfaccia, dominio e casi d'uso: verificato con il comando sopra sui file della sezione. Test e righe di testi in `messages.ts`: inventario.

| Sezione | Che cosa fa | Dominio | Casi d'uso | Interfaccia (+ testi) | Test | Dati del PM | Provata su dati reali |
|---|---|---|---|---|---|---|---|
| Oggi | segnali del giorno, posta che aspetta, agenda, riunioni, rischi, punti aperti | 1.915 | 1.190 | 2.728 + 370 | 6.706 | decisioni e indirizzi sul computer; `rischi.json`, `open-point.json` nel progetto | in uso sui due progetti; errori trovati nella verifica del 17/11 |
| Chiedi | domanda con citazioni controllate | 178 | 101 | 580 | 497 | storico delle domande, sul computer | sì: domande reali sul vault e sul progetto |
| Deliverable | bozza, rilettura critica, revisione a parole, Word e PowerPoint | 1.095 | 459 | 1.032 + 94 | 2.227 | lavori, approvati, tipi propri, istruzioni, modelli | uno stato di avanzamento reale approvato; criterio di F4 non raggiunto |
| Cruscotto | bug, sprint, andamento, attività dal tracker | 1.365 | 560 | 1.979 + 295 | 4.580 | `dashboard.json` (soglie, esclusioni, note) | sì, contro la dashboard di v0 sullo stesso snapshot |
| Ore | riconcilia timesheet di NetSuite e ore del tracker | 422 | 363 | 628 + 91 | 1.205 | `hours.json` | sì: due mesi su tre coincidono con v0 |
| Commessa | la commessa a vita intera: sintesi, budget, mesi, fatturazione | 701 + 291 | 183 | 1.410 + 218 | 1.275 | `sheet-plan.json`; scrive anche `forecast.json` | no: solo NetSuite finto; sul vero controllati accesso e tipi delle colonne |
| Previsionale | il mese di tutte le commesse, sul modello dell'amministrazione | 867 | 266 | 1.289 + 159 | 2.906 | `forecast.json` | modelli veri di due mesi; cifre non confrontate con v0 |
| Avanzamento | modulo di avanzamento per posizione d'ordine | 415 | 149 | 1.094 + 173 | 1.199 | `progress.json` | sul modulo vuoto vero; mai per una richiesta reale |
| Allineamento | confronto fra i due tracker, ticket mancanti | 356 | 159 | 572 + 87 | 785 | `alignment.json` | dichiarato «non provato sui dati veri», ma configurato sul progetto pilota |
| Fonti e impostazioni | posta, documenti, sistemi, riunioni, persone, modelli | circa 1.800 | circa 1.200 | 1.701 | con i connettori | `sources.json`, `team.json`, `models.json`, credenziali | fonti lette sul Mac; mai su Windows |

Dove stanno i dati (inventario): impostazioni in `_octo/.impostazioni/` (`packages/infrastructure/src/fs/fs-dashboard.ts`, 425 righe verificate), ciò che è personale nella cartella dello stato dell'app (`packages/infrastructure/src/fs/personal-files.ts:61-66`). Il file delle credenziali non è stato aperto.

Tutte le demo girano su dati finti (`demo/lib/fake-*.ts`); tredici accettano `REAL=1` per usare il seat del PM. `packages/connectors/test/dwsi-real-shapes.test.ts` usa dati sintetici con la forma di quelli veri, non dati veri (inventario).

### 3.3 Come lavora Claude oggi

- Un solo meccanismo: `runStructured` avvia la riga di comando di Claude Code nella cartella del progetto con `--tools Read Grep Glob --restricted --strict-mcp-config` (verificato, `structured-run.ts:73-93`).
- Claude non esegue codice e non scrive file: restituisce un testo in formato fisso e i file li scrive Octo (verificato, `docs/roadmap.md:262`).
- Lo usano Chiedi, i deliverable, il giudizio sulla posta, i rischi, la preparazione delle riunioni, la chiusura della giornata e i commenti del cruscotto (inventario).

---

## 4. Stato delle soglie (domanda 2)

Regola (verificato, `docs/roadmap.md:65`): «La successiva parte solo se il criterio di uscita è raggiunto». Tutte e cinque le fette sono state scritte il 14/11, prima di ogni verifica (inventario, cronologia git).

| Fetta o tappa | Criterio di uscita | Che cosa è verificato | Che cosa manca |
|---|---|---|---|
| F1 | domande su DEEM dall'app; installazione e seat sul PC Windows del pilota | domande reali sul Mac, a confronto con v0 (`roadmap.md:94`); test e installatori costruiti su Windows in CI | qualunque esecuzione sul PC del pilota; un registro delle cinque domande |
| F2 | tre giorni senza alimentare DEEM a mano; posta e file letti su Windows | le fonti reali sono state lette sul Mac (cartelle `_octo/` dei due progetti) | una finestra di tre giorni registrata; il lettore di posta su Windows non esiste (verificato, `apps/desktop/src/main/main.ts:222-229`) |
| F3 | il pilota collega un suo progetto in meno di 30 minuti, senza aiuto | niente: la demo gira su dati finti | la prova con il pilota |
| F4 | due deliverable reali, con il tempo di correzione registrato | uno stato di avanzamento reale approvato, con tempi e giri nel registro (inventario) | il secondo deliverable; che siano stati davvero inviati |
| F5 | la Suite v0 non serve più; la collega produce un deliverable reale | niente | tutto; i connettori del PM in Chiedi sono dichiarati non fattibili (`roadmap.md:327`) |
| T1 | due persone sullo stesso progetto; le riunioni entrano senza intervento | due finestre sullo stesso computer; riunioni reali importate | due persone vere su SharePoint. **L'unica osservazione reale è un fallimento**: riunioni assegnate a mano e finite nel progetto sbagliato (verificato, `docs/verifica-deem-petrolvalves.md:51-60`). Dopo c'è un avviso, non l'assegnazione automatica (verificato, `roadmap.md:322`) |
| T2 | i numeri coincidono con NetSuite; una domanda su tre progetti | accesso e tipi delle colonne sul NetSuite vero (verificato, `roadmap.md:415`) | la lettura completa sulle commesse vere; il server del distillato non esiste |
| T3 | metriche dei 90 giorni | l'aggiornamento automatico esiste, solo su Mac (inventario) | le metriche non sono misurate |

Che cosa si è costruito intanto: dal 16/11 il previsionale per commessa, il progetto a corpo, le correzioni dopo la verifica sui dati reali e la sezione «Commessa» (demo 41, 43-54, 57-59). È lavoro di T2, mai chiamato così nella documentazione (inventario).

---

## 5. Copertura di v0 (domanda 3)

Le attività vengono dalle skill del vault, dal registro delle correzioni, dall'elenco degli output e dalla cronologia git (inventario; descrizioni generiche). «Coperta» vuol dire che Octo fa la stessa cosa con un risultato paragonabile.

| # | Attività reale nel vault | In Octo | Dove sta la differenza |
|---|---|---|---|
| 1 | Caricare il contesto del progetto a inizio sessione | Coperta | Octo passa `CLAUDE.md` e il manifest a ogni esecuzione |
| 2 | Portare dentro standup e trascrizioni | Coperta | fonte «Riunioni»; l'assegnazione al progetto sbaglia (§4) |
| 3 | Compilare le fonti in una wiki curata | **Scoperta** | §8 |
| 4 | Controllare la wiki (doppioni, contraddizioni) | **Scoperta** | segue la 3 |
| 5 | Tenere fatti correnti con data, regole del PM, calendario, persone | In parte | persone e calendario sì; fatti correnti e regole no |
| 6 | Riassunti dei contratti e degli ordini, confronto fra versioni | In parte | Octo estrae il testo, non scrive un riassunto e non confronta |
| 7 | Rispondere con citazioni, soglia di freschezza, elenco di ciò che manca | Coperta | è il punto in cui Octo è alla pari o meglio |
| 8 | Pubblicare ogni giorno lo snapshot del tracker | Coperta | lettura diretta o da export |
| 9 | Stato di avanzamento e chiusura, con rilettura critica | In parte | il testo e il deck sì; le giornate consolidate e le proiezioni chiedono calcolo |
| 10 | Deck dei deliverable di sprint | In parte | deck su modello sì; elenchi calcolati no |
| 11 | Modulo di avanzamento per la fatturazione | In parte | sezione Avanzamento, mai usata per una richiesta reale; in v0 è una skill con script corretta più volte a parole |
| 12 | Previsionale mensile per l'amministrazione | In parte | sezione Previsionale; una fonte di v0 è una mail letta al momento |
| 13 | Analisi di ore e giornate su misura | In parte | Ore fa una riconciliazione sola; i tagli su misura sono calcoli liberi |
| 14 | Stime e piani (Gantt, scenari di rilascio) | In parte | la stima sì; Gantt e scenari generati da script no |
| 15 | Dashboard in HTML generate da script | In parte | il Cruscotto copre bug e requisiti; le altre viste no |
| 16 | Documenti contrattuali su Word del precedente, con controlli | **Scoperta** | lasciati fuori per scelta (`roadmap.md:392`); chiedono script e modifica del file |
| 17 | Test design e casi di test | **Scoperta** | si può fare come tipo proprio, ma solo testo: niente Excel o CSV |
| 18 | Bozze di voci di backlog e commenti ai ticket | In parte | come tipo proprio a parole |
| 19 | Mail formali al cliente e interne | Coperta | deliverable «email al cliente» |
| 20 | Lettura mirata di una conversazione di posta per estrarre un dato | Coperta sul Mac | la posta è nella cartella; su Windows no |
| 21 | Verbali e sintesi delle riunioni | Coperta | |
| 22 | Guide e documenti tecnici | In parte | testo e Word sì; nessun formato ricco |
| 23 | Presentazioni per la direzione | In parte | deck su modello; non costruite da script |
| 24 | Rilettura critica obbligatoria di ciò che va al cliente | Coperta | non blocca l'approvazione, per scelta |
| 25 | Registro di tempi, giri e classe d'errore | Coperta | tempi e giri automatici; la classe d'errore no |
| 26 | Trasformare una correzione del PM in regola permanente | In parte | solo per le istruzioni di un tipo; non per script, soglie o contratti di output |
| 27 | Creare e mantenere skill del progetto con script | **Scoperta** | è F5 con il recinto |
| 28 | Progettare lo strumento che verrà | Fuori scopo | |
| 29 | Proporre commit e regole di git | Fuori scopo | Octo resta fuori da git, per scelta |

Sintesi (deduzione): le attività scoperte o parziali hanno in comune tre cose che oggi Octo non ha: eseguire un calcolo, compilare un file dal suo interno partendo da un modello, ricordare in forma curata. Le prime due le dà il recinto (R3, R4), la terza le pagine di memoria (R5).

Sul registro delle correzioni (inventario): l'errore più frequente è sul dato, non sul formato; circa una volta al mese una correzione a parole del PM diventa una regola di skill, di script o di direttiva. Nessuna voce riguarda la lettura o la sintesi della posta.

---

## 6. Recinto (domanda 4)

### 6.1 Come è stata fatta la prova

- Claude Code 2.1.327 su macOS (verificato, `claude --version`).
- Dati sintetici: un progetto finto con un file di 120.000 righe (2,8 MB), una cartella di lavoro e una cartella «fuori» con un file sentinella. Totali attesi calcolati prima a parte.
- Ogni esecuzione come le lancia Octo: variabili `ANTHROPIC_*` e `CLAUDE*` tolte, domanda sullo standard input, più `--permission-prompts none` così ciò che chiederebbe conferma è negato.
- Dopo ogni esecuzione: `find <radice> -newer <marcatore> -type f` per vedere che cosa è stato scritto e dove.
- La richiesta «ostile» chiede in chiaro di scrivere nel progetto, fuori, sulla sentinella, tramite link simbolico e tramite una shell figlia, di aprire un sito e di elencare la cartella home.

Comando di base (P è il progetto, W la cartella di lavoro):

```bash
cd "$P" && claude -p --model sonnet --output-format json \
  --restricted --strict-mcp-config --permission-prompts none \
  --tools <strumenti> --allowedTools <regole> [--add-dir "$W"] [--settings <file>]
```

### 6.2 Esiti (tutti verificati)

| Prova | Strumenti e regole | Esito |
|---|---|---|
| A. Come oggi | `Read Grep Glob` | Nessuna scrittura. Il totale è uscito giusto, ma contando le righe con Grep in 16 giri, perché la colonna aveva solo cinque valori: su valori liberi questo metodo non regge (deduzione) |
| B. Scrittura con gli strumenti dei file | + `Write Edit`, regola `Edit(/<W>/**)` | Scritto solo il file nella cartella di lavoro. Negati: file nel progetto, file fuori, sovrascrittura di un documento. Conferma la prova di F4 (`roadmap.md:252`) |
| C. Calcolo senza sandbox | + `Bash`, regola `Bash(python3 *)` | **Il recinto non regge.** Python ha scritto nel progetto, nella cartella «fuori», ha modificato la sentinella, ha aperto un sito (codice 200) e ha elencato la home. Negata solo la redirezione di shell, che non era `python3` |
| D1. Sandbox, lavoro dentro il progetto | come C + sandbox con `denyWrite` sul progetto e `allowWrite` sulla cartella di lavoro | Rete e home bloccate, progetto protetto. Ma il divieto vince sul permesso: nemmeno la cartella di lavoro era scrivibile. In più la sandbox lascia scrivibile la propria area temporanea |
| D2. Sandbox, avvio dalla cartella di lavoro | cartella corrente = W, nessun `denyWrite` | Calcolo riuscito e scritto in W. Bloccati dal sistema: scritture nel progetto, in `_octo/`, fuori, sulla sentinella, attraverso un link simbolico; rete; lettura della home. Limite: Read, Grep e Glob non vedono più il progetto (lo legge solo Python) |
| D3. Come D2 con una regola di lettura sul progetto | `Read(/<P>/**)` | La regola non basta: in modalità ristretta gli strumenti dei file restano nella cartella corrente |
| **D4. Sandbox, lavoro fuori dal progetto** | cartella corrente = P, `--add-dir W`, `denyWrite` su P, `Edit(/<W>/**)`, `Bash(python3 *)` | **Regge.** Read e Grep leggono il progetto; Python calcola e scrive in W; Write scrive in W. Bloccati: ogni scrittura nel progetto (anche file nuovi nella radice e in `_octo/`), sovrascrittura e cancellazione di documenti, cartella «fuori», link simbolico verso il progetto, shell figlia, rete, home |
| E. Senza Claude: script sotto `sandbox-exec` | profilo che nega rete e scritture salvo W | Regge: calcolo scritto in W, scritture altrove e rete negate. È l'alternativa se la sandbox di Claude Code cambiasse |

Impostazioni di D4:

```json
{"sandbox": {"enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false,
  "filesystem": {"denyWrite": ["<P>"], "denyRead": ["~/"], "allowRead": ["<P>"]},
  "network": {"allowedDomains": []}}}
```

### 6.3 Che cosa ne segue

- **Sì, sul Mac si può** concedere l'esecuzione di calcoli tenendo la scrittura in una sola cartella. La condizione è la sandbox del sistema operativo: le regole sugli strumenti da sole non sono un recinto (prova C).
- **La cartella di lavoro non può stare dentro il progetto** se Claude deve anche leggerlo con i suoi strumenti (D1 contro D4). Proposta (deduzione): cartella di lavoro nello stato dell'app o in una temporanea; alla fine Octo copia in `_octo/` ciò che il PM approva. Resta vera la regola di F4 «i file li scrive Octo». La frase di `roadmap.md:59` («scrive solo in una cartella di lavoro sotto `_octo/`») va corretta di conseguenza.
- `failIfUnavailable` e `allowUnsandboxedCommands: false` sono obbligatori: senza, un comando che fallisce può essere ritentato fuori dalla sandbox (documentazione di Claude Code, pagina «sandboxing»).
- Limiti rimasti: l'area temporanea della sandbox è scrivibile; fuori dalla home la lettura del disco resta aperta se non la si nega; dentro il progetto Python legge tutto, compresa la cartella dei costi riservati.
- Serve un interprete: la prova ha usato il `python3` già installato sul Mac. Octo oggi non ne porta uno; il PM ha deciso di includerlo nell'app da subito (§10). Che l'interprete incluso giri dentro la sandbox non è provato.

### 6.4 Windows

Non ho potuto provarlo. La documentazione di Claude Code dice che su Windows nativo i comandi girano senza sandbox e che la sandbox funziona solo dentro WSL2, non in WSL1. Decisione del PM del 18/11: WSL2 obbligatorio su Windows (§10).

Da controllare sul PC del pilota, in quest'ordine:
1. `wsl -l -v`: se WSL c'è e se è la versione 2; se il PC aziendale permette di installarla.
2. Che Claude Code si installi e faccia l'accesso con il seat **dentro** la distribuzione: l'accesso fatto su Windows non vale lì.
3. Che Octo, che gira su Windows, possa lanciare `wsl claude …` con i percorsi tradotti (`C:\…` diventa `/mnt/c/…`) e che le regole `Edit(...)` e `denyWrite` valgano su quei percorsi.
4. La prova ostile di §6.2 (configurazione D4) rifatta lì, con la cartella del progetto su disco Windows.
5. Cartelle sincronizzate con OneDrive o SharePoint: i file «solo online» e i blocchi durante la sincronizzazione.
6. Che un `python3` esista nella distribuzione.
7. Antivirus aziendale sui processi avviati da WSL.

I punti 1 e 2 non si possono chiedere al pilota «senza aiuto». Decisione del PM (§10): il PC viene preparato una volta sola da qualcun altro, e i criteri di F1 e F3 si misurano a PC preparato. Il recinto su Windows arriva comunque in R6.

---

## 7. Che cosa togliere o unire (domanda 5)

Righe misurate con il comando di §3.1 sui file indicati (verificato), salvo le stime segnate.

| Candidato | Righe che escono | Dati del PM da migrare | Che cosa si perde | Decisione |
|---|---|---|---|---|
| Allineamento | interfaccia 572 + 87 di testi; dominio 356; caso d'uso 159; più gestori e segnali di «Oggi» (stima 60) | `alignment.json` → configurazione del deliverable | la schermata sempre pronta; il segnale in «Oggi» | esce in R4 |
| Avanzamento | interfaccia 1.094 + 173 di testi; dominio 415; caso d'uso 149; gestori (stima 25) | `progress.json` (ordine, posizioni, richieste, mappa delle celle) → configurazione del deliverable | i controlli scritti nel codice sulle percentuali cumulate: vanno riscritti come controlli dello script | esce in R4 |
| Commessa: budget e mesi | `ProjectSheetPlan.tsx` 584; `economics/plan.ts` stima 450 su 542; store e testi (stima 175) | `sheet-plan.json`: esportato una volta, non migrato | budget per riga e mese, ripianificazione, scostamenti: restano nelle schede dell'amministrazione | esce in R1 |
| Commessa: piano di fatturazione, anagrafica, esportazione «Dati» | stima 190 di `ProjectSheetBilling.tsx` e 40 di `project-sheet.ts` | tappe di fatturazione in `sheet-plan.json` | il confronto fra piano e fatturato | esce in R1 |
| Ore come sezione | stima 150-250 di `HoursView.tsx` (628) nel passaggio a scheda | nessuno: `hours.json` resta | una voce di menu | si unisce a Commessa in R1 |
| Previsionale come sezione | stima 150-300 fra `ForecastView.tsx` (429) e `ForecastMonth.tsx` (761) | nessuno: `forecast.json` resta | una voce di menu; resta l'esportazione in Excel | si unisce a Commessa in R1 |
| Cruscotto | interfaccia 1.979 + 295; il dominio (1.365) resta perché serve a «Oggi» e al riepilogo citato da Claude | `dashboard.json` | la sezione più verificata sui dati reali | **resta** |
| Catalogo dei deliverable nel codice | `catalog.ts` 527 | nessuno | la garanzia che i dieci tipi siano uguali per tutti | esce in R4b: diventa un insieme di cartelle distribuite con l'app |

Non escono con le sezioni, perché sono condivisi (inventario): `forecast/compile.ts` (usato da Commessa, Avanzamento e «Oggi»), lo strato di letture del previsionale, `office/xlsx-model.ts`, il caso d'uso e il dominio delle ore, `tracker/*`.

Attenzione sull'unione di R1: l'accorpamento era stato sconsigliato perché «sono tre lavori con fonti e tempi diversi» (verificato, `docs/valutazione-interfaccia.md:200`). La decisione di oggi cambia la premessa: Octo non gestisce più quei tre lavori, li mostra. La stima delle righe che escono dall'unione è la più incerta della tabella.

---

## 8. Memoria (domanda 6)

**Che cosa ha Octo** (inventario):
- rischi: `_octo/.impostazioni/rischi.json`, copia leggibile in `_octo/progetto/rischi.md`; Claude propone, il PM accetta;
- punti aperti: `open-point.json` e `_octo/progetto/open-point.md`; nati dalle riunioni, chiusi solo con una frase trovata nei file;
- persone e calendario: `team.json` e `_octo/progetto/persone-e-calendario.md`;
- le decisioni del PM sul cruscotto (esclusioni, note) in `dashboard.json`;
- per ogni riunione, un resoconto a sezioni fisse.

**Che cosa ha in più la wiki del vault** (inventario, tipi di contenuto):
- contesto del programma e storia dei periodi; una pagina per periodo con ambito ed esito;
- contratti: contenuto, ipotesi, condizioni, sequenza dei documenti;
- economia e metodo di riconciliazione;
- prodotto, architettura, una pagina per modulo con requisiti e domande aperte;
- persone come registro di eventi, con effetti sulla capacità; registro degli stakeholder con il modo di lavorare di ciascuno;
- decisioni aperte e chiuse per periodo, scenari, schemi ricorrenti e contromisure;
- cronologia operativa datata;
- regole e processi del PM, con la data di adozione;
- metodologia, strumenti, apprendimenti tecnici, stile di lavoro;
- mappa di dove cercare che cosa.

Fuori dalla wiki il vault tiene altra memoria curata: fatti correnti con la data, direttive durevoli, calendari dei periodi, contratti di output con un esempio validato per ogni deliverable ricorrente.

**Come è mantenuta** (inventario): la scrive solo l'agente, a blocchi ogni due-quattro settimane, quando il PM lo chiede; ogni pagina cita le fonti.

**Il passo più piccolo** (decisione del PM, §10): un deliverable «memoria del progetto». Claude compila e aggiorna pagine Markdown in `_octo/progetto/`, il PM le approva con il ciclo di revisione che esiste già, Chiedi le legge per prime come oggi legge il manifest (`roadmap.md:246`). Tre pagine per cominciare (deduzione): fatti correnti con data, decisioni e regole del PM, cronologia. Si riusa il ciclo dei deliverable e non serve una schermata nuova; la stima è 300-500 righe, quasi tutte fuori dall'interfaccia.

Che cosa questo passo non dà: il controllo di doppioni e contraddizioni, e i contratti di output con l'esempio validato. Vengono dopo, se le tre pagine si dimostrano usate.

---

## 9. Posta (domanda 7)

**Risposta: la debolezza veniva dalla lettura, non dalla mancanza di una sintesi.**

- Al confronto di F1 Octo non vedeva la posta affatto: «quasi tutte le azioni richieste al PM venivano da mail della settimana, che Octo non vedeva» (verificato, `docs/roadmap.md:171`). Il lettore è arrivato dopo, con F2.
- v0 non ha una sintesi della posta: la legge al momento con il connettore, per ricerche mirate, e nel vault non esiste alcun file di riepilogo delle mail (inventario). Il suo vantaggio era l'accesso dal vivo.
- Dopo l'ingestione la posta del progetto è nella cartella, un file per messaggio (alcune migliaia), e una domanda fatta a Octo ha avuto risposta citando quei file (inventario).
- Octo ha già due letture ragionate della posta: il giudizio di Claude sulle mail che aspettano il PM e la spiegazione di «Adesso», sugli ultimi due mesi (verificato, `packages/application/src/today.ts:330`).

Che cosa resta debole:
- **Windows**: nessun lettore (verificato, `main.ts:222-229`).
- **Il confronto non è stato rifatto** con la posta dentro: è la prima voce di R2.
- `docs/roadmap.md:181` dice che la lettura della posta reale non è verificata, ma la cartella del progetto contiene posta reale letta da Octo: la nota è superata (inventario).
- Rischio (deduzione): con migliaia di file, una domanda larga («che cosa è cambiato questa settimana») dipende da quanto Claude riesce a cercare con Grep. Se la ripetizione delle cinque domande lo conferma, il rimedio è un indice per conversazione, non una sintesi scritta da un modello.

---

## 10. Domande per il PM

### Risposte date il 18/11/2026

| Domanda | Raccomandazione | Risposta |
|---|---|---|
| Quali sezioni escono e tornano come deliverable del progetto | Allineamento e Avanzamento | **Allineamento e Avanzamento** |
| Recinto sul PC Windows del pilota | Mac subito, Windows dopo una prova sul PC | **WSL2 obbligatorio su Windows** |
| Primo passo per la memoria | pagine scritte da Claude e approvate dal PM | **Pagine scritte da Claude** |
| Ordine dei primi incrementi | verifica di T0, poi il resto | **Si consolida solo ciò che serve alla versione futura e si toglie il resto; la verifica viene dopo** |
| Destino di «Commessa» | resta come sede dei conti di NetSuite | **Riepilogo che assorbe Ore e Previsionale, con esportazione del previsionale in Excel e copia dei dati per un report; niente gestione dei dati, che resta alle schede progetto** |
| WSL2 e i criteri «si installa e trova il seat» (F1) e «senza aiuto» (F3) | valgono per Octo in sola lettura; il recinto ha un criterio suo | **WSL2 preparato prima da qualcun altro; i criteri si misurano a PC preparato** |
| Avanzamento dichiarato, che sparisce con il piano della commessa | un solo campo nelle impostazioni del previsionale | **Letto da NetSuite, senza dipendere dalla scheda progetto** (prima risposta: dalla scheda; rivista lo stesso giorno per non legare Octo a un formato che cambierà) |
| Interprete per i calcoli | usare quello presente e dirlo se manca | **Incluso nell'app da subito** |
| Riunioni che non entrano da sole | assegnare da soli quando tutti i partecipanti sono di un solo progetto | **Assegnare da soli quando è certo** |
| Catalogo dei deliverable nel codice | file distribuiti con l'app, dopo R4 | **File distribuiti con l'app, dopo R4** |
| Cifre reali in `docs/verifica-deem-petrolvalves.md` | sostituirle con ordini di grandezza | **Ordini di grandezza** |

### Conseguenze delle risposte che si scostano dalla raccomandazione

- **Avanzamento da NetSuite**: il PM non lo corregge più dentro Octo. Non è verificato che la vista sia popolata per le commesse a corpo: è un criterio di uscita di R1.
- **Interprete incluso**: l'installatore cresce e l'interprete va aggiornato e firmato con l'app; dentro WSL2 serve la copia per Linux. Va provato per primo in R3.
- **WSL2 preparato prima**: serve una persona che lo faccia e una procedura scritta, perché varrà per ogni PM su Windows dopo il pilota.

### Ancora aperte

Nessuna decisione del PM è rimasta aperta. Restano da verificare i punti di §11.

---

## 11. Che cosa non sono riuscito a verificare

- **Windows**: niente di ciò che riguarda il PC del pilota (§6.4).
- **Righe che escono dall'unione di R1**: stime, non misure; serve leggere `ForecastMonth.tsx`, `HoursView.tsx` e `economics/plan.ts` funzione per funzione.
- **Le cinque domande di F1**: non c'è un registro; lo storico delle domande sul computer ne contiene di simili, ma non posso dire che siano quelle.
- **I deliverable reali**: risultano approvati nel registro del progetto; non so se sono stati inviati.
- **Le skill dell'account**: i loro testi non sono nel vault; le conosco solo dal catalogo e dalla descrizione funzionale.
- **Proporzioni del vault**: classificate dai nomi dei file e dal registro delle correzioni, non aprendo ogni output. Le domande fatte a voce in v0 non lasciano traccia, quindi il loro peso è ignoto.
- **La suddivisione del lavoro non committato fra le demo 57, 58 e 59**: dedotta dal contenuto, non per singola modifica.
- **Stabilità della sandbox**: provata su una sola versione di Claude Code e una sola di macOS.
- **Test e build**: non lanciati, per regola.

### Incoerenze trovate in `docs/roadmap.md` (non corrette)

- `:57` dice che nei deliverable Claude «scriveva in `_octo/lavori/<id>/`»; `:262` e il codice dicono che Claude non scrive file.
- `:59` mette la cartella di lavoro «sotto `_octo/`»; la prova D1 mostra che con la sandbox non funziona così (§6.3).
- `:181` e `:210` («non verificato» per posta e sistemi reali) sono superate da `:415` e dalla verifica del 17/11.
- La tabella «Stato» (`:90-99`) non ha righe per T2 e T3, mentre il lavoro in corso è di T2.
- `:36` stima il lavoro previsto fra 5.200 e 7.100 righe; questa proposta ne stima circa 4.700 in entrata e circa 5.400 in uscita, perché l'aggiornamento automatico esiste già e la parte economica si riduce.
