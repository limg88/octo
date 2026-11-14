# Demo 11 — Presentazione: lo stato di avanzamento approvato diventa slide sul tuo modello

Durata: 4 minuti. Mostra lo stato di avanzamento scritto come deliverable (fonti controllate, rilettura critica, approvazione) e reso dal codice come presentazione PowerPoint sulla presentazione del periodo scorso: stessa copertina, stesso layout, stesso aspetto delle tabelle.

## Prerequisiti
- Node 24, pnpm 12. PowerPoint, Keynote o LibreOffice per aprire il risultato.
- Nessun accesso a Claude: risponde un modello finto, sempre uguale. La presentazione del periodo scorso è finta (copertina, due slide di contenuto, slide finale).

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
   Atteso: la bozza con le sezioni (sintesi, avanzamento per obiettivo, prossimi passi, rischi, decisioni), «1 fonte controllata» e l'esito della rilettura critica.

4. **Approva.** Premi «Approva».
   Atteso: tre file approvati: il testo, il Word e un `.pptx`.

5. **Apri la presentazione.** Premi sul file `.pptx` fra i file approvati.
   Atteso: sette slide. La prima è la copertina del modello, l'ultima la sua slide finale («GRAZIE»). In mezzo, una slide per sezione: titolo con il carattere del modello, righe di testo o tabella nello stesso punto e con lo stesso stile della tabella del modello. Le slide del periodo scorso non ci sono più.
   Dimostra: il contenuto è quello approvato, parola per parola; l'impaginazione è la tua.

6. **Guarda che un'email non diventa slide.** Torna al catalogo, scrivi e approva una «Email al cliente».
   Atteso: due file soltanto, testo e Word.

## Che cosa dimostra
- Le slide non sono scritte da Claude: il codice impagina il testo approvato, sempre allo stesso modo.
- Master, layout, tema e immagini sono quelli del modello.
- Una sezione troppo lunga continua su una slide successiva con lo stesso titolo e il numero.

## Che cosa non fa ancora
- La copertina, se non ha un titolo da riempire, resta quella del modello: periodo e data vanno aggiornati a mano.
- Non disegna slide «a cruscotto» con forme e indicatori: solo titolo, righe e tabelle.
- Vale per lo stato di avanzamento; gli altri tipi di deliverable escono come testo e Word.
