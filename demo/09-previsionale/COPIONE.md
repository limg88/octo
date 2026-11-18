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
   Atteso: subito la tabella del mese scorso con i tre codici del progetto (quelli indicati in «Ore»), senza indicare alcun file.

3. **Leggi la tabella.**
   Atteso: su `PRJ000101` costi interni 16.010,00, ricavi 27.200,00, 83 giorni. I costi nessuno li ha scritti: sono la somma del costo che ogni riga di timesheet approvata porta con sé. Su `PRJ000303`, a canone: ricavi 1.250,00 e la nota «canone: ordinato in 12 rate mensili».
   Dimostra: le righe sono le commesse del progetto, ciascuna calcolata secondo il suo tipo.

4. **Leggi «Dati che mancano».**
   Atteso: manca la tariffa al giorno di Costa Elena (120 ore a costo, senza ricavo); mancano i costi totali previsti di `PRJ000101`; 16 ore non ancora approvate restano fuori; ci sono ore sul codice `PRJ000999`, che non è di questo progetto.
   Dimostra: dove manca un dato niente viene stimato, e viene detto.

5. **Aggiungi la tariffa che manca, lì dove manca.** In «Dati che mancano», accanto a «manca la tariffa al giorno di Costa Elena», scrivi `400` e premi «Salva».
   Atteso: su `PRJ000101` costi interni 16.010,00, ricavi 33.200,00, margine del mese 51,78%. La riga di Costa Elena sparisce dai dati mancanti.
   Dimostra: ciò che manca si corregge dove viene detto, senza cercare la riga giusta nelle impostazioni.

6. **Dichiara l'esterno e compila il progetto a corpo.** Nella riga di `PRJ000202` della tabella premi «Calcolo e dettagli»: sotto «Ore degli esterni nel mese» scrivi nome `Studio Blu` e ore `40`, in «A corpo: costi totali a budget» scrivi `20000`. Premi «Salva i dati del mese». In «Dati che mancano» compare «mancano costo e tariffa dell'esterno Studio Blu»: scrivi lì accanto costo `300` e tariffa `500` e premi «Salva». (Dalla demo 59 costo e tariffa si scrivono anche nel budget della commessa, in «Commessa» › «Budget»: le impostazioni del previsionale non hanno più le tabelle delle tariffe.)
   Atteso: su `PRJ000202` costi esterni 1.500,00, avanzamento 7,5%, ricavi 3.000,00 (il 7,5% dell'ordinato di 40.000).

7. **Aggiungi fatturazione e margine finale.** Nella riga di `PRJ000101` scrivi `30000` nella colonna «Da fatturare»; in «Dati che mancano» premi «Scrivi i costi di PRJ000101» e in «Costi totali previsti del progetto» scrivi `70000`. Premi «Salva i dati del mese».
   Atteso: da fatturare 30.000,00, margine finale 41,67%.
   Dimostra: i dati del mese di tutti i codici si scrivono nella tabella che li mostra e si salvano insieme.

8. **Compila il modello.** Premi «Compila il modello Excel», accanto al mese, poi «Apri il file».
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
- Le righe del modello di commesse che non sono del progetto restano come sono.
