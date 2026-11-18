# Demo 58 — «Commessa»: fatture, fornitori e controllo con NetSuite

> **Aggiornamento del 18/11/2026 (R1).** «Ore» e «Previsionale» sono ora schede di «Commessa», che ha quattro schede: «Sintesi», «Fatturazione», «Ore», «Previsionale». Budget, mesi e piano di fatturazione non sono arrivati in Octo: restano nelle schede progetto. L'avanzamento si legge da NetSuite. I passi che nominano le due sezioni si seguono dalle schede; il giro aggiornato è la demo 60.

Durata: 5 minuti. Le regole della scheda progetto dell'amministrazione entrano in «Commessa»: il fatturato è la somma delle righe fattura, il costo di un fornitore è ciò che ha consegnato sui suoi ordini, lavoro non fatturato e fatture da emettere (WIP e FRD) dicono che cosa resta da regolare, e i costi registrati da NetSuite stanno accanto a quelli che Octo calcola.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500, cominciata due mesi fa: 34 ore di Rossi Mario e 21,5 di Bianchi Luca a 25 euro l'ora, 8 ore dichiarate a mano di Verdi Sara (560). Una fattura di acconto da 2.250. Un ordine `PO-31` da 2.000 al fornitore «Studio Blu Srl», che il mese scorso ha consegnato 1.200 e li ha fatturati. NetSuite ha riconosciuto ricavi per 5.250.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/58-commessa-fornitori/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Commessa».**
   Atteso: sotto il titolo due schede, «Sintesi» (aperta) e «Fatturazione».

3. **Leggi «Ordine».**
   Atteso: Ordinato 7.500,00 · Fatturato (NetSuite) 2.250,00, 30% dell'ordinato · Da fatturare 5.250,00 · Ricavi riconosciuti (NetSuite) 5.250,00.
   Dimostra: il fatturato è la somma delle righe fattura, come nel foglio «Ciclo Attivo» della scheda; i ricavi riconosciuti sono la somma di quelli che NetSuite registra mese per mese.

4. **Leggi «Costi e margine».**
   Atteso: Costi a oggi 3.147,50, «63,5 ore · fornitori 1.200,00» · Margine a oggi 58,03% · Costi a budget 4.000,00, avanzamento 78,69%.
   Dimostra: 850 + 537,50 + 560 di persone, più 1.200 ricevuti dal fornitore. Prima il fornitore andava dichiarato a mano.

5. **Leggi «Da regolare».**
   Atteso: Lavoro non fatturato 897,50, «WIP: costi a oggi meno fatturato» · Fatture da emettere 3.000,00, «FRD: ricavi riconosciuti meno fatturato».
   Dimostra: 3.147,50 − 2.250 e 5.250 − 2.250. Sono le due righe del «Report sintesi» della scheda: l'etichetta è a parole, la sigla e la formula stanno sotto.

6. **Leggi l'avviso ambra.**
   Atteso: «Ci sono sia esterni dichiarati a mano sia ricevimenti da fornitore: se sono le stesse persone il costo è contato due volte. …»
   Dimostra: Octo non sa se Verdi Sara e Studio Blu sono la stessa cosa: non indovina, avvisa.

7. **Scorri alla tabella «Ore e costi per persona».**
   Atteso: le tre persone, poi la riga «Fornitori 1.200,00, ricevuto dai fornitori, da NetSuite», totale 63,5 ore e 3.147,50.
   Dimostra: il totale della tabella è il «Costi a oggi» dei riquadri.

8. **Leggi «Costi secondo NetSuite».**
   Atteso: Labor (TS) 1.387,50 · Service 1.200,00 · Totale 2.587,50. Sotto: «Calcolati da Octo: 3.147,50. Scostamento da NetSuite: 560,00.»
   Dimostra: è la riga «NETSUITE» della scheda, per gruppo di costo. Lo scostamento è la persona dichiarata a mano, che NetSuite non conosce.

9. **Apri «Come sono calcolate le cifre».**
   Atteso: otto righe, una per cifra, con la regola («Fatturato: somma dell'importo delle righe fattura, note di credito comprese.»).
   Dimostra: ogni cifra dice da dove viene, una volta sola e a richiesta.

10. **Premi la scheda «Fatturazione».**
    Atteso:
    - «Al cliente»: una riga `SO-17` con 2.250,00 nel mese della fattura e nel totale. Compaiono solo i mesi con una fattura.
    - «Dai fornitori»: Ordinato 2.000,00 · Ricevuto 1.200,00, «è il costo sulla commessa» · Fatturato 1.200,00 · Da fatturare 800,00; sotto, la riga «Studio Blu Srl · PO-31 · 2.000,00 · 1.200,00 · 1.200,00».

    Dimostra: «Ciclo Attivo» e «Ciclo Passivo» della scheda. Senza ordini a fornitore il secondo blocco è una riga sola: «Nessun ordine a fornitore su questa commessa.»

## Che cosa dimostra
- Le colonne di NetSuite sono quelle della scheda: righe fattura, ordini a fornitore, ricevimenti, fatture dei fornitori, ricavi e costi mensili per gruppo.
- Niente è stimato e niente è nascosto: ciò che Octo calcola e ciò che NetSuite registra stanno uno accanto all'altro, con lo scostamento.
- Le viste nuove di NetSuite entrano anche nella lettura della fonte: «Chiedi» può rispondere su ordini e fatture dei fornitori.

## Che cosa non fa ancora
- L'avanzamento a corpo dichiarato dal PM arriva con la scheda «Mesi».
- Il FRD usa i ricavi che NetSuite ha riconosciuto; quelli calcolati da ore e tariffe arrivano con la scheda «Mesi».
- Il previsionale del mese non conta ancora i ricevimenti: lì i costi esterni restano quelli dichiarati.
- Il piano di fatturazione (le milestone previste) non c'è ancora: si vede solo il fatturato.

## Test
```bash
pnpm vitest run packages/domain/test/economics.test.ts packages/connectors/test/dwsi.test.ts apps/desktop/test/project-sheet.test.tsx
pnpm test:coverage
```
