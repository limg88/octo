# Demo 44 — Previsionale di un progetto a corpo: il tipo lo dice NetSuite

Durata: 4 minuti. Mostra che per un progetto venduto a corpo il PM non deve spiegare niente a Octo: il tipo di vendita e l'ordinato arrivano da NetSuite (la riga d'ordine ha la voce `PROG-CORPO`), e la pagina non chiede le tariffe al giorno, che servono solo a chi vende giornate.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Timesheet finti del mese scorso sulla commessa `PRJ000101`, che in NetSuite ha un ordine `PROG-CORPO` da 40.000.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/44-previsionale-a-corpo/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora». NetSuite è già collegato in «Impostazioni», con la commessa `PRJ000101`.

2. **Apri «Previsionale».** Non premere niente.
   Atteso: la riga `PRJ000101`; passando il puntatore sul codice compare «Assessment WSO2 ESB · A corpo». Ordinato 40.000,00. Costi interni 16.010,00, ricavi 0,00.
   Dimostra: nome, ordinato e tipo sono stati letti da NetSuite da soli, la prima volta che la commessa è comparsa. Nessuno ha scelto «A corpo».

3. **Leggi «Dati che mancano».**
   Atteso: «PRJ000101: a corpo senza costi totali a budget, avanzamento e ricavi restano a zero». Nessuna riga chiede tariffe: per una commessa a corpo la tariffa al giorno non serve.

4. **Apri «Impostazioni del previsionale».**
   Atteso: nella tabella «Commesse del progetto» `PRJ000101` è «A corpo» con ordinato `40000`. Al posto della tabella «Tariffe al giorno» c'è la frase «Nessuna commessa di questo progetto è venduta a giornate: le tariffe al giorno non servono. I ricavi vengono dall'ordinato.»
   Dimostra: la pagina mostra solo ciò che serve al tipo di vendita del progetto.

5. **Scrivi i costi a budget.** Nella riga di `PRJ000101` premi «Altri dati».
   Atteso: i primi campi sono «A corpo: costi totali a budget…» e «Costi totali previsti…»; le ore degli esterni vengono dopo. Scrivi `32000` nei costi a budget e premi «Salva i dati del mese».
   Atteso: avanzamento 50,03%, ricavi 20.012,50 (il 50,03% dell'ordinato di 40.000); sotto la riga, come è stato calcolato.
   Dimostra: per un corpo il ricavo del mese è la quota di ordinato che i costi sostenuti sono dei costi a budget.

6. **Correggi il tipo, se NetSuite sbaglia.** In «Impostazioni del previsionale» porta `PRJ000101` su «A giornate (T&M)».
   Atteso: ricompare subito la tabella «Tariffe al giorno». Premi «Salva», poi «Leggi ordinato da NetSuite»: il tipo resta «A giornate (T&M)».
   Dimostra: NetSuite decide solo la prima volta; dopo vale ciò che ha scelto il PM. Riporta la commessa su «A corpo» e salva.

## Che cosa dimostra
- Un progetto a corpo si riconosce da solo: voce `PROG-CORPO` nell'ordine → «A corpo»; voce `SERVPRO` → «A giornate». Una voce che Octo non conosce non cambia niente.
- Se NetSuite non è collegato o non risponde, la pagina si apre lo stesso e non mostra errori: il pulsante «Leggi ordinato da NetSuite» resta per chiederlo a mano e sapere perché non va.
- Le tariffe già scritte non si perdono quando non vengono mostrate.

## Che cosa non fa ancora
- I costi a budget li scrive il PM: Octo non li propone dal conto economico d'offerta.
- I ricavi non sono quelli riconosciuti in NetSuite: sono calcolati dall'avanzamento dei costi, e il PM può sempre correggerli.
- Il canone non ha una voce d'ordine nota: resta da scegliere a mano.
