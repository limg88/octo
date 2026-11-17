# Demo 49 — Il cruscotto di un Jira usato come registro delle attività

Durata: 4 minuti. Mostra che il cruscotto si adatta a un Jira che non è il tracker del cliente con bug e sprint, ma il registro interno delle attività di un progetto a corpo: poche voci, di tipo Task e Story, con le ore registrate e i commenti che fanno da diario.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Jira vero: lo script ne avvia uno finto su questo computer, già collegato al progetto «Aurora». Cinque voci (3 Task, 2 Story), nessun bug, nessuno sprint. Le ore registrate sulle voci sono già nella cartella del progetto, come dopo una lettura da «Ore» (35,5 ore di due persone).

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/49-cruscotto-registro-attivita/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Cruscotto» e premi «Leggi da Jira».**
   Atteso: «Lette 5 voci, 2 con la cronologia, alle …». Sotto, una sola scheda: «Attività», e la riga «Senza dati in questo tracker, quindi non mostrate: Sprint, Bug, Andamento.»
   Dimostra: prima la pagina mostrava cinque riquadri di bug a zero, un grafico vuoto e la frase «Le voci del perimetro non portano uno sprint». Ora le parti senza dati non ci sono, e Octo dice quali ha tolto.

3. **Leggi la tabella «Attività».**
   Atteso, nell'ordine:
   | Voce | Titolo | Stato | Chi | Ore |
   |---|---|---|---|---|
   | AUR-3 Task | Analisi dei processi di integrazione | In corso | Luca Bianchi | 25,5 |
   | AUR-1 Story | Gestione progetto | In corso | Anna Rossi | 8 |
   | AUR-4 Task | Stima della migrazione | Da completare | Luca Bianchi | 0 |
   | AUR-5 Task | Presentazione finale | Da completare | Non assegnato | 0 |
   | AUR-2 Story | Kick-off con il cliente | Completata | Anna Rossi | 2 |

   Totale 35,5. Sotto, «Ore per persona»: Luca Bianchi 25,5 · Anna Rossi 10.
   Dimostra: tutte le voci, di qualunque tipo. Le Task, che prima restavano fuori, ci sono: la più importante è in cima, con le sue ore. Prima ciò che è in lavorazione, poi per ore.

4. **Apri il diario.** Nella riga di AUR-3 premi «Diario di AUR-3: 3 commenti».
   Atteso: i tre commenti dal più recente: «Inviata la bozza al cliente, aspettiamo i commenti.», «Prima bozza del documento di analisi.», «Raccolti i flussi esistenti: 14 integrazioni.»
   Dimostra: i commenti di una voce sono il diario dell'attività, e si leggono senza uscire da Octo.

5. **Cerca il segnale sbagliato.** Nella pagina non c'è la tabella «Requisiti poco chiari».
   Dimostra: «Gestione progetto» è una storia senza criteri di accettazione perché Jira non ha quel campo. Prima compariva fra i requisiti poco chiari con il segnale «Criteri di accettazione assenti»; ora Octo sa che il campo non esiste e il segnale non scatta. In un registro di attività una storia è una riga di lavoro, non un requisito da raffinare.

6. **Apri «Impostazioni del cruscotto».**
   Atteso: i due elenchi «Tipi che conto come bug» e «Tipi che conto come storie» propongono i tipi letti; sotto: «Tipi letti dal tracker: Task (3), Story (2). …»
   Dimostra: i tipi non si scrivono a memoria: si scelgono fra quelli che il tracker ha davvero.

7. **Guarda «Oggi».** Premi «Leggi ora».
   Atteso: fra le fonti il tracker è «Tracker (Jira)», non «Tracker del cliente».

8. **Guarda il riepilogo in numeri.** Nel terminale:
   ```bash
   head -3 .tmp/demo-49/Aurora/_octo/cruscotto/riepilogo.md
   ```
   Atteso: `# Tracker (Jira): riepilogo in numeri`.

## Che cosa dimostra
- Le schede seguono i dati: un tracker con bug e sprint (demo 34 e 43) mostra «Sprint», «Bug» e «Andamento» come prima; un registro di attività mostra «Attività».
- Su Jira la colonna «Periodo» non c'è e la gravità si chiama «Priorità», come la chiama Jira (si vede nella demo 43, che ha i bug).
- Gli stati hanno un nome solo: il changelog di Jira li scrive in inglese («To Do», «Done»), le voci in italiano; Octo li riconosce dall'id dello stato e usa il nome che portano le voci.

## Che cosa non fa ancora
- Le ore contro il tetto compaiono quando le persone del progetto hanno un tetto in giornate (demo 51): in questa demo nessuno ne ha uno.
- Le ore si leggono in «Ore» («Leggi le ore da Jira»): il cruscotto non le chiede da solo.

## Test
```bash
pnpm vitest run packages/domain/test packages/application/test/dashboard.test.ts packages/application/test/hours.test.ts packages/connectors/test/jira-tracker.test.ts apps/desktop/test/dashboard.test.tsx
```
