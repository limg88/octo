# Demo 67 — Correggere a parole un tipo del catalogo

Durata: 4 minuti. I tipi di deliverable distribuiti con Octo si correggono a parole, senza toccare file e senza una nuova versione: il PM dice che cosa cambiare, Claude riscrive le istruzioni del tipo, il PM le legge per intero e solo allora valgono, per quel progetto. Le istruzioni di Octo restano com'erano e ci si torna con un pulsante.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto, che aggiunge in fondo alle istruzioni la regola chiesta.

## Passi

1. **Avvia la demo e apri un tipo.**
   ```bash
   bash demo/67-correggi-un-tipo/run.sh
   ```
   «Deliverable» → «Stima». Sotto il modulo apri «Come Octo scrive questo tipo», poi «Istruzioni in uso».
   Atteso: le istruzioni del tipo come le distribuisce Octo. Il campo «Che cosa va cambiato» è vuoto e «Proponi la correzione» è spento.

2. **Chiedi una correzione a parole.** Scrivi `Non mostrare mai le giornate per persona.` e premi «Proponi la correzione».
   Atteso: «Istruzioni proposte», con una riga che dice che cosa è cambiato e, sotto, le istruzioni riscritte per intero: quelle di prima più la regola nuova.
   ```bash
   ls .tmp/demo-67/Aurora/_octo/.tipi 2>/dev/null || echo "ancora niente nel progetto"
   ```
   Atteso: `ancora niente nel progetto`.
   Dimostra: una proposta non cambia nulla finché non la approvi.

3. **Scarta, poi chiedi di nuovo e approva.** «Scarta»: la proposta sparisce. Premi di nuovo «Proponi la correzione», poi «Usa queste istruzioni».
   Atteso: «Fatto: da ora questo tipo si scrive così in questo progetto.» e la riga «Questo progetto usa istruzioni corrette da te.»
   ```bash
   tail -n 2 .tmp/demo-67/Aurora/_octo/.tipi/corretti/stima.md
   tail -n 2 apps/desktop/resources/catalogo/stima/istruzioni.md
   ```
   Atteso: la regola è nel file del progetto e non in quello distribuito con l'app.
   Dimostra: viene scritto ciò che hai letto, nel progetto; il catalogo di Octo non è toccato, e chi condivide la cartella scrive con le stesse istruzioni.

4. **Scrivi una stima.** Compila «Che cosa va stimato» e premi «Scrivi la bozza».
   Atteso: la bozza arriva come sempre, con i totali calcolati dal codice. Chi scrive ha ricevuto le istruzioni corrette (lo provano i test: `packages/application/test/deliverables.test.ts`).

5. **Torna alle istruzioni di Octo.** «Nuovo deliverable» → «Stima» → «Come Octo scrive questo tipo» → «Torna alle istruzioni di Octo».
   Atteso: «Questo tipo è tornato alle istruzioni di Octo.»; in «Istruzioni in uso» la regola non c'è più.

## Che cosa non fa
- Non corregge titolo, domande ed elenco di controllo del tipo: solo come si scrive. Per quelli si crea un tipo proprio («Crea un tipo tuo»).
- La correzione vale per il progetto, non per tutti i progetti del PM.
- Con Claude vero non è stata provata: quanto la riscrittura rispetta ciò che non va toccato è in `docs/verifiche-da-fare.md` (R4b.2).

## Prova automatica nella finestra vera
```bash
pnpm e2e:correggi
```

## Test e copertura
```bash
pnpm test:coverage
```
