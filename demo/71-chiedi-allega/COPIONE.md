# Demo 71 — «Chiedi»: allegare un file, e che cosa fa «Con calcoli»

Durata: 4 minuti. Incremento I4 di `docs/esiti-prova-deem.md`: in «Chiedi» si allega un file alla conversazione e chi risponde lo legge; «Con calcoli» sta accanto al pulsante di invio e dice che cosa fa e quando serve.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto, che risponde sempre sulla data di consegna.
- Due file di prova, da creare prima:
  ```bash
  mkdir -p .tmp/demo-71-file && echo "Da chiarire: ambiente di prova." > .tmp/demo-71-file/nota.txt && echo x > .tmp/demo-71-file/foto.heic
  ```

## Passi

1. **Avvia la demo e apri «Chiedi».**
   ```bash
   bash demo/71-chiedi-allega/run.sh
   ```
   Atteso: sotto il campo della domanda, nell'ordine: «Allega…», «Con calcoli» con una «i» accanto (solo dove Claude può calcolare nel recinto), «Chiedi».

2. **Leggi che cosa fa «Con calcoli».** Premi la «i».
   Atteso: tre righe: che cosa succede senza, che cosa succede con, quando accenderlo; sotto, che Claude scrive solo in una cartella di lavoro e che nel progetto entra solo ciò che scegli di tenere. Il comportamento dell'opzione non è cambiato.

3. **Allega un formato che Octo non legge.** «Allega…» → `.tmp/demo-71-file/foto.heic`.
   Atteso: «Non so leggere questo formato. Posso allegare Word, Excel, PowerPoint, PDF e file di testo (md, txt, csv, json).» Nulla è stato copiato.

4. **Allega un file che legge.** «Allega…» → `.tmp/demo-71-file/nota.txt`.
   Atteso: sopra il campo compare `nota.txt`.
   ```bash
   find .tmp/demo-71/Aurora/_octo/.lavori/chiedi -type f
   ```
   Atteso: `…/chiedi/<conversazione>/nota.txt`. Un Word, un Excel, un PowerPoint o un PDF avrebbero accanto anche il loro testo (`….md`), fatto con i lettori di documenti che Octo usa per il progetto.
   Dimostra: il file sta nella cartella della conversazione, dentro `_octo/.lavori/`, che non è una fonte del progetto: vale per quella conversazione soltanto.

5. **Fai una domanda.** Scrivi una domanda e premi «Chiedi».
   Atteso: la risposta arriva nella conversazione che ha l'allegato. A chi risponde Octo ha detto quali file sono allegati e che può leggerli e citarli (lo provano i test: `packages/application/test/chat-files.test.ts`, `packages/infrastructure/test/deliverables.test.ts`); una citazione di un allegato viene controllata come le altre.

## Che cosa non fa
- Con Claude finto non si vede una risposta costruita sull'allegato: va provata con Claude vero (R6c.11 in `docs/verifiche-da-fare.md`).
- Un allegato non entra fra le fonti del progetto: per quello il file va messo nella cartella del progetto.
- Con «Con calcoli» acceso Claude lavora nel recinto: se da lì un allegato non si legge, la risposta lo dice fra ciò che manca (stessa voce R6c.11).

## Verifica automatica
```bash
pnpm e2e:esiti
```
