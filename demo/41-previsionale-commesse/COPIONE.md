# Demo 41 — Previsionale: solo le commesse del progetto, calcolate da NetSuite e dalle tariffe

Durata: 5 minuti. Mostra che il previsionale mensile contiene solo i codici NetSuite gestiti nel progetto (quelli indicati in «Ore»), non tutti quelli del PM, e che costi e ricavi li calcola da solo: costi dalle righe di timesheet approvate, ricavi secondo il tipo della commessa (a giornate, a corpo, canone). Il PM può sempre correggere ricavi e importo da fatturare e scrivere una nota. Il file Excel dell'amministrazione è facoltativo.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o a NetSuite: timesheet, ordinato e tariffe sono finti (cinque persone, venti giorni lavorativi del mese scorso). Tre commesse del progetto: `PRJ000101` a giornate, `PRJ000202` a corpo, `PRJ000303` a canone. Il modello Excel elenca anche `PRJ000404`, di un altro PM.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/41-previsionale-commesse/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Previsionale».**
   Atteso: subito la tabella del mese scorso, senza indicare alcun file Excel, con tre righe: `PRJ000101`, `PRJ000202`, `PRJ000303`. Nessuna riga per `PRJ000404`.
   Dimostra: le righe sono le commesse indicate in «Ore» per questo progetto, non l'elenco del modello dell'amministrazione.

3. **Leggi la commessa a giornate.** Riga `PRJ000101`.
   Atteso: costi interni 16.010,00, ricavi 27.200,00, 83 gg; sotto la riga «timesheet approvati: … h = … gg».
   Dimostra: i costi sono la somma del costo che NetSuite scrive su ogni riga approvata; i ricavi sono giorni per tariffa.

4. **Leggi la commessa a canone.** Riga `PRJ000303`.
   Atteso: ricavi 1.250,00, quantità 8,33%, nota «canone: ordinato in 12 rate mensili», senza alcuna ora.
   Dimostra: il canone è l'ordinato (15.000) in rate mensili uguali.

5. **Leggi «Dati che mancano».**
   Atteso: manca la tariffa di Costa Elena su `PRJ000101`; `PRJ000202` è a corpo senza costi totali a budget; ore approvate su `PRJ000999`, che non è di questo progetto.
   Dimostra: dove manca un dato niente viene stimato, e viene detto.

6. **Completa la commessa a corpo.** Nella riga di `PRJ000202` della tabella premi «Calcolo e dettagli»: sotto «Ore degli esterni nel mese» scrivi nome `Studio Blu` e ore `40`, in «A corpo: costi totali a budget» scrivi `20000`. Premi «Salva i dati del mese». In «Dati che mancano» compare «mancano costo e tariffa dell'esterno Studio Blu»: scrivi lì accanto costo `300` e tariffa `500` e premi «Salva». (Dalla demo 59 costo e tariffa si scrivono anche nel budget della commessa, in «Commessa» › «Budget»: le impostazioni del previsionale non hanno più le tabelle delle tariffe.)
   Atteso: costi esterni 1.500,00, avanzamento 7,5%, ricavi 3.000,00 (il 7,5% dell'ordinato di 40.000). I costi a budget valgono anche per i mesi dopo: l'avanzamento è cumulato e il ricavo del mese è la differenza con il mese prima.

7. **Correggi da PM.** Nella riga di `PRJ000101` scrivi `30000` in «Ricavi corretti» e `28000` in «Da fatturare»; premi «+ Aggiungi una nota», nella finestra scrivi `SAL concordato con il cliente` e premi «Salva la nota»: si salvano la nota e gli altri dati del mese. Nella riga la nota ha due icone: la matita la modifica, il cestino la elimina. Passa il puntatore sul codice: compare il nome della commessa («Sviluppo a giornate · A giornate (T&M)»).
   Atteso: ricavi 30.000,00, da fatturare 28.000,00; sotto la riga «ricavi indicati dal PM · SAL concordato con il cliente».
   Dimostra: ricavi, importo da fatturare e nota si correggono sempre, per qualunque tipo di commessa.

8. **Guarda tipo e ordinato.** Apri «Impostazioni del previsionale», tabella «Commesse del progetto».
   Atteso: una riga per commessa con tipo, ordinato e mesi del canone. Il pulsante «Leggi ordinato da NetSuite» aggiorna nome e ordinato dal warehouse; qui NetSuite non è collegato e lo dice.

9. **(Facoltativo) Compila il modello Excel.** Nelle impostazioni il file `Amministrazione/Previsionale avanzamenti.xlsx` è già proposto: premi «Salva», poi «Compila il modello Excel» e «Apri il file».
   Atteso: una copia in `_octo/previsionale/<mese>/` con compilate solo le righe delle tre commesse; la riga di `PRJ000404` resta com'era; l'originale non è toccato.

## Che cosa dimostra
- Il previsionale è del progetto: solo i codici NetSuite che il progetto gestisce.
- Costi e ricavi mensili sono calcolati da ore e costi di NetSuite e dalle tariffe, per tre tipi di commessa.
- Il PM ha l'ultima parola su ricavi, importo da fatturare e nota.

## Che cosa non fa ancora
- Non compila le colonne Backlog (competenza ricavi per anno) del modello di ottobre.
- Un codice che il modello elenca su più righe (una per ordine) viene compilato solo sulla prima.
- Il canone non conosce inizio e fine: la rata vale per ogni mese guardato, finché il PM non la corregge.
