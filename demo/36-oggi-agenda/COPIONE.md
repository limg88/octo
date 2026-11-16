# Demo 36 — «Oggi»: le riunioni del giorno, anche quelle ricorrenti

Durata: 4 minuti. Incremento E di `docs/oggi-pianificazione.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Nella posta finta ci sono quattro inviti: lo stand-up (ogni giorno) e il SAL settimanale, chiamati tre settimane fa; la prova generale del collaudo di oggi; il comitato del prossimo giorno lavorativo.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/36-oggi-agenda/run.sh
   ```
   Atteso: Octo si apre su «Aurora», sezione «Oggi».

2. **Leggi la posta.** Premi «Leggi ora» e attendi la fine della lettura.
   Atteso: sotto gli avvisi compare il riquadro «Riunioni di oggi · 3 riunioni», in ordine d'orario:
   - «09:30–09:45 Aurora: stand-up», con l'etichetta «ricorrente»;
   - «11:00–12:00 Aurora: SAL settimanale», «ricorrente»;
   - «15:00–16:00 Aurora: prova generale del collaudo».

   Dimostra: lo stand-up e il SAL sono stati invitati una volta sola, tre settimane fa, e compaiono oggi perché Octo segue la regola dell'invito («ogni giorno», «ogni settimana»). Prima di questo incremento si vedeva solo la prova generale.

3. **Chi c'è.** Guarda la riga sotto il titolo di ogni riunione.
   Atteso: per lo stand-up «Teams · Carla Bianchi, Paola Verdi, Luca Neri e altre 3 persone»; per il SAL «Teams · Carla Bianchi, Paola Verdi, Luca Neri».
   Dimostra: luogo e partecipanti vengono dall'invito; oltre i primi tre si conta.

4. **Le riunioni già finite.** Secondo l'ora in cui fai la demo, le riunioni già concluse hanno l'etichetta «finita» e il titolo in grigio.
   Dimostra: a colpo d'occhio si vede che cosa resta della giornata.

5. **Il prossimo giorno lavorativo.** Guarda l'ultima riga del riquadro.
   Atteso: «Prossimo giorno (gg/mm/aaaa): 09:30 Aurora: stand-up · 10:00 Aurora: comitato di progetto» (di venerdì il giorno è lunedì; se quel giorno è lo stesso giorno della settimana di oggi c'è anche il SAL).
   Dimostra: la sera si vede già che cosa preparare.

6. **Una riunione non è più una cosa «da fare».** Guarda «Da fare oggi».
   Atteso: nessuna riga «Alle …» nell'elenco: le riunioni stanno solo nell'agenda. Se una comincia entro due ore, è anche in «Adesso», come prima.

7. **Apri l'invito.** Premi «Apri l'invito» sulla riga del SAL.
   Atteso: si apre il file della mail dell'invito. In testa: `riunione-ripete: "FREQ=WEEKLY"` e `riunione-partecipanti: "…"`.
   Dimostra: ogni riga dell'agenda ha la sua fonte, un file del progetto.

## Che cosa non fa ancora
- Una riunione il cui invito è arrivato prima del giorno d'inizio della posta del progetto non c'è: va spostato indietro il giorno d'inizio in «Fonti».
- Gli inviti già in memoria prendono regola e partecipanti quando la mail viene riletta.
- La scheda di preparazione di ogni riunione è l'incremento I.

## Test
```bash
pnpm exec vitest run packages/domain/test/today.test.ts packages/application/test/today.test.ts apps/desktop/test/today.test.tsx
pnpm test:coverage
```
