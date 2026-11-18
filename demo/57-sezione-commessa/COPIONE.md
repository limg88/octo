# Demo 57 — La sezione «Commessa»

> **Aggiornamento del 18/11/2026 (R1).** «Ore» e «Previsionale» sono ora schede di «Commessa», che ha quattro schede: «Sintesi», «Fatturazione», «Ore», «Previsionale». Budget, mesi e piano di fatturazione non sono arrivati in Octo: restano nelle schede progetto. L'avanzamento si legge da NetSuite. I passi che nominano le due sezioni si seguono dalle schede; il giro aggiornato è la demo 60.

Durata: 4 minuti. Primo passo per portare in Octo le regole delle schede progetto dell'amministrazione: la commessa a vita intera ha una sezione sua. Ordinato e fatturato stanno in un posto solo; «Previsionale» resta il mese di tutte le commesse; «Avanzamento» resta il modulo del cliente. Nessun numero nuovo: cambia dove si trovano.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500, cominciata due mesi fa: 34 ore di Rossi Mario, 21,5 ore di Bianchi Luca, 8 ore dichiarate di Verdi Sara. Acconto del 30% fatturato, 70% dei ricavi riconosciuto. Costi a budget 4.000.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/57-sezione-commessa/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Guarda la colonna di sinistra, gruppo «Ogni mese».**
   Atteso: «Ore», «Commessa», «Previsionale», «Avanzamento», in quest'ordine.
   Dimostra: la commessa è una sezione, non una scheda nascosta dentro «Previsionale».

3. **Apri «Commessa».**
   Atteso: il presidio «Documento interno: costi e margini non vanno al cliente.», il titolo «PRJ000101 · Assessment Aurora (A corpo)» e i gruppi di riquadri (dalla demo 58 ce n'è un terzo, «Da regolare», e sotto il titolo le schede «Sintesi» e «Fatturazione»).
   - «Ordine»: Ordinato 7.500,00 · Fatturato (NetSuite) 2.250,00, 30% dell'ordinato · Da fatturare 5.250,00, 70% dell'ordinato · Ricavi riconosciuti (NetSuite) 5.250,00, 70% dell'ordinato.
   - «Costi e margine»: Costi a oggi 1.947,50, 63,5 ore · Margine a oggi 74,03% · Costi a budget 4.000,00, avanzamento 48,69% · Margine a finire 46,67%, su costi previsti di 4.000,00.

   Dimostra: le cifre che contano sono in prima schermata, ognuna con la riga che la legge. «Da fatturare» prima si vedeva solo in «Avanzamento».

4. **Scorri a «Ore e costi per persona».**
   Atteso: la tabella con Bianchi Luca 21,5 ore 537,50, Rossi Mario 34 ore 850,00, Verdi Sara 8 ore 560,00, totale 63,5 ore 1.947,50, ognuno con la fonte. Sotto, «Copia per mail».
   Dimostra: niente è stato tolto dalla vista di prima.

5. **Apri «Previsionale».**
   Atteso: la tabella del mese scorso con la riga `PRJ000101`, subito. Non ci sono più le schede «Mese» e «Commessa».
   Dimostra: una sezione, una cosa: il mese di tutte le commesse e il modello dell'amministrazione.

6. **Apri «Avanzamento».**
   Atteso: «Questo progetto è venduto a corpo. Ordinato, fatturato e quanto resta da fatturare sono in «Commessa». Qui compili il modulo del cliente, quando ce n'è uno.» Un pulsante pieno «Apri «Commessa»» e uno discreto «Ho un modulo del cliente da compilare». Nessuna tabella.
   Dimostra: ordinato e fatturato non sono ripetuti in due sezioni.

7. **Premi «Apri «Commessa»».**
   Atteso: la sezione del passo 3, con la stessa commessa.

8. **Torna ad «Avanzamento» e premi «Ho un modulo del cliente da compilare».**
   Atteso: l'impostazione del modulo del cliente, come per un progetto a giornate.
   Dimostra: chi ha un modulo da compilare lo imposta con un clic.

## Che cosa dimostra
- Ogni numero economico della commessa ha un posto solo.
- Il risultato è in prima schermata; ciò che si consulta a richiesta sta sotto.
- Il refactor non ha tolto dati: tabella per persona, proposta del budget dai tetti e copia per mail ci sono ancora.

## Che cosa non fa ancora
Le regole e le viste delle schede progetto arrivano con i prossimi incrementi: regole di calcolo allineate (ore, costo standard, fatturato dalle righe fattura), fornitori e controllo con NetSuite, WIP e FRD, budget mensile, actual e forecast, tipologie e prodotti. Il piano è in `docs/roadmap.md`, «Schede progetto».

## Test
```bash
pnpm vitest run packages/application/test/forecast.test.ts apps/desktop/test/project-sheet.test.tsx apps/desktop/test/forecast.test.tsx apps/desktop/test/progress.test.tsx apps/desktop/test/app.test.tsx
pnpm test:coverage
```
