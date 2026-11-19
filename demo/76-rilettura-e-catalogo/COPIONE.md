# Demo 76 — Rilettura critica di poche righe, catalogo che dice che cosa fa

Durata: 4 minuti. Incremento J4 della seconda prova.

## Prerequisiti
- Node 24, pnpm 12. Claude finto: con `#inventa` nel testo la rilettura trova un rilievo.

## Passi

1. **Avvia la demo e guarda il catalogo.** «Deliverable».
   ```bash
   bash demo/76-rilettura-e-catalogo/run.sh
   ```
   Atteso: fra i tipi c'è «Storia con criteri di accettazione» (era «Voce di backlog»). Sotto, a parte, «Memoria del progetto» con una riga che dice a che cosa servono le tre pagine: «fatti correnti», «decisioni e regole del PM», «cronologia del progetto».
2. **Scrivi una bozza con un rilievo.** «Email al cliente» → nel primo campo `Collaudo #inventa` → «Scrivi la bozza».
   Atteso: a destra «Rilettura»: il verdetto in una riga, poi un rilievo per riga con la gravità in piccolo («GRAVE Il budget non ha una fonte») e sotto due parole: «Visto» e «Correggi».
3. **Apri il rilievo.** Clic sulla riga.
   Atteso: si aprono il passo citato e, se aggiunge qualcosa, il perché. «Che cosa regge» non c'è più; «Da controllare prima di approvare» è una riga che si apre.
4. **Correggi solo quel passo.** «Correggi» → scrivi `Togli la cifra` → «Riscrivi solo questo passo».
   Atteso: cambia solo quella frase; la rilettura torna «Può uscire».
   Dimostra: a Claude sono chiesti al massimo 5 rilievi di 12 parole; Octo ne mostra comunque al massimo 5, i più gravi per primi.
   Prova automatica: `pnpm vitest run apps/desktop/test/deliverables.test.tsx`.
