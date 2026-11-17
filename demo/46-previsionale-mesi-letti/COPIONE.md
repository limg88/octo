# Demo 46 — Previsionale a corpo: tutti i mesi di timesheet dall'inizio della commessa

Durata: 4 minuti. Mostra che il previsionale di una commessa a corpo non dipende più dai mesi scaricati a mano in «Ore»: Octo legge da solo da NetSuite i mesi che gli mancano dall'inizio della commessa; quando non può, dice quali mesi non ha letto invece di contarli come zero.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500, cominciata due mesi fa. In NetSuite ci sono i timesheet di due mesi: 34 ore due mesi fa, 21,5 ore il mese scorso, a 25 euro l'ora. Nella cartella del progetto Octo ha solo il mese scorso, come quando il PM ha letto in «Ore» il periodo proposto. Costi a budget già scritti: 4.000.

## Passi

1. **Avvia la demo senza la credenziale di NetSuite.**
   ```bash
   NO_CREDENTIAL=1 bash demo/46-previsionale-mesi-letti/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Previsionale».** Il mese è quello scorso.
   Atteso: riga `PRJ000101` con costi interni 537,50 e avanzamento **13,44%**. Sotto la riga: «timesheet non letti, costi incompleti: (il mese di due mesi fa)». In «Dati che mancano»: «PRJ000101: i timesheet di … non sono stati letti da NetSuite, costi e avanzamento sono incompleti», con il pulsante «Apri «Ore»», e la riga «Timesheet non letti da NetSuite: …».
   Dimostra: prima della correzione questa pagina mostrava lo stesso 13,44% senza dire niente. Ora il numero incompleto è dichiarato sulla riga e fra i dati che mancano.

3. **Vai al mese prima** con «‹».
   Atteso: la riga non dice più «nessuna attività nel mese»: dice che i timesheet di quel mese non sono stati letti.
   Dimostra: un mese mai letto non è un mese senza lavoro.

4. **Chiudi la finestra e riavvia con la credenziale.**
   ```bash
   bash demo/46-previsionale-mesi-letti/run.sh
   ```

5. **Apri «Previsionale».** Non premere niente.
   Atteso: dopo un momento, avanzamento **34,69%** con la nota «avanzamento 34,69% (mese prima 21,25%) = costi fino al mese / costi a budget 4.000». Nessuna riga sui timesheet non letti.
   Dimostra: Octo ha letto da solo il mese mancante (850,00 di costi) e l'avanzamento conta tutta la vita della commessa: (850 + 537,50) / 4.000.

6. **Guarda la cartella del progetto.** «Cartella del progetto» → `_octo/ore/netsuite/`.
   Atteso: due file `timesheet_AAAA-MM.json`, uno per mese.
   Dimostra: i mesi letti restano nel progetto come quelli letti da «Ore»: il confronto delle ore usa gli stessi file.

7. **Apri «Impostazioni del previsionale».**
   Atteso: nella tabella «Commesse del progetto» la colonna «Inizio (anno-mese)» porta il mese di due mesi fa.
   Dimostra: l'inizio della commessa è il mese del primo ordine letto da NetSuite; il PM lo corregge qui se il lavoro è cominciato prima.

## Che cosa dimostra
- Avanzamento e ricavi di un corpo non scendono più in silenzio perché manca un mese sul disco.
- Un mese letto mentre era ancora in corso viene riletto: conta come letto solo se letto dopo la sua fine, oppure oggi.
- Se NetSuite non è collegato, manca la credenziale o non risponde, la pagina si apre lo stesso e dice quali mesi mancano.

## Che cosa non fa
- Per i timesheet tenuti a mano in una cartella scelta dal PM (non letti da Octo) non si può sapere quali mesi coprono: nessun avviso.
- Per le commesse a giornate serve solo il mese del previsionale: i mesi precedenti non vengono chiesti.

## Test
```bash
pnpm vitest run packages/domain/test/forecast.test.ts packages/application/test/forecast.test.ts packages/application/test/hours.test.ts apps/desktop/test/forecast.test.tsx
```
