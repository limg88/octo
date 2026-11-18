# Demo 51 — Costi a budget proposti dai tetti delle persone

Durata: 3 minuti. Mostra che i costi a budget di una commessa a corpo non vanno più calcolati a mano: se le persone del progetto hanno un tetto in giornate, Octo propone il budget moltiplicando i giorni di ognuno per il suo costo orario. La proposta diventa il budget solo quando il PM lo dice.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (lo script lancia `pnpm db:setup`).
- Nessun accesso a Claude, a NetSuite o a Jira veri. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500, gli stessi dati della demo 50, senza costi a budget scritti. In «Impostazioni» → «Persone e calendario» le tre persone hanno un tetto: Rossi Mario 2 giorni, Bianchi Luca 8, Verdi Sara 1,5.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/51-previsionale-budget-dai-tetti/run.sh
   ```

2. **Apri «Commessa».**
   Atteso: «Costi a budget: non scritti: avanzamento non calcolabile» e «Margine a finire: servono i costi a budget o i costi totali previsti». Sotto: «Proposta dai tetti delle persone: 2.840,00 (Rossi Mario 2 gg, Bianchi Luca 8 gg, Verdi Sara 1,5 gg).» con il pulsante «Usa come costi a budget».
   Dimostra: 2 × 8 × 25 + 8 × 8 × 25 + 1,5 × 8 × 70 = 2.840. Il costo orario è quello dell'ultimo timesheet di ognuno; per chi non ha timesheet, quello scritto nelle impostazioni.

3. **Premi «Usa come costi a budget».**
   Atteso: «Costi a budget: 2.840,00 · avanzamento 72,54%», «Margine a finire: 62,13% · su costi previsti di 2.840,00», e la proposta dice «Sono i costi a budget in uso.»
   Dimostra: prima del clic non è stato scritto niente. Il budget è scritto dal mese d'inizio della commessa, così vale anche per i mesi passati.

4. **Passa a «Mese»** (il mese scorso).
   Atteso: avanzamento 68,57% e ricavi calcolati sull'ordinato: non c'è più la lacuna «a corpo senza costi totali a budget».
   Dimostra: lo stesso budget serve il previsionale mensile: (850 + 537,50 + 560) / 2.840.

5. **Apri «Impostazioni» → «Persone e calendario».**
   Atteso: la colonna «Tetto (giorni)» con 2, 8 e 1,5.
   Dimostra: il tetto ha un campo suo. Dove non è scritto, Octo lo legge dal ruolo se il PM lo aveva annotato lì («Analista (8 gg)»).

## Che cosa dimostra
- La proposta è un calcolo dichiarato: persone, giorni e totale si leggono sulla pagina.
- Chi ha un tetto ma nessun costo orario noto resta fuori dalla proposta, e la pagina dice chi.
- Con più commesse nel progetto la proposta non c'è: i tetti sono del progetto, non di una commessa.
- Gli stessi tetti compaiono nel cruscotto di un Jira registro attività (demo 49), in «Ore per persona»: ore registrate contro il tetto, con il segno «oltre il tetto».

## Test
```bash
pnpm vitest run packages/domain/test/team.test.ts packages/domain/test/forecast.test.ts packages/application/test/forecast.test.ts packages/application/test/dashboard.test.ts apps/desktop/test/forecast.test.tsx apps/desktop/test/dashboard.test.tsx apps/desktop/test/team.test.tsx
```
