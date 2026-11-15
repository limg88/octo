# Demo 15 — Cambio di computer: copia di sicurezza e ripristino

Durata: 4 minuti. Mostra come un PM riparte su un computer nuovo senza perdere nulla: le domande fatte stanno nella cartella del progetto, l'elenco dei progetti e il punto a cui sono arrivate le letture stanno in una copia di sicurezza, le credenziali non stanno da nessuna parte e si rimettono.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: il modello che risponde è finto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/15-cambio-computer/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora». È il vecchio computer.

2. **Fai una domanda.** In «Chiedi» scrivi `Quando consegniamo il modulo ordini?` e premi «Chiedi».
   Atteso: la risposta con «1 fonte controllata». Nella cartella del progetto compare `_octo/.cronologia/domande.json`.
   Dimostra: la cronologia è nel progetto, non nel computer.

3. **Fai la copia di sicurezza.** Nella colonna di sinistra, sotto «Se cambi computer», premi «Copia di sicurezza» e salva nella cartella `Chiavetta` stampata nel terminale. Poi chiudi la finestra.
   Atteso: «Copia scritta in …: 1 progetto. Le credenziali non ci sono: sul nuovo computer vanno rimesse.» Il file è un testo: dentro ci sono il progetto e lo stato delle letture, nessun token.

4. **Guarda il computer nuovo.** Lo script ha spostato la cartella del progetto in `Nuovo computer/Aurora`, ha cancellato i dati del vecchio Octo e ha riaperto Octo.
   Atteso: «Nessun progetto».

5. **Ripristina.** Premi «Ripristina» e scegli il file nella cartella `Chiavetta`. Octo chiede «Dov'è la cartella del progetto «Aurora» su questo computer?»: scegli `Nuovo computer/Aurora`.
   Atteso: «Ripristinati: Aurora.» e «Rimetti le credenziali di Jira e Azure DevOps in «Fonti»: non sono nella copia.» Aurora è in elenco.
   Dimostra: il percorso può cambiare, anche da Mac a Windows; Octo chiede solo quello che non trova.

6. **Apri «Chiedi».**
   Atteso: la domanda del passo 2 è lì, con la sua risposta.

7. **Ripeti il ripristino.** Premi di nuovo «Ripristina» con lo stesso file.
   Atteso: «Già in elenco, lasciati come sono: Aurora.» Un ripristino non scrive mai sopra un progetto che il computer ha già.

## Che cosa dimostra
- Per non perdere nulla servono due cose: la cartella del progetto copiata altrove (memoria, impostazioni, modelli, deliverable, domande) e la copia di sicurezza (elenco dei progetti, stato delle letture).
- Senza la copia si riparte lo stesso: «Aggiungi progetto» sulla cartella, e le fonti si rileggono da capo scrivendo sopra gli stessi file, senza doppioni.
- Le credenziali restano nel deposito del sistema del vecchio computer e non escono mai: sul nuovo si rimettono in «Fonti».
