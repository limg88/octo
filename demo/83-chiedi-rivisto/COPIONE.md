# Demo 83 — «Chiedi» rivisto: una sola fonte in vista per tutta la chat

Durata: 4 minuti. Sesto incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavole `D06`, `D07`).

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora» e Claude finto: nulla esce dal computer.

## Passi

1. **Avvia la demo e apri «Chiedi».**
   ```bash
   bash demo/83-chiedi-rivisto/run.sh
   ```
   Atteso: «Nuova chat» è un pulsante normale, non pieno; le quattro domande pronte sotto il campo sono pulsanti normali; l'unico elemento pieno è il tondo che invia, quando hai scritto qualcosa.
2. **Fai una domanda.** Scrivi `Quando consegniamo il modulo ordini?` e premi Invio.
   Atteso: la risposta occupa la colonna del testo; a destra, un solo riquadro «Fonte citata» largo 320 px. Sotto la risposta, su una riga: «Fonti · 1», l'elenco delle fonti e, a destra, «Prepara un deliverable da questa risposta». Il richiamo `1` nel testo ha un anello viola: è quello in vista.
3. **Fai una seconda domanda.** Scrivi `E il budget? #inventa` e premi Invio.
   Atteso: fra le due risposte c'è una riga sottile. Il riquadro a destra è sempre uno solo e passa alla risposta nuova: in alto dice «Richiamo in vista: [1] della risposta 2 di 2.»
4. **Scegli un richiamo della prima risposta.** Scorri in su e premi il richiamo `1` della prima.
   Atteso: l'anello passa a quel richiamo e il riquadro dice «Richiamo in vista: [1] della risposta 1 di 2.»; scorrendo la chat il riquadro resta fermo.
   Dimostra: la fonte di ciò che stai leggendo è sempre nello stesso posto, e si sa sempre di quale risposta è.
5. **Il richiamo non riscontrato.** Premi il richiamo `2` della seconda risposta.
   Atteso: richiamo in ambra, e nel riquadro «La frase non è nel file».
6. **Stringi la finestra** sotto 1.120 px.
   Atteso: «Fonte citata» va sotto la conversazione, a tutta larghezza.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/ask.test.tsx
```
