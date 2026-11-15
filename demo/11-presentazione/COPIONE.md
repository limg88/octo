# Demo 11 — Presentazione: le stesse slide del tuo modello, aggiornate al periodo

Durata: 4 minuti. Mostra lo stato di avanzamento scritto sulla presentazione del periodo scorso: Octo ne legge la scaletta (ogni testo e ogni tabella di ogni slide), Claude la riempie slide per slide con i dati del periodo chiesto, il codice rimette testi e righe al loro posto. Stesse slide, stesso ordine, stessi colori; contenuti nuovi, con le fonti controllate.

## Prerequisiti
- Node 24, pnpm 12. PowerPoint, Keynote o LibreOffice per aprire il risultato.
- Nessun accesso a Claude: risponde un modello finto, sempre uguale. La presentazione del periodo scorso è finta: copertina, una slide con una tabella colorata per stato e la data dei dati, una slide dei rischi, slide finale.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/11-presentazione/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Deliverable» e scegli il modello.** In fondo al catalogo, sotto «Modello delle presentazioni», premi «Scegli una presentazione» e scegli il file `Presentazioni/Stato avanzamento - periodo scorso.pptx` del progetto di prova (il percorso è stampato nel terminale).
   Atteso: «Impostato: lo stato di avanzamento approvato esce anche come presentazione.»
   Dimostra: si fa una volta per progetto; Octo tiene una copia del modello e non tocca il tuo file.

3. **Chiedi lo stato di avanzamento.** Premi «Stato di avanzamento», in «Periodo» scrivi `Sprint 28` e premi «Scrivi la bozza».
   Atteso: la bozza è scritta slide per slide: «Slide 1», «Slide 2 — Aurora - Avanzamento — PI7» con la sua tabella, «Slide 4». «1 fonte controllata» e l'esito della rilettura critica. In «Non trovato»: i rischi del periodo non hanno una fonte, e la slide 3 del modello è stata tolta.
   Dimostra: la struttura è quella del modello, non una scaletta generica. Dove il progetto non ha dati, la slide viene tolta o la cella resta vuota, e viene detto: non resta mai un numero del periodo scorso.

4. **Approva.** Premi «Approva».
   Atteso: tre file approvati: il testo, il Word e un `.pptx`.

5. **Apri la presentazione.** Premi sul file `.pptx` fra i file approvati.
   Atteso: tre slide. La copertina; la slide «Aurora - Avanzamento — PI7» con la tabella alle sue colonne, la riga «In corso» azzurra come nel modello, la riga della data aggiornata; la slide finale («GRAZIE»). La slide dei rischi del periodo scorso non c'è.
   Dimostra: titoli, tabelle, colori di stato e numero di slide sono al loro posto; il contenuto è quello approvato, senza i richiami alle fonti.

6. **Guarda che un'email non diventa slide.** Torna al catalogo, scrivi e approva una «Email al cliente».
   Atteso: due file soltanto, testo e Word.

## Che cosa dimostra
- La scaletta la detta il modello: Claude riempie testi e tabelle con un identificativo ciascuno, in una forma guidata che regge anche con i modelli di Claude più leggeri.
- Quello che il modello dice è del suo periodo: non è mai una fonte. Ciò che non viene riscritto resta vuoto e viene segnalato.
- Una riga è disegnata come la riga del modello con lo stesso stato; una tabella troppo lunga continua su una copia della slide.
- Master, layout, tema, immagini e numeri di slide sono quelli del modello.

## Che cosa non fa ancora
- Non aggiunge slide che il modello non ha, e non ridisegna grafici: i grafici del modello restano com'erano.
- Vale per lo stato di avanzamento; gli altri tipi di deliverable escono come testo e Word.
