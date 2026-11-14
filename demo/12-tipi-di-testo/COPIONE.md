# Demo 12 — Tipi di testo: sei tipi in più nel catalogo dei deliverable

Durata: 3 minuti. Mostra i sei tipi di testo aggiunti al catalogo e il percorso di uno di loro, le note di rilascio: domande, bozza con fonti controllate, ciò che manca, controlli prima di approvare.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude: risponde un modello finto, sempre uguale. La bozza che vedi è quindi sempre la stessa: la demo mostra il percorso e le regole, non la qualità della scrittura.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/12-tipi-di-testo/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Deliverable».**
   Atteso: nel catalogo, dopo email, stato di avanzamento, verbale e stima, ci sono «Analisi funzionale da riunione», «Voce di backlog», «Modifiche da applicare al tracker», «Scenari di test», «Note di rilascio» e «Technical proposal», ognuno con a chi è destinato.

3. **Scegli «Note di rilascio».** In «Quale rilascio» scrivi `2.4 di novembre` e premi «Scrivi la bozza».
   Atteso: la bozza con le sezioni «Rilascio», «Novità», «Problemi noti»; «1 fonte controllata»; sotto «Che cosa manca» la voce «Elenco delle voci chiuse per questo rilascio».
   Dimostra: quello che non si trova nel progetto non entra nel testo, viene chiesto.

4. **Leggi i controlli prima di approvare.**
   Atteso: fra i controlli, «Ogni voce risulta rilasciata o chiusa nel tracker, con la data dei dati» e «Nessun dato interno (giornate, costi, tariffe, codici commessa)».

5. **Aggiungi una regola del progetto a un altro tipo.** Torna al catalogo con «Nuovo deliverable», scegli «Technical proposal»: in «Istruzioni di questo progetto per questo deliverable» scrivi `Scrivi in inglese` e premi «Salva le istruzioni».
   Atteso: la regola resta salvata e vale per tutte le prossime technical proposal di questo progetto, in aggiunta a quelle del tipo (nessuna cifra, perimetro dalla fonte che indichi tu).

## Che cosa dimostra
- I sei tipi seguono lo stesso percorso degli altri deliverable: fonti controllate una per una, rilettura critica, approvazione in testo e Word.
- Ogni tipo ha regole e controlli propri; per ogni progetto puoi aggiungere le tue.

## Che cosa non fa
- Non scrive sul tracker: voce di backlog e modifiche al tracker sono testi che una persona applica a mano.
- Le istruzioni vanno ancora provate su casi reali con Claude vero.
