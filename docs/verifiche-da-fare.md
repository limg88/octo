# Verifiche da fare

Ciò che il codice non può chiudere da solo: serve il PM, il pilota, il suo PC Windows, i sistemi veri o giorni di calendario. Per ogni voce: che cosa provare, con quale comando o gesto, quale esito chiude il criterio. Finché una voce è aperta, l'incremento in `docs/roadmap.md` risulta «codice chiuso, criterio da verificare».

Regola per i dati: nessun nome, cifra o testo dei clienti entra nel repository. L'esito si scrive qui come «raggiunto» o «fallito, con il perché», senza importi.

## R1 — Economia a riepilogo

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R1.1 | Le cifre del riepilogo coincidono con NetSuite, per ogni commessa dei due progetti reali | In Octo: «Commessa» → «Sintesi», una commessa per volta. Confronta Ordinato, Fatturato, Ricavi riconosciuti e i costi per gruppo di «Costi secondo NetSuite» con la scheda progetto o con NetSuite | Per ogni commessa le quattro cifre coincidono al centesimo; dove «Costi a oggi» si scosta da NetSuite la pagina lo dice e lo scarto ha una spiegazione (ore non ancora in NetSuite, persone senza timesheet) | da fare |
| R1.2 | La vista dell'avanzamento di NetSuite è popolata per le commesse a corpo | In «Sintesi» di ogni commessa a corpo guarda la nota sotto «Avanzamento» | «da NetSuite, al …»: la vista è popolata. «da NetSuite: ricavi riconosciuti sull'ordinato»: la vista è vuota e vale il secondo passo; va scritto qui per quali commesse | da fare |
| R1.3 | L'avanzamento di NetSuite è una quota (0,4) o una percentuale (40) | Confronta la cifra di «Avanzamento» con quella della scheda progetto | Coincidono. Octo legge fino a 1 come quota e fino a 100 come percentuale: se NetSuite scrive «1» per dire 1%, la lettura è sbagliata e va corretta in `packages/connectors/src/dwsi/connector.ts` (`progressOf`) | da fare |
| R1.4 | Ogni quanto NetSuite aggiorna l'avanzamento | Guarda la data nella nota («al …») in due giorni diversi, o chiedi all'amministrazione | La frequenza è scritta qui | da fare |
| R1.5 | Il previsionale di un mese vero esce in Excel | «Commessa» → «Previsionale», scegli un mese chiuso, «Compila il modello» | Il file compilato si apre in Excel senza errori e le righe delle commesse hanno le cifre della pagina | da fare |
| R1.6 | Il piano tenuto dalla versione precedente è stato esportato, e il previsionale dà le cifre di prima | Apri «Commessa» sui due progetti reali, poi guarda `_octo/.riservato/commessa/piano-esportato.md` e, in «Previsionale», «Tariffe e costi che NetSuite non dice» | Il file c'è e contiene budget, mesi, fatture previste e anagrafica che avevi scritto; le tariffe del budget sono nella tabella; i ricavi del mese sono quelli di prima | da fare |

Non raggiunto e già misurato: **interfaccia sotto 18.700 righe**. Alla chiusura di R1 sono 18.857 (vedi «Stato» in `docs/roadmap.md`).
