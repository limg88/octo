# Demo 59 — «Commessa»: budget, mesi, piano di fatturazione, dati

Durata: 5 minuti. Le parti della scheda progetto che si scrivono a mano entrano in «Commessa»: il budget per riga e per mese, i mesi come sono andati e come li ripianifichi, le fatture che prevedi di emettere, l'anagrafica, e la tabella «Dati» per l'amministrazione.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500: due mesi fa 34 ore di Rossi Mario, il mese scorso 21,5 ore di Bianchi Luca, entrambi a 25 euro l'ora; Verdi Sara dichiarata come esterna; un ordine al fornitore «Studio Blu Srl» con 1.200 consegnati il mese scorso.
- I mesi della demo sono relativi a oggi: «due mesi fa», «mese scorso», «mese in corso».

## Passi

1. **Avvia la demo e apri «Commessa».**
   ```bash
   bash demo/59-commessa-budget-e-mesi/run.sh
   ```
   Atteso: quattro schede sotto il titolo: «Sintesi», «Budget», «Mesi», «Fatturazione».

2. **Apri «Budget».**
   Atteso: «Non c'è ancora un budget per questa commessa.», l'avviso «Hanno ore nei timesheet e nessuna riga a budget: Bianchi Luca, Rossi Mario.» e il pulsante pieno «Parti dalla proposta».

3. **Premi «Parti dalla proposta».**
   Atteso: una griglia con i dodici mesi dell'anno. In «Risorse interne» Bianchi Luca e Rossi Mario, con «oggi 25,00» nel costo unitario; in «Risorse esterne» Verdi Sara (costo 70,00) e Studio Blu Srl. Nessuna quantità.
   Dimostra: la proposta viene da ciò che Octo già sa (timesheet, esterni dichiarati, ordini a fornitore). Le quantità le decide il PM. Un campo vuoto con un valore in grigio usa quel valore: «oggi 25,00» è il costo orario di oggi della persona, «in uso …» è ciò che era già scritto nel previsionale.

4. **Scrivi il budget.** Tariffa 60 per Bianchi Luca e per Rossi Mario; 40 ore a Rossi Mario due mesi fa; a Bianchi Luca 24 ore il mese scorso e 16 nel mese in corso; costo unitario 50 e 24 ore il mese scorso per Studio Blu Srl.
   Atteso: «Modifiche non salvate: i totali si aggiornano al salvataggio.» e «Salva» diventa il pulsante pieno.

5. **Premi «Salva».**
   Atteso: «Salvato.» In fondo alla griglia la fascia «Budget»: Ricavi 2.400,00 · 1.440,00 · 960,00, totale 4.800,00; Costi 1.000,00 · 1.800,00 · 400,00, totale 3.200,00; Margine totale 33,33%.
   Dimostra: quantità × tariffa e quantità × costo, come nel foglio «Budget» della scheda.

6. **Premi «Conferma il budget».**
   Atteso: «Budget confermato il …» con «Riapri». Il costo unitario delle due persone ora è scritto: 25.
   Dimostra: da qui il budget non segue più il costo orario di oggi. «Riapri» chiede conferma.

7. **Apri «Mesi».**
   Atteso: «Actual fino a [mese scorso] … Forecast da [mese in corso] …». Tre riquadri: Actual 22,3% (ricavi 3.330,00 · costi 2.587,50), Forecast 58,33% (ricavi 960,00 · costi 400,00), A finire 30,36% (ricavi 4.290,00 · costi 2.987,50).
   Nella griglia: Rossi Mario 34 due mesi fa e Bianchi Luca 21,5 il mese scorso, non modificabili; nel mese in corso un campo con 16 in grigio, il budget.
   In fondo: «Calcolato», «NetSuite» (ricavi 3.000,00 e 2.250,00; costi 850,00 e 1.737,50), «Scostamento dal budget», «Avanzamento» con la riga «Avanzamento dichiarato (%)».
   Dimostra: i mesi chiusi vengono dai timesheet, quelli a venire dal piano; i costi calcolati coincidono con quelli di NetSuite mese per mese.

8. **Ripianifica.** Scrivi 24 al posto di 16 per Bianchi Luca nel mese in corso e 80 in «Avanzamento dichiarato» del mese scorso; premi «Salva».
   Atteso: Forecast e A finire cambiano; nella riga «Avanzamento» il mese scorso dice 80%.
   Dimostra: l'avanzamento è quello dichiarato quando c'è, altrimenti costi a oggi su costi totali.

9. **Apri «Fatturazione».** In «Piano di fatturazione» scrivi `SO-17`, il mese in corso (per esempio `2026-11`) e 5.250; premi «Salva il piano».
   Atteso: la tabella «Pianificato e fatturato per mese»: due mesi fa pianificato 0,00, fatturato 2.250,00; mese in corso pianificato 5.250,00, fatturato 0,00.
   Dimostra: il piano accanto a ciò che NetSuite ha fatturato. Un mese scritto male è segnalato sotto la riga.

10. **Torna a «Sintesi».**
    Atteso: «Costi a budget» 3.200,00; «Margine a finire» calcolato sui costi a oggi più quelli pianificati. Sotto «Copia per mail» c'è «Esporta i dati».

11. **Premi «Esporta i dati», poi «Apri il file».**
    Atteso: «Dati scritti in _octo/commessa/PRJ000101/Dati AAAA-MM-GG.csv.» Il file ha una riga per voce (ricavi, costi interni, esterni, prodotti, giornate) di «BUDGET» e di «ACTUAL-FORECAST», con anno precedente, dodici mesi, anno successivo, costo e ricavo.
    Dimostra: è il formato del foglio «Dati» della scheda.

12. **Apri «Anagrafica della commessa»** in cima alla pagina, scrivi il commerciale e premi «Salva l'anagrafica».
    Atteso: «Salvato.»

13. **Apri «Previsionale» › «Impostazioni del previsionale».**
    Atteso: le tabelle «Tariffe al giorno», «Esterni senza timesheet» e «Persone senza timesheet, a costo orario» non ci sono più. Al loro posto: «Tariffe e costi di persone ed esterni si scrivono nel budget della commessa: il previsionale li legge da lì. …» e il pulsante «Apri «Commessa»».
    Dimostra: tariffe e costi hanno un posto solo. Il previsionale del mese usa la tariffa e il costo della riga di budget; ciò che era scritto nelle impostazioni prima continua a valere finché il budget non dice altro.

## Che cosa dimostra
- Budget, actual, forecast e scostamenti seguono le formule della scheda progetto.
- Ciò che si scrive resta fra una scheda e l'altra finché non si salva; un valore che non è un numero blocca il salvataggio e lo dice.
- Niente è stimato: chi ha ore e nessuna riga è detto, una riga senza costo è detta.

## Che cosa non fa
- Quando nel previsionale manca una tariffa o il costo di un esterno, il rimedio accanto alla riga di «Dati che mancano» c'è ancora: scrive il valore di partenza, che il budget mostra come «in uso» e può cambiare.
- Il previsionale del mese legge dal budget tariffe e costi, non le quantità: i costi esterni del mese restano le ore dichiarate, non i ricevimenti.
- Le righe di prodotto non hanno ancora la competenza da data a data: si scrive la quantità mese per mese.

## Test
```bash
pnpm vitest run packages/domain/test/plan.test.ts packages/application/test/forecast.test.ts apps/desktop/test/project-sheet.test.tsx
pnpm test:coverage
```
