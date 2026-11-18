# Demo 65 — Memoria del progetto: pagine scritte da Claude (R5)

Durata: 4 minuti. La memoria curata comincia da tre pagine: fatti correnti, decisioni e regole del PM, cronologia. Le scrive Claude dalle fonti, entrano solo quando le approvi, e da allora «Chiedi» e i deliverable le leggono per prime.

## Prerequisiti
- Node 24, pnpm 12. Claude finto: nessun seat usato (`REAL=1` per Claude vero).
- Progetto sintetico «Aurora», con `wiki/stato.md`.

## Passi

1. **Avvia la demo e apri «Deliverable».**
   ```bash
   bash demo/65-memoria-del-progetto/run.sh
   ```
   Atteso: in fondo al catalogo tre tipi nuovi: «Memoria: fatti correnti», «Memoria: decisioni e regole del PM», «Memoria: cronologia del progetto».
   Dimostra: una pagina di memoria è un deliverable come gli altri. Non c'è una schermata nuova.

2. **Scegli «Memoria: fatti correnti»**, scrivi «17 novembre 2026» in «Aggiornata fino a», premi «Scrivi la bozza».
   Atteso: la bozza con «Dove siamo» e «Numeri correnti», ogni riga con il giorno fra parentesi e la sua fonte controllata; la rilettura critica accanto; fra le cose da confermare «Che cosa è in attesa dal cliente».
   ```bash
   ls .tmp/demo-65/Aurora/_octo/progetto/memoria 2>/dev/null || echo "nessuna pagina di memoria"
   ```
   Atteso: «nessuna pagina di memoria». Una bozza non è memoria.

3. **Correggi a parole** (facoltativo): chiedi una modifica nel riquadro della revisione, come per ogni deliverable.
   Dimostra: una pagina si corregge a parole, con il ciclo di revisione che c'è già.

4. **Premi «Approva».**
   ```bash
   cat .tmp/demo-65/Aurora/_octo/progetto/memoria/fatti-correnti.md
   ```
   Atteso: il titolo, «scritta da Claude e approvata dal PM il …», il testo senza i richiami numerici e in fondo «## Fonti» con `wiki/stato.md`.
   Dimostra: nessuna pagina entra in memoria senza approvazione, e ogni pagina dice da quali file viene.

5. **Apri «Chiedi» e chiedi**: «A che punto siamo?»
   Atteso: la risposta cita la pagina di memoria (`_octo/progetto/memoria/fatti-correnti.md`) e la sua fonte (`wiki/stato.md`), tutte e due controllate.
   Dimostra: Chiedi legge la memoria per prima e la usa come guida; per una data va comunque alla fonte.

## Che cosa non fa
- Non controlla doppioni e contraddizioni fra le pagine, e non tiene i contratti di output con l'esempio validato: vengono dopo, se le tre pagine si dimostrano usate.
- Le pagine non si aggiornano da sole: si riscrivono quando lo chiedi, partendo dalla versione che c'è.

## Che cosa non dimostra
- Le cinque domande di contesto con Claude vero: `docs/verifiche-da-fare.md`, R5.

## Prova automatica nella finestra vera
```bash
pnpm e2e:memoria
```

## Test e copertura
```bash
pnpm test:coverage
```
