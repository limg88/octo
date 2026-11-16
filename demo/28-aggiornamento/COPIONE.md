# Demo 28 — Octo si aggiorna da solo: avviso, un clic, riavvio

Durata: 4 minuti, più un paio per impacchettare l'app al lancio.

## Prerequisiti
- macOS, Node 24, pnpm 12. Su Windows lo stesso clic avvia l'installatore in silenzio: questa demo non lo costruisce.
- Nessun accesso a GitHub: chi pubblica le versioni è un programma su questo computer. L'app è impacchettata due volte da questi sorgenti, come 0.1.0 («installata», in una cartella che fa da Applicazioni) e come 0.2.0 («pubblicata»).
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
   Atteso: «Octo installato ora: versione 0.2.0» e l'elenco delle richieste arrivate a chi pubblica: l'ultima versione, la lista `SHA256SUMS`, il file `Octo-0.2.0-mac-….zip`, e di nuovo l'ultima versione (l'ha chiesta l'Octo nuovo, che non ha trovato nulla di più recente).
   Dimostra: l'app al suo posto è quella nuova; l'impronta è letta prima del file.

6. **Un file che non è quello pubblicato.**
   ```bash
   TAMPERED=1 bash demo/28-aggiornamento/run.sh
   ```
   Premi «Aggiorna e riavvia».
   Atteso: dopo lo scaricamento un avviso: «Il file scaricato non è quello pubblicato: non lo installo…». Octo resta aperto. Chiudi, premi Invio: la versione installata è ancora 0.1.0.
   Dimostra: non viene mai installato un file la cui impronta SHA-256 non è quella dichiarata dalla versione.

## Che cosa serve per le versioni vere
Un tag `vX.Y.Z` su GitHub: il flusso «Installatori» imposta la versione dal tag, costruisce `.dmg`, `.zip` ed `.exe`, calcola `SHA256SUMS` e pubblica la release. Gli Octo installati la trovano da soli.

Limite: l'app non è firmata. L'integrità poggia su GitHub (HTTPS e impronte della stessa release): chi controllasse il repository potrebbe pubblicare una versione sua.

## Test
```bash
pnpm test
pnpm test:coverage
```
