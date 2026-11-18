# Demo 66 — Il recinto su Windows, dentro WSL2 (R6)

Durata: 3 minuti. Su Windows la sandbox di Claude Code esiste solo dentro WSL2. Octo gira su Windows e lancia Claude Code dentro la distribuzione, con i percorsi tradotti. La demo lo mostra su questo computer con un `wsl` finto: lo stesso codice, senza un PC Windows.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude, nessun Windows.

## Passi

1. **Lancia la demo.**
   ```bash
   bash demo/66-recinto-wsl/run.sh
   ```

2. **Leggi «1. I percorsi di Windows come li vede la distribuzione».**
   Atteso: `C:\Users\paola\OneDrive - Azienda\Aurora` diventa `/mnt/c/Users/paola/OneDrive - Azienda/Aurora`; lo stesso per la cartella di lavoro, l'interprete e lo script. Una condivisione di rete (`\\server\condivisa\…`) è rifiutata.
   Dimostra: un progetto che la distribuzione non vede non viene eseguito da un'altra parte: Octo rifiuta.

3. **Leggi «2. Il recinto, disegnato su quei percorsi».**
   Atteso: `denyWrite` sul progetto, `allowWrite` sulla sola cartella di lavoro, rete chiusa, e le due regole `Edit(//mnt/c/…/**)` e `Bash("/mnt/c/…/python-linux/bin/python3" *)`.
   Dimostra: è la stessa configurazione del Mac (demo 62), con i nomi che le cartelle hanno dentro WSL2. L'interprete è la copia per Linux distribuita con l'installatore di Windows.

4. **Leggi «3. Che cosa attraversa la riga di comando di Windows».**
   Atteso: `wsl.exe -d Ubuntu --cd <progetto> --exec /bin/sh <script>` e lo script, che mette `~/.local/bin` nel PATH e avvia `claude` con ogni parola fra apici.
   Dimostra: sulla riga di comando di Windows passano solo percorsi. Il comando lungo (istruzioni, schema, impostazioni della sandbox) viaggia nello script, dove le virgolette non si perdono.

5. **Leggi «4.» e «5.».**
   Atteso: il `wsl` finto elenca una distribuzione di versione 2; senza `wsl.exe` lo stato è `no_wsl`. Poi un calcolo intero: la tabella, i file nella cartella di lavoro, zero script di avvio rimasti.
   Dimostra: se WSL2 o Claude Code dentro la distribuzione mancano, «Con calcoli» non è offerto e un calcolo è rifiutato; Octo non calcola mai senza sandbox.

## Che cosa non dimostra
Tutto ciò che gira sul PC del pilota: `docs/verifiche-da-fare.md`, R6.1–R6.8. In particolare che la sandbox dentro WSL2 regga davvero su un disco di Windows (`/mnt/c`), che è la prova ostile rifatta lì.

## Non costruito
Il lettore della posta su Windows: in `docs/` non è scritto quale Outlook ha il pilota. Che cosa serve sapere è in `docs/verifiche-da-fare.md` («R6 — che cosa serve sapere sulla posta di Windows»).

## Test e copertura
```bash
pnpm test:coverage
```
I test della traduzione dei percorsi, dello script e dell'elenco delle distribuzioni girano anche in CI su Windows (`packages/infrastructure/test/wsl.test.ts`).
