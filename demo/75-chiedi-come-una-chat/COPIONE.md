# Demo 75 — «Chiedi» come una chat

Durata: 3 minuti. Incremento J3 della seconda prova.

## Prerequisiti
- Node 24, pnpm 12. Claude finto.

## Passi

1. **Avvia la demo e apri «Chiedi».**
   ```bash
   bash demo/75-chiedi-come-una-chat/run.sh
   ```
   Atteso: al centro il polpo, «Che cosa vuoi sapere di Aurora?», una sola scheda per scrivere e sotto le domande pronte.
2. **Una domanda pronta.** Premi «Blocchi e rischi».
   Atteso: la domanda riempie il campo, che cresce con il testo; non parte finché non la mandi.
3. **Manda.** Premi il tondo con la freccia (o Invio).
   Atteso: la tua domanda è un fumetto a destra; mentre Claude lavora il tondo diventa «Ferma». La risposta è testo libero a sinistra con la fonte accanto; sotto, in piccolo, data e modello e «Prepara un deliverable da questa risposta». La scheda è scesa in fondo e le domande pronte non ci sono più.
4. **Allega e «Con calcoli».** Nella scheda: «+» allega un file alla conversazione (compare come etichetta dentro la scheda); «Con calcoli» è una pillola che si colora quando è attiva, con la sua «i».
5. **Le conversazioni.** A sinistra una riga per conversazione, raggruppate per «Oggi», «Ieri», «Ultimi 7 giorni», «Prima». «Nuova chat» riporta alla pagina del passo 1.
   Prova automatica: `pnpm vitest run apps/desktop/test/ask.test.tsx`.
