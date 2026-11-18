# Demo 64 — Il catalogo dei deliverable in file (R4b)

Durata: 4 minuti. I dieci tipi del catalogo non sono più costanti nel codice: ogni tipo è una cartella distribuita con l'app, con che cos'è (`tipo.json`) e come si scrive (`istruzioni.md`). Il testo si corregge senza toccare il codice; ciò che il codice garantisce è che un tipo non integro non arriva mai a chi scrive.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto.
- La demo lavora su una copia del catalogo (`.tmp/demo-64/catalogo`): quello dell'app non viene toccato.

## Passi

1. **Guarda il catalogo com'è distribuito.**
   ```bash
   ls apps/desktop/resources/catalogo
   cat apps/desktop/resources/catalogo/indice.json
   ls apps/desktop/resources/catalogo/verbale
   ```
   Atteso: dieci cartelle e `indice.json` con i dieci nomi nell'ordine del catalogo; in ogni cartella `tipo.json` e `istruzioni.md`.

2. **Avvia la demo e apri «Deliverable».**
   ```bash
   bash demo/64-catalogo-in-file/run.sh
   ```
   Atteso: i dieci tipi di sempre, nello stesso ordine: «Email al cliente», «Stato di avanzamento», «Verbale di riunione», «Stima», e gli altri sei.
   Dimostra: i tipi letti dai file sono quelli che prima erano nel codice. Il 18/11/2026 sono stati confrontati uno per uno con le costanti: dieci su dieci uguali, quindi stesse istruzioni a chi scrive e stesse bozze.

3. **Scrivi un deliverable**: scegli «Email al cliente», compila i campi, «Scrivi la bozza».
   Atteso: la bozza con le fonti controllate e la rilettura critica, come nella demo 06.

4. **Chiudi Octo, correggi un tipo nella copia e riapri.**
   ```bash
   sed -i '' 's/"title": "Verbale di riunione"/"title": "Verbale della riunione"/' .tmp/demo-64/catalogo/verbale/tipo.json
   echo "- Scrivi sempre la data della riunione nella prima riga." >> .tmp/demo-64/catalogo/verbale/istruzioni.md
   KEEP=1 bash demo/64-catalogo-in-file/run.sh
   ```
   Atteso: nel catalogo il tipo si chiama «Verbale della riunione». La riga aggiunta alle istruzioni vale dalla prossima bozza.
   Dimostra: il testo di un tipo si corregge in un file, senza una nuova versione del codice.

5. **Chiudi Octo, rompi un file e riapri.**
   ```bash
   sed -i '' 's/"audience": "internal"/"audience": "tutti"/' .tmp/demo-64/catalogo/verbale/tipo.json
   KEEP=1 bash demo/64-catalogo-in-file/run.sh
   ```
   Atteso: nel terminale, all'avvio, `catalog of deliverables: … catalog_invalid: verbale: audience`. In «Deliverable»: «Il catalogo dei deliverable di Octo non è leggibile…». Nessun tipo è offerto.
   Dimostra: mezzo catalogo non viene mai mostrato, e l'errore dice quale file correggere.

## Che cosa non fa
- Correggere a parole il tipo distribuito con l'app. Le correzioni a parole del PM restano quelle di sempre, per progetto («Istruzioni per questo progetto», in `_octo/.istruzioni/`), e si aggiungono a ciò che il tipo dice.

## Prova automatica nella finestra vera
```bash
pnpm e2e:catalogo
```

## Test e copertura
```bash
pnpm test:coverage
```
