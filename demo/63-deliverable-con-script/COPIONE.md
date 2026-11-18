# Demo 63 — Deliverable del progetto con script e modello (R4)

Durata: 5 minuti. Il modulo di avanzamento e l'allineamento dello sprint non sono più sezioni di Octo: sono deliverable del progetto. Lo script e i suoi dati sono file del progetto, Claude li esegue dentro il recinto, il PM li corregge a parole. Il modulo Excel del cliente lo compila Octo.

## Prerequisiti
- Node 24, pnpm 12, macOS. Rete solo alla prima esecuzione (interprete, vedi demo 62).
- Claude finto, che esegue davvero gli script con l'interprete incluso. Con `REAL=1` lavora Claude vero sul tuo seat, nella sandbox.
- Progetto sintetico «Aurora» che usava le due sezioni: in `_octo/.impostazioni/` ci sono `progress.json` (ordine `ORD-2026-077`, quattro posizioni, due richieste, mappa delle celle del modulo) e `alignment.json` (sprint 28).

## Passi

1. **Avvia la demo e apri «Deliverable».**
   ```bash
   bash demo/63-deliverable-con-script/run.sh
   ```
   Atteso: sotto il catalogo, «Deliverable del progetto, con script», con «Modulo di avanzamento» e «Allineamento dello sprint», ciascuno con «Aggiungi al progetto».

2. **Premi «Aggiungi al progetto» su tutti e due.**
   ```bash
   ls .tmp/demo-63/Aurora/_octo/.deliverable/avanzamento
   ```
   Atteso: `config.json`, `deliverable.json`, `istruzioni.md`, `script.py`. In `config.json` c'è l'ordine con le posizioni e le richieste.
   Dimostra: ciò che la sezione teneva in `progress.json` e `alignment.json` è diventato la configurazione dei due deliverable. I due file originali restano dove sono, intatti.

3. **«Modulo di avanzamento»: scrivi 1 in «Numero della richiesta» e premi «Esegui».**
   Atteso: «Calcolo», poi «Richiesta 1: chiesto fin qui 289540,00 su 340000,00; lo scarto dell'arrotondamento è …» e «Prodotti, nella cartella di lavoro: Richiesta stato avanzamento - 1.xlsx, quote.csv.»
   Dimostra: lo script calcola le quote; il modulo del cliente lo compila Octo, cella per cella, conservando tutto il resto del file.

4. **Premi «Salva nel progetto».**
   Atteso: «Salvati nel progetto, in _octo/deliverable/avanzamento.» Apri il file Excel: richiesta 1, ordine e posizioni, le quattro righe con le percentuali (100%, 100%, 91,23%, 0%).
   Dimostra: nel progetto entra solo ciò che salvi. Il modulo vuoto in `Moduli/` non è stato toccato.

5. **«Allineamento dello sprint»: premi «Esegui», poi «Salva nel progetto».**
   Atteso: «Sprint «Sprint 28»: 6 voci, … senza ticket.» In `_octo/deliverable/allineamento/` ci sono `mancanti_sprint-28.csv` (da importare a mano nel tracker interno) e `allineamento.md` (le liste).
   Dimostra: voci e ticket li prepara Octo con gli stessi lettori del Cruscotto; lo script confronta.

6. **Correggi a parole.** Apri «Correggi a parole» nell'allineamento, scrivi `sprint=Sprint 27` (con Claude vero: «passa allo sprint 27») e premi «Prova la correzione».
   Atteso: «Correzione proposta», con ciò che Claude ha cambiato, «File cambiati: config.json, istruzioni.md.» e ciò che lo script dice ora. Nel progetto non è cambiato ancora nulla.

7. **Premi «Approva la correzione».**
   Atteso: «Correzione approvata: da ora ogni esecuzione usa i file nuovi.» `config.json` nel progetto ha lo sprint 27.
   Dimostra: una correzione a parole diventa una regola del progetto senza una nuova versione di Octo, e solo dopo l'approvazione.

## Stesso risultato delle sezioni
Gli script sono confrontati con le funzioni delle due sezioni: stesse quote, stesse celle del modulo, stesse liste, stesso file dei ticket mancanti. Sui dati sintetici (anche duecento ordini generati) nel test `apps/desktop/test/scripted-parity.test.ts`; su una copia della configurazione reale il 18/11/2026, prima di togliere le sezioni.

## Che cosa non dimostra
- Una richiesta reale e un deliverable prodotto dalla collega: `docs/verifiche-da-fare.md`, R4.
- I controlli con le fatture di NetSuite e i titoli simili proposti, che le sezioni avevano: non sono negli script.

## Prova automatica nella finestra vera
```bash
pnpm e2e:script
```

## Test e copertura
```bash
pnpm test:coverage
```
