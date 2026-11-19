# Demo 73 — Una riunione è del progetto solo se c'è una persona della squadra

Durata: 4 minuti. Incremento J1 della seconda prova: in «Il punto» comparivano punti di riunioni di un altro progetto, perché calendario e parole decidevano prima delle persone.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/73-riunioni-della-squadra/run.sh
   ```
2. **Guarda «Oggi».** «Oggi» → «Leggi ora».
   Atteso: in agenda c'è «Aurora: prova generale del collaudo» (la convoca Carla Bianchi, che è nella squadra come referente del cliente). «Comitato di direzione» non c'è: in fondo alla pagina «1 riunione da assegnare».
3. **Apri «1 riunione da assegnare».**
   Atteso: «Comitato di direzione · dal calendario · non partecipa nessuno della squadra», con «È di questo progetto» e «Non è di questo progetto». Claude non è stato interpellato: lo dice Octo, da chi partecipa.
   Dimostra: se partecipano altri e nessuno della squadra, la riunione non entra, anche se la mail che la porta nomina il progetto.
4. **Dillo tu.** Premi «È di questo progetto».
   Atteso: la riunione entra in agenda e l'elenco «da assegnare» sparisce. La tua parola vale più della regola, e resta.
5. **Togli una persona dalla squadra e rileggi.** «Impostazioni» → «Persone e calendario»: togli «Carla Bianchi», salva; «Oggi» → «Leggi ora».
   Atteso: «Aurora: prova generale del collaudo» passa fra le riunioni da assegnare: il titolo nomina il progetto, ma nessuno della squadra partecipa.
   Dimostra: la squadra del progetto (fornitore e cliente) è ciò che decide. Tienila aggiornata.

## Che cosa cambia per le riunioni registrate
Vale la stessa regola per le riunioni di Verbale: una registrazione con partecipanti noti e nessuno della squadra non entra in `_octo/riunioni/` e la chiusura della giornata non ne ricava punti. Una già importata esce alla lettura successiva insieme ai punti che aveva aperto, e aspetta fra quelle da assegnare. Prova automatica: `pnpm vitest run packages/application/test/meetings.test.ts`.
