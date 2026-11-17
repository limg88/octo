# Demo 42 — Cartella condivisa: due persone sullo stesso progetto

Durata: 5 minuti. Mostra che due Octo su due computer lavorano sulla stessa cartella di progetto (come una cartella tenuta allineata da OneDrive o SharePoint) senza pestarsi i piedi: una fonte la legge un computer alla volta, chi arriva dopo prosegue da dove è arrivato l'altro, e ciò che è di una persona non finisce nella cartella.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun sistema reale e nessun OneDrive: la demo apre due Octo su questo computer, ognuno con la sua cartella dei dati, la sua persona e il suo nome di computer. La cartella del progetto è una sola. Azure DevOps è quello finto della demo 04.

Le due finestre: **Giovanni** (`mac-di-giovanni`) si apre per prima, **Giovanna** (`pc-di-giovanna`) per seconda. Il nome di chi è entrato è in basso a sinistra.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/42-cartella-condivisa/run.sh
   ```
   Atteso: si aprono due finestre di Octo sul progetto «Aurora».

2. **Giovanni collega Azure DevOps e legge.** Nella finestra di Giovanni: «Impostazioni», «Collega» nella riga «Azure DevOps». Organizzazione `contoso`, Progetto `Aurora`, token `demo-pat`, «Prova e salva», poi «Leggi ora».
   Atteso: «Ultima lettura …: N aggiornati, M invariati.»

3. **Giovanna trova tutto già letto.** Nella finestra di Giovanna: «Impostazioni» (se era già aperta, cambia scheda e torna).
   Atteso: nella riga «Azure DevOps» c'è la stessa ultima lettura, «Letta da Giovanni Rossi · mac-di-giovanni» e la nota «Su questo computer non c'è la credenziale: vale la lettura di chi condivide la cartella…». Anche i documenti dicono da chi sono stati convertiti.
   Dimostra: lo stato delle letture sta nella cartella, non sul computer. Giovanna non ha collegato nulla e Octo non le mostra errori: usa ciò che ha letto Giovanni.

4. **Guarda dove sta.** Nel terminale:
   ```bash
   ls .tmp/demo-42/Aurora/_octo/.stato
   cat .tmp/demo-42/Aurora/_octo/.stato/ado.json
   ```
   Atteso: `ado.json` (ultima lettura, da chi, da dove riparte la prossima), `ado.indice.json` (ciò che il feed ha scritto) e `documents.json`.

5. **Giovanna fa una domanda.** In «Chiedi»: `Quando è la consegna del modulo ordini?`
   Atteso: la risposta cita `wiki/stato.md`. Nella finestra di Giovanni la domanda **non** compare fra le conversazioni.
   Dimostra: la cronologia è di chi chiede. Verifica:
   ```bash
   ls .tmp/demo-42/dati-pc/questions .tmp/demo-42/Aurora/_octo
   ```
   Atteso: la domanda è nei dati dell'app di Giovanna; in `_octo` non c'è `.cronologia/domande.json`.

6. **Giovanna inserisce la sua credenziale.** «Impostazioni», «Modifica» nella riga «Azure DevOps», token `demo-pat`, «Prova e salva», poi «Leggi ora».
   Atteso: «Ultima lettura …: 0 aggiornati, …» La nota sulla credenziale sparisce.
   Dimostra: Giovanna prosegue da dove era arrivato Giovanni. Nulla viene cancellato né riletto da zero, anche se la credenziale è un'altra.

7. **Giovanni vede la lettura di Giovanna.** Nella finestra di Giovanni torna su «Impostazioni».
   Atteso: «Letta da Giovanna Bianchi · pc-di-giovanna».
   Dimostra: da qui in poi la lettura periodica (ogni 15 minuti) la fa uno solo: l'altro trova la lettura fresca e non la ripete.

8. **Sposta la cartella.** Chiudi entrambe le finestre, poi:
   ```bash
   mv .tmp/demo-42/Aurora .tmp/demo-42/OneDrive/Aurora
   KEEP=1 bash demo/42-cartella-condivisa/run.sh
   ```
   Nella finestra di Giovanni: selettore dei progetti, «Gestisci i progetti…», «Cambia cartella…» e scegli `.tmp/demo-42/OneDrive/Aurora`. Poi «Impostazioni».
   Atteso: il percorso del progetto cambia; Azure DevOps risulta ancora collegato, con «Già salvata su questo computer» e l'ultima lettura al suo posto.
   Dimostra: spostando la cartella sotto OneDrive il progetto resta lo stesso, con credenziali e letture.

## Cosa non mostra
- OneDrive vero: ritardi di sincronizzazione e copie in conflitto sono coperti dai test (`packages/application/test/shared-folder.test.ts`), non da questa demo.
- La posta: su Windows non si legge ancora; Giovanna vedrebbe «Su questo computer la posta non si legge: vale quella scritta nel progetto da chi condivide la cartella.»
