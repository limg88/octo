# Demo 04 — Sistemi: Azure DevOps, Jira, NetSuite

Durata: 4 minuti. Mostra che Octo legge un sistema con la credenziale di sola lettura del PM e ne scrive gli elementi nella cartella del progetto, uno per file, con una nota che dice a quando risalgono i dati. La demo usa Azure DevOps; Jira e NetSuite si collegano dalla stessa pagina, allo stesso modo.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun sistema reale: la demo avvia un Azure DevOps finto su questo computer, con tre work item sintetici.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/04-sistemi/run.sh
   ```
   Atteso: il terminale stampa l'indirizzo dell'Azure DevOps finto e si apre Octo sul progetto «Aurora».

2. **Apri «Impostazioni»** e premi «Collega» nella riga «Azure DevOps».
   Atteso: «Non collegato.» Sotto «Avanzate», «Cartella nel progetto» propone `_octo/fonti/ADO`.

3. **Prova un token sbagliato.** Organizzazione `contoso`, Progetto `Aurora`, Personal Access Token `sbagliato`. Premi «Prova e salva».
   Atteso: «Il sistema ha rifiutato la credenziale…». Resta «Non collegato.»
   Dimostra: nulla viene salvato finché il sistema non accetta la credenziale.

4. **Collega.** Token `demo-pat`, poi «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.» Il campo del token si svuota e dice «Già salvata su questo computer».
   Dimostra: la credenziale non torna più a schermo e non finisce nella cartella del progetto: `_octo/.impostazioni/sources.json` contiene organizzazione e progetto, non il token.

5. **Leggi.** Premi «Leggi ora».
   Atteso: «Ultima lettura …: N aggiornati, 0 invariati.»

6. **Guarda i file.** Nel terminale:
   ```bash
   ls .tmp/demo-04/Aurora/_octo/fonti/ADO
   cat .tmp/demo-04/Aurora/_octo/fonti/ADO/_lettura.md
   ```
   Atteso: un file per work item (`101-….md`, `102-….md`, `103-….md`) e la nota `_lettura.md` con la data della lettura e fino a quando arrivano i dati.
   Dimostra: lo stato del tracker è nella memoria del progetto, e l'età dei dati è scritta dove Claude la può citare.

7. **Leggi di nuovo.** Premi «Leggi ora».
   Atteso: 0 work item riscritti: ciò che non è cambiato resta com'è. Con l'app aperta la lettura parte da sola ogni 15 minuti.

## Con Claude vero
```bash
REAL=1 KEEP=1 bash demo/04-sistemi/run.sh
```
In «Chiedi» scrivi `Quali work item sono bloccati e a quando risalgono i dati di Azure DevOps?`. Atteso: cita il file del work item 102 e la nota `_lettura.md`. Consuma quota del tuo seat.

## Jira e NetSuite
- **Jira**: sito, la tua email, un API token di sola lettura, le chiavi dei progetti.
- **NetSuite (DWSI)**: server, database, il tuo utente di sola lettura, la tua email aziendale e i codici commessa. La connessione al warehouse resta su questo computer.

Entrambi sono provati dai test contro un Jira finto e un warehouse finto (`pnpm db:setup` avvia il database di prova).

## Senza interfaccia
`pnpm e2e` esegue i passi da 1 a 7 nella finestra vera e stampa `e2e: ok`.
