# Demo 74 — Colonne da trascinare, logo in tema scuro, deliverable in scrittura

Durata: 4 minuti. Incremento J2 della seconda prova.

## Prerequisiti
- Node 24, pnpm 12. Claude finto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/74-colonne-logo-in-scrittura/run.sh
   ```
2. **Tema scuro.** In alto a sinistra premi la luna.
   Atteso: il polpo sta su una tessera chiara e si legge. Torna al sole quando vuoi.
3. **Trascina una colonna.** «Commessa» → «Sintesi». Porta il mouse sul bordo destro di un'intestazione qualsiasi (un filo sottile la chiude): il filo diventa viola e il cursore cambia. Trascina.
   Atteso: si allarga solo quella colonna; le altre restano come sono e, se serve, la tabella scorre di lato. Cambia sezione e torna: la larghezza è rimasta. Doppio clic sul bordo: tornano le larghezze di Octo.
   Dimostra: vale per tutte le tabelle (Sintesi, Fatturazione, Cruscotto, previsionale, tabelle dei calcoli), non solo per alcune.
4. **Un deliverable in scrittura resta in elenco.** «Deliverable» → «Email al cliente» → scrivi `Collaudo` nel primo campo → «Scrivi la bozza» e subito «Nuovo deliverable».
   Atteso: nella colonna a sinistra, in testa, «Email al cliente · In scrittura…». Premilo: torni al modulo con i campi com'erano. Quando la bozza arriva la voce diventa il deliverable.
5. **Glossario anche su note e riepilogo.** Le coppie del glossario ora correggono anche `notes.md` e `report.md` delle riunioni; «Leggi ora» sulle riunioni le riapplica a quelle già lette.
   Prova automatica: `pnpm vitest run packages/application/test/meetings.test.ts apps/desktop/test/tables.test.tsx`.
