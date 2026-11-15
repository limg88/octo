# Demo 17 — Quale modello lavora

Durata: 3 minuti. Mostra che il modello di Claude non è più quello che capita sul computer: si sceglie per progetto, uno per le risposte, uno per la scrittura dei deliverable e uno per la rilettura critica, e accanto a ogni risposta e a ogni deliverable resta scritto il modello che ha lavorato davvero.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude: il modello che risponde è finto e dice un nome finto. Con `REAL=1 bash demo/17-modelli/run.sh` lavora il tuo Claude Code e i nomi sono quelli veri.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/17-modelli/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Fai una domanda senza scegliere nulla.** In «Chiedi» scrivi `Quando consegniamo il modulo ordini?` e premi «Chiedi».
   Atteso: sotto la domanda, accanto all'ora, «modello claude-fake-default» (con Claude vero: il modello predefinito del tuo Claude Code).
   Dimostra: anche senza scelta si sa chi ha risposto.

3. **Scegli i modelli.** Apri «Fonti», scendi a «Modelli». In «Risposte in «Chiedi»» scegli `Sonnet`, in «Scrittura dei deliverable» `Opus`, in «Rilettura critica dei deliverable» `Haiku`. Premi «Salva i modelli».
   Atteso: «Modelli salvati: valgono dalla prossima domanda e dal prossimo deliverable.»

4. **Rifai la domanda.** Torna in «Chiedi» e fai la stessa domanda.
   Atteso: la nuova risposta dice «modello claude-sonnet-fake»; quella di prima resta con il suo.

5. **Scrivi un deliverable.** Apri «Deliverable», «Nuovo deliverable», scegli l'email al cliente, compila i campi obbligatori e premi «Scrivi la bozza».
   Atteso: nella riga sotto il titolo, dopo i minuti, «scritto da claude-opus-fake, riletto da claude-haiku-fake».
   Dimostra: scrittura e rilettura possono avere modelli diversi, per esempio uno più capace per scrivere e uno diverso per attaccare il testo.

6. **Torna al predefinito.** In «Modelli» rimetti «Predefinito di Claude Code» dove vuoi e salva.

## Che cosa dimostra
- La scelta sta nelle impostazioni del progetto: segue la cartella su un altro computer.
- «Predefinito» è il modello che Claude Code usa su quel computer, e può cambiare da un PC all'altro: per questo il modello che ha lavorato viene sempre scritto.
- I nomi nell'elenco sono quelli delle famiglie: scegliere `Opus` vuol dire l'Opus più recente che il tuo Claude Code conosce.
