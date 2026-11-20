# Demo 79 — «Oggi» rivista: una riga per cosa, le riunioni dentro «Adesso»

Durata: 5 minuti. Secondo incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavola `tavole/OggiDopo.html`).

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora», posta finta e Claude finto: nulla esce dal computer.

## Passi

1. **Avvia la demo e leggi la giornata.**
   ```bash
   bash demo/79-oggi-rivista/run.sh
   ```
   In «Oggi» premi «Leggi ora».
   Atteso, dall'alto: l'avviso sul tracker, «Il punto», «Adesso», «Da fare oggi», «Criticità della settimana», «Da tenere d'occhio», la valutazione di Claude.
   Dimostra: prima ciò che si fa oggi, poi ciò che arriva. «Riunioni di oggi» non è più una sezione.
2. **«Il punto» vuoto è una riga.**
   Atteso: «Il punto · Nessun open point in coda · Claude non ha ancora letto le riunioni…», «Aggiungi» e «Chiudi la giornata». Niente «Riduci», niente campi.
   Premi «Aggiungi»: compare il modulo; scrivi «Verbale del collaudo» e premi «Aggiungi».
   Atteso: il punto è in coda, il modulo si richiude e ora c'è «Riduci».
3. **La riunione è una riga di «Adesso».**
   Atteso: «Fra 40 minuti», orario e titolo in grassetto, luogo e persone in grigio, «Riunioni» in blu, «2 cose da portare», «Apri l'invito». La riunione non compare una seconda volta.
   Premi «2 cose da portare».
   Atteso: la scheda si apre sotto la riga; la mail di Carla Bianchi ha un solo «Apri la mail»: ciò che Claude dice di portare su quella mail non la cita di nuovo.
4. **Il dettaglio di «Da fare oggi».** È scelta «Ottobre 2026: le ore di 3 persone non tornano».
   Atteso: a destra, largo 440 px, una tabella Persona / Timesheet / Tracker (160 ore e 80 ore; «nessuna», «nessuno» in grigio). «Apri «Ore»» pieno, «Fatto» normale accanto; «Rimanda», «Segna come open point», «Non mi interessa» su una riga.
5. **Le criticità.**
   Atteso: un solo riquadro con «In corso» e «In arrivo»; ogni riga ha data, titolo con la nota in grigio, categoria, azione a destra. «I dati del tracker sono di 5 giorni fa» è solo nell'avviso in cima, non anche qui.
6. **«Da tenere d'occhio» e la valutazione.**
   Atteso: righe uniche con «Apri…» e «×»; la valutazione su due righe, con «Impostazioni di «Oggi»» a destra dei dettagli.
7. **Stringi la finestra** sotto 1.120 px, poi sotto 1.040.
   Atteso: il dettaglio va sotto l'elenco a tutta larghezza; poi dalle criticità sparisce la colonna della categoria.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/today.test.tsx
```
