# Demo 62 — Claude calcola dentro un recinto (R3)

Durata: 4 minuti. In «Chiedi» una domanda può avere risposta con calcoli: Claude legge il progetto senza poterlo modificare, esegue l'interprete incluso in Octo e scrive solo in una cartella di lavoro dell'app. La risposta porta la tabella con i file da cui è calcolata. I file entrano nel progetto solo quando lo dici tu, e li copia Octo.

## Prerequisiti
- Node 24, pnpm 12, macOS (su Windows il recinto arriva con R6, dentro WSL2).
- Rete solo alla prima esecuzione: lo script scarica l'interprete (CPython 3.13 autonomo e openpyxl, versioni e SHA-256 fissati in `apps/desktop/scripts/fetch-python.mjs`).
- Claude finto: nessun seat usato. Con `REAL=1` lavora Claude vero sul tuo seat, con la sandbox vera.
- Progetto sintetico «Aurora», con `dati/vendite.csv` (5.000 righe).

## Passi

1. **Avvia la demo e apri «Chiedi».**
   ```bash
   bash demo/62-recinto-calcolo/run.sh
   ```
   Atteso: accanto a «Chiedi» c'è la casella «Con calcoli».
   Dimostra: l'opzione compare solo dove il recinto esiste (interprete presente, sistema con la sandbox).

2. **Chiedi senza la casella**: «Quando consegniamo?».
   Atteso: la risposta di sempre, con la fonte citata. Nessun file scritto.

3. **Spunta «Con calcoli» e chiedi**: «Quante righe ha il file di stato?» (con `REAL=1`: «Somma gli importi di dati/vendite.csv per regione»).
   Atteso: mentre lavora, «Calcolo». Poi la tabella «Righe del file di stato» e sotto «Calcolata da: wiki/stato.md. Per intero nel file righe.csv.» In fondo: «File del calcolo, nella cartella di lavoro di Octo: dettaglio/calcolo.py, righe.csv.» e il pulsante «Salva i file nel progetto».
   Dimostra: una cifra calcolata non è una citazione. Octo controlla ciò che può: che i file di partenza esistano nel progetto e che il file nominato sia stato scritto. Se manca qualcosa lo dice sotto la tabella.

4. **Guarda dove ha scritto.**
   ```bash
   ls .tmp/demo-62/dati/lavoro/demo-aurora/*/
   ls .tmp/demo-62/Aurora/_octo/analisi 2>/dev/null || echo "nel progetto ancora niente"
   ```
   Atteso: lo script e il risultato stanno nello stato dell'app; nel progetto niente.

5. **Premi «Salva i file nel progetto».**
   Atteso: «File salvati nel progetto, in _octo/analisi/…». La cartella ora contiene `righe.csv` e `dettaglio/calcolo.py`.
   Dimostra: nel progetto scrive solo Octo, e solo ciò che approvi.

6. **La prova ostile, con Claude vero** (usa il tuo seat, circa un minuto):
   ```bash
   pnpm test:recinto
   ```
   Atteso: 2 test passati. Dentro lo stesso recinto di ogni calcolo, uno script prova a scrivere nel progetto, in `_octo/`, fuori, nella home, attraverso un link simbolico e una shell figlia, ad aprire un sito e a elencare la home; Claude prova anche con Write e con `touch`. Riesce solo la scrittura nella cartella di lavoro.

## Che cosa non dimostra
- Un'analisi reale del vault rifatta con le stesse cifre: `docs/verifiche-da-fare.md`, R3.1.
- Windows: R6.

## Limiti dichiarati
- Dentro il progetto l'interprete legge tutto, compresa la cartella dei costi riservati: non può portare fuori niente (rete chiusa, scrittura solo nella cartella di lavoro), ma una tabella può contenerli.
- Se la sandbox non parte Octo rifiuta il calcolo: non prosegue senza.

## Prova automatica nella finestra vera
```bash
pnpm e2e:recinto
```

## Test e copertura
```bash
pnpm test:coverage
```
