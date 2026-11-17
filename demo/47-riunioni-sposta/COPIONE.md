# Demo 47 — Riunioni: spostare o togliere un'assegnazione, con i suoi punti aperti

Durata: 4 minuti. Mostra che una riunione finita nel progetto sbagliato si riporta al suo con un gesto, che i punti aperti tratti da quella riunione vanno via con lei, e che Octo avvisa prima dell'errore: una riunione i cui partecipanti sono persone di un altro progetto lo dice.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude, alla posta o a Verbale veri. Due progetti sintetici, «Aurora» e «Boreale», che leggono la stessa cartella finta di Verbale. Tre daily di oggi, tutte con le persone di Aurora (Luca Verdi, Sara Neri, Paola Verdi): due sono state assegnate a mano a Boreale, che ne ha tratto 4 punti aperti; la terza aspetta ancora un progetto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/47-riunioni-sposta/run.sh
   ```
   Atteso: si apre Octo su «Aurora».

2. **Passa a «Boreale»** dal nome del progetto in alto, e guarda «Oggi».
   Atteso: «Il punto» ha 4 punti («Il certificato dell’ambiente di collaudo scade venerdì…», «Sara chiude il report dei test…» e altri due): nessuno è di Boreale. Più sotto il segnale «"Daily Standup Fornitori" è registrata ma non ha un progetto», con la frase «Attenzione: i partecipanti sono persone del progetto «Aurora». Se è di quel progetto, assegnala da lì e non qui.»
   Dimostra: l'errore di oggi (punti di un altro progetto) e l'avviso che lo previene: prima il pulsante «Assegna a questo progetto» compariva uguale in ogni progetto, senza guardare chi c'era.

3. **Apri «Impostazioni» → «Riunioni».** In fondo c'è «Riunioni di questo progetto».
   Atteso: «Daily Standup Cliente» e «Daily Standup Interna», ciascuna con un elenco «Nessun progetto / Aurora» e il pulsante «Togli dal progetto».

4. **Sposta la prima.** Scegli «Aurora» nell'elenco di «Daily Standup Cliente», premi «Sposta».
   Atteso: prima di fare qualcosa Octo scrive «La sposto a «Aurora» e tolgo da qui i punti aperti che ne vengono.» Premi «Conferma».
   Atteso: «Riunione spostata a «Aurora».»; la riunione non è più in elenco.

5. **Sposta la seconda** allo stesso modo.
   Atteso: l'elenco resta vuoto.

6. **Premi «Leggi ora»** nella stessa sezione, poi torna su «Oggi».
   Atteso: «Nessun open point in coda.» Le due daily non sono tornate.
   Dimostra: lo spostamento non viene annullato alla lettura successiva. Boreale ricorda di averle date via (`_octo/.impostazioni/sources.json`, voce `released`).

7. **Passa ad «Aurora»**, «Impostazioni» → «Riunioni».
   Atteso: le due daily sono in «Riunioni di questo progetto». In «Oggi» → «Chiudi la giornata» Claude le leggerà per i punti aperti di Aurora.
   Dimostra: la riunione è passata intera (trascrizione, appunti, descrizione), e il progetto che la riceve la tratta come sua.

8. **Guarda la cartella di Boreale.** «Cartella del progetto» → `_octo/progetto/open-point.md`.
   Atteso: nessun punto aperto. In `_octo/riunioni/` restano solo le note di lettura.

## Che cosa dimostra
- Un'assegnazione fatta a mano ha una via di ritorno visibile: «Sposta» verso un altro progetto, o «Togli dal progetto» (la riunione torna fra quelle da assegnare).
- I punti aperti aperti da Claude su quella riunione vanno via con lei; quelli che le sue parole avevano chiuso tornano aperti; l'elenco delle riunioni già lette viene aggiornato.
- Il progetto che ha dato via una riunione non la riprende più da solo, qualunque cosa dicano inviti e parole chiave.

## Che cosa non fa
- Non assegna da solo una riunione al progetto dei partecipanti: avvisa soltanto. Una riunione non viene mai data per somiglianza.
- Il progetto che riceve la riunione non eredita i punti aperti: li rilegge Claude alla chiusura della giornata.

## Test
```bash
pnpm vitest run packages/domain/test/meetings.test.ts packages/domain/test/open-points.test.ts packages/application/test/meetings.test.ts packages/application/test/open-points.test.ts packages/infrastructure/test/shared-folder.test.ts apps/desktop/test/meetings.test.tsx apps/desktop/test/today.test.tsx
```
