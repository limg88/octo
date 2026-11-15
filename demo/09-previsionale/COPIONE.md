# Demo 09 — Previsionale: il modello Excel dell'amministrazione compilato dal codice

Durata: 4 minuti. Mostra il previsionale mensile: una riga per codice di progetto sul file Excel che l'amministrazione manda, con costi interni e ricavi presi dalle ore approvate dei timesheet. Ogni cifra è un calcolo del codice scritto come formula nel foglio; Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o al sistema dei timesheet: timesheet, modello, costi e tariffe sono finti (cinque persone, venti giorni lavorativi del mese scorso, tre codici di progetto).

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/09-previsionale/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Previsionale».**
   Atteso: «Il modello dell'amministrazione», con il file `Amministrazione/Previsionale avanzamenti.xlsx` già proposto e le tariffe al giorno di quattro persone.

3. **Salva.** Premi «Salva».
   Atteso: la tabella del mese scorso con tre codici. Su `PRJ000101`: costi interni 16.010,00, ricavi 27.200,00, 83 giorni. I costi nessuno li ha scritti: sono la somma del costo che ogni riga di timesheet approvata porta con sé. Su `PRJ000303`: tutto a zero e la nota «nessuna attività nel mese».
   Dimostra: le colonne del modello sono trovate dalle intestazioni, qualunque mese nominino.

4. **Leggi «Dati che mancano».**
   Atteso: manca la tariffa al giorno di Costa Elena (120 ore a costo, senza ricavo); mancano i costi totali previsti di `PRJ000101`; 16 ore non ancora approvate restano fuori; ci sono ore sul codice `PRJ000999`, che il modello non elenca.
   Dimostra: dove manca un dato niente viene stimato, e viene detto.

5. **Aggiungi la tariffa che manca, lì dove manca.** In «Dati che mancano», accanto a «manca la tariffa al giorno di Costa Elena», scrivi `400` e premi «Salva».
   Atteso: su `PRJ000101` costi interni 16.010,00, ricavi 33.200,00, margine del mese 51,78%. La riga di Costa Elena sparisce dai dati mancanti.
   Dimostra: ciò che manca si corregge dove viene detto, senza cercare la riga giusta nelle impostazioni.

6. **Dichiara l'esterno e compila il progetto a corpo.** Apri «Impostazioni del previsionale», in cima alla pagina: sotto «Esterni senza timesheet» scrivi nome `Studio Blu`, commessa `PRJ000202`, costo `300`, tariffa `500`, e premi «Salva». Poi, nella riga di `PRJ000202` della tabella, premi «Altri dati»: sotto «Ore degli esterni nel mese» scrivi nome `Studio Blu` e ore `40`, in «A corpo: costi totali a budget» scrivi `20000`. Premi «Salva i dati del mese».
   Atteso: su `PRJ000202` costi esterni 1.500,00, avanzamento 7,5%, ricavi 3.000,00 (il 7,5% dell'ordinato di 40.000).

7. **Aggiungi fatturazione e margine finale.** Nella riga di `PRJ000101` scrivi `30000` nella colonna «Da fatturare»; in «Dati che mancano» premi «Scrivi i costi di PRJ000101» e in «Costi totali previsti del progetto» scrivi `70000`. Premi «Salva i dati del mese».
   Atteso: da fatturare 30.000,00, margine finale 41,67%.
   Dimostra: i dati del mese di tutti i codici si scrivono nella tabella che li mostra e si salvano insieme.

8. **Compila il modello.** Premi «Compila il modello», accanto al mese, poi «Apri il file».
   Atteso: «Modello compilato in `_octo/previsionale/<mese>/Previsionale avanzamenti.xlsx`. L'originale non è stato toccato.» Si apre Excel: stesse colonne, stessi colori e formati del modello; nelle celle dei ricavi ci sono formule (giorni × tariffa), in quelle dei costi la somma dei costi di ogni persona, il margine è una formula del foglio, le note dicono da dove viene ogni cifra.
   Dimostra: il file è quello dell'amministrazione, non uno ridisegnato; il foglio «Istruzioni» è intatto.

## Che cosa dimostra
- Il modello resta dell'amministrazione: si scrive una copia, solo nelle celle da compilare.
- Costi e tariffe al giorno stanno nelle impostazioni nascoste di Octo del progetto, non nei testi che Claude legge.
- Stesse ore, stessi dati, stesso file: il risultato è ripetibile.

## Che cosa non fa ancora
- Non legge costi e tariffe da una griglia Excel: si scrivono una volta nelle impostazioni.
- Non legge da solo le giornate degli esterni dalla posta né gli importi da fatturare dai moduli di avanzamento: li indica il PM.
- Non compila le colonne di backlog per anno che alcuni mesi il modello aggiunge.
