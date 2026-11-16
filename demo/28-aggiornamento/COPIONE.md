# Demo 28 — Octo si aggiorna da solo: avviso, un clic, riavvio

Durata: 4 minuti, più un paio per impacchettare l'app al lancio.

## Prerequisiti
- macOS, Node 24, pnpm 12. Su Windows lo stesso clic avvia l'installatore in silenzio: questa demo non lo costruisce.
- Nessun accesso a GitHub: chi pubblica le versioni è un programma su questo computer, che firma la lista dei file con una chiave fatta sul momento; la demo dice a Octo qual è. L'app è impacchettata due volte da questi sorgenti, come 0.1.0 («installata», in una cartella che fa da Applicazioni) e come 0.2.0 («pubblicata»).
- Chi entra è già «Paola Verdi»; i dati stanno nella cartella della demo, non nei tuoi.

## Passi

1. **Avvia.**
   ```bash
   bash demo/28-aggiornamento/run.sh
   ```
   Atteso nel terminale: «Octo installato: … (versione 0.1.0)» e «Versione pubblicata: 0.2.0». Si apre Octo.
   Dimostra: l'app in uso è un'app impacchettata vera, non lanciata dai sorgenti.

2. **L'avviso.** Guarda in cima alla pagina.
   Atteso: una riga viola chiaro: «È disponibile Octo 0.2.0. L'aggiornamento scarica la versione nuova, la verifica e riavvia Octo: progetti e impostazioni restano dove sono.», con «Aggiorna e riavvia» e una «×».
   Dimostra: Octo controlla all'avvio (e poi ogni sei ore) se c'è una versione più nuova per questo computer.

3. **Rimanda.** Premi «×».
   Atteso: l'avviso sparisce; il resto dell'app è come prima. Chiudi Octo, premi Invio nel terminale e rilancia il comando del passo 1: l'avviso c'è di nuovo.
   Dimostra: l'aggiornamento non è mai imposto.

4. **Aggiorna.** Premi «Aggiorna e riavvia».
   Atteso: sul pulsante l'anello e «Aggiorno…»; nella riga «Scarico la versione nuova: N%», poi «Scaricata e verificata: Octo si chiude e riparte fra un momento». La finestra si chiude e dopo pochi secondi si riapre da sola, senza avviso.
   Dimostra: scaricamento, verifica dell'impronta, sostituzione dell'app e riavvio in un clic.

5. **Controlla.** Chiudi Octo e premi Invio nel terminale.
   Atteso: «Octo installato ora: versione 0.2.0» e l'elenco delle richieste arrivate a chi pubblica: l'ultima versione, la lista `SHA256SUMS`, la sua firma `SHA256SUMS.sig`, il file `Octo-0.2.0-mac-….zip`, e di nuovo l'ultima versione (l'ha chiesta l'Octo nuovo, che non ha trovato nulla di più recente).
   Dimostra: l'app al suo posto è quella nuova; lista e firma sono lette prima del file.

6. **Un file che non è quello pubblicato.**
   ```bash
   TAMPERED=1 bash demo/28-aggiornamento/run.sh
   ```
   Premi «Aggiorna e riavvia».
   Atteso: dopo lo scaricamento un avviso: «Il file scaricato non è quello pubblicato: non lo installo…». Octo resta aperto. Chiudi, premi Invio: la versione installata è ancora 0.1.0.
   Dimostra: non viene mai installato un file la cui impronta SHA-256 non è quella dichiarata dalla versione.

7. **Una versione che non hai firmato tu.**
   ```bash
   FORGED=1 bash demo/28-aggiornamento/run.sh
   ```
   Premi «Aggiorna e riavvia».
   Atteso: subito l'avviso «La firma della versione nuova non è quella di chi pubblica Octo: non la installo…». Chiudi e premi Invio: la versione è ancora 0.1.0 e, fra le richieste, il file `.zip` non è mai stato chiesto.
   Con `UNSIGNED=1` la lista non ha firma: «La versione nuova non porta la firma di chi pubblica Octo: non la installo.»
   Dimostra: chi pubblicasse una versione al posto tuo — file, impronte e tutto — non riuscirebbe a farla installare: gli manca la tua chiave.

## Che cosa serve per le versioni vere
Una volta: `pnpm release:keys` (e `pnpm release:keys riserva`), poi il commit di `apps/desktop/release-keys.json`. A ogni versione: un tag `vX.Y.Z`, che fa costruire i file e preparare la release in bozza, e `pnpm release:sign vX.Y.Z` sul tuo computer, che firma la lista e la pubblica. I passi sono nel `README.md`, sezione «Aggiornamenti».

L'app non è firmata con un Developer ID di Apple: resta la conferma di macOS al primo avvio, e dopo ogni aggiornamento l'accesso completo al disco va rimesso (Octo lo dice).

## Test
```bash
pnpm test
pnpm test:coverage
```
