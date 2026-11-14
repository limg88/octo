# Demo 01 — App e Chiedi

Durata: 3 minuti. Mostra che l'app si apre, legge una cartella di progetto e risponde citando i file, con ogni citazione controllata dal codice.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude: la demo usa un modello finto, senza rete. Con `REAL=1` usa Claude Code sul tuo seat.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/01-app-e-chiedi/run.sh
   ```
   Atteso: si apre la finestra di Octo con il progetto «Aurora» già in elenco. In basso a sinistra c'è la versione di Claude (`9.9.9 (Fake Claude)` con il modello finto).

2. **Fai una domanda.** Scrivi `Quando consegniamo il modulo ordini?` e premi Invio.
   Atteso: mentre lavora, una riga dice che cosa sta leggendo. Poi compare la risposta con l'etichetta verde «1 fonte controllata» e, sotto «Fonti», il file `wiki/stato.md` con la frase citata e la data del file.
   Dimostra: la risposta arriva con fonte e data, e il codice ha trovato la frase nel file.

3. **Apri la fonte.** Fai clic su `wiki/stato.md`.
   Atteso: il file si apre con il programma predefinito del computer.

4. **Fai inventare un dato al modello finto.** Scrivi `E il budget? #inventa`.
   Atteso: etichetta arancione «1 punto da controllare». La seconda fonte è marcata «La frase non è nel file».
   Dimostra: un dato che il modello non ha letto non viene nascosto né corretto: resta visibile e segnalato.

5. **Chiudi e riapri.** Chiudi la finestra e rilancia il comando del passo 1 con `KEEP=1`:
   ```bash
   KEEP=1 bash demo/01-app-e-chiedi/run.sh
   ```
   Atteso: le due domande sono ancora nella conversazione.
   Dimostra: lo storico resta sul computer, nella cartella dati dell'app e non nella cartella del progetto.

## Con Claude vero
```bash
REAL=1 bash demo/01-app-e-chiedi/run.sh
```
Chiedi `Quando consegniamo, quanto budget resta e chi è il responsabile?`. Atteso: due fonti controllate e, sotto «Non trovato», il responsabile. Consuma quota del tuo seat.

## Senza interfaccia
`pnpm e2e` esegue i passi 1, 2, 4 e 5 nella finestra vera e stampa `e2e: ok`.
