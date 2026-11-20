# Demo 82 — «Cruscotto» rivisto: una riga di comandi, i conteggi in una fascia, un bug per riga

Durata: 4 minuti. Quinto incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavole `D12`, `D13`).

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora» e Azure DevOps finto su questo computer: nulla esce.

## Passi

1. **Avvia la demo e apri «Cruscotto».** Premi «Leggi da Azure DevOps» se i dati non ci sono ancora.
   ```bash
   bash demo/82-cruscotto-rivisto/run.sh
   ```
   Atteso: in alto le schede; sotto, una riga sola: il periodo come un controllo unico («8 settimane | 3 mesi | 6 mesi | 12 mesi | Scelgo io», quello scelto in viola tenue), poi a destra lo stato della lettura in verde con il bordo, «Leggi da Azure DevOps» e «Impostazioni del cruscotto» quieto.
2. **Apri le impostazioni.** Premi «Impostazioni del cruscotto».
   Atteso: il modulo si apre sotto la riga; premi di nuovo e si richiude.
3. **Scheda «Bug»: la fascia.**
   Atteso: un riquadro solo con i conteggi; in ogni cella l'etichetta, poi la cifra (in Inter, non monospazio), poi la nota («su N bug nel perimetro · +N da inizio periodo»). Quella scelta ha il fondo viola tenue e la riga viola sotto. Premi «In verifica»: l'elenco sotto cambia.
4. **L'elenco dei bug.**
   Atteso: «Da sollecitare», «Cerca per id o titolo» e «Ordina per» sulla stessa riga. Ogni bug è una riga: id in monospazio, titolo in grassetto, persona, stato in un'etichetta grigia, giorni nello stato (in ambra con «fermo» se è fermo; «tempo non noto» se il tracker non lo dice). Il dettaglio a destra è largo 440 px e i suoi pulsanti non vanno a capo dentro la parola.
5. **Scheda «Andamento».**
   Atteso: barre grigie piene per gli entrati, barre vuote con il bordo per gli usciti, linea nera (bianca in tema scuro) per gli aperti a fine periodo; una riga tratteggiata al massimo. «Dove si fermano i bug» è una fascia di tre cifre: dove non c'è un dato, «nessun dato» in grigio. «Commenta il periodo» è sulla riga del titolo.
   Dimostra: il grafico si legge per forma, anche in bianco e nero, e non usa i colori che altrove vogliono dire «da verificare» e «confermato».
6. **Stringi la finestra** sotto 1.120 px, poi sotto 1.040.
   Atteso: il dettaglio del bug va sotto l'elenco; poi la fascia dei conteggi va su due righe.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/dashboard.test.tsx
pnpm e2e:cruscotto
```
