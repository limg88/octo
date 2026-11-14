# Demo 10 — Avanzamento: il modulo del cliente compilato dalle cifre dell'ordine

Durata: 4 minuti. Mostra la richiesta di stato di avanzamento: una richiesta per fattura, con la percentuale di ogni posizione d'ordine calcolata dal codice e scritta sul modulo Excel del cliente. Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: modulo, ordine e importi sono finti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/10-avanzamento/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Avanzamento».**
   Atteso: «Ordine e richieste». In fondo, sotto «Il modulo del cliente», il file `Moduli/Richiesta stato avanzamento.xlsx` e la mappa «cella = testo» sono già impostati: si fa una volta per cliente.

3. **Scrivi l'ordine.** In «Ordine, come lo nomina il modulo» scrivi `ORD-2026-077`, in «Totale dichiarato dall'ordine» `340.000`, in «Posizioni dell'ordine»:
   ```
   00001; 100.000
   00002; 60.000
   00003; 142.000
   00004; 38.000
   ```

4. **Aggiungi la prima richiesta e salva.** Premi «Aggiungi una richiesta»: «Dal» il 1° marzo 2026, «Al» il 31 marzo 2026, importo `289.540`, annotazione `Fattura n. 101 del 31/03/2026`. Premi «Salva».
   Atteso: «Richiesta 1» con le posizioni 00001 e 00002 al 100,00%, la 00003 al 91,23%, la 00004 allo 0,00%; sotto, lo scarto in euro che l'arrotondamento lascia.
   Dimostra: l'importo riempie le posizioni una dopo l'altra, sempre dal totale chiesto fin lì.

5. **Aggiungi la richiesta che chiude l'ordine.** Apri «Ordine e richieste», premi «Aggiungi una richiesta»: «Dal» è già il 31 marzo; «Al» il 30 aprile 2026, importo `50.460`, annotazione `Fattura da emettere il 30/04/2026`. Premi «Salva».
   Atteso: «Richiesta 2» con «Raggiunge il totale dell'ordine: tutte le posizioni chiudono al 100%»; «Precedente» è l'«Attuale» della richiesta 1; «Di periodo» 8,77% sulla 00003 e 100,00% sulla 00004.

6. **Prova un importo sbagliato.** Apri «Ordine e richieste», cambia l'importo della richiesta 2 in `60.000` e salva.
   Atteso: «La richiesta 2 porta il totale chiesto 9.540,00 oltre il totale dell'ordine.» Rimetti `50.460` e salva.

7. **Compila il modulo.** Premi «Compila il modulo della richiesta 1», poi «Apri il file».
   Atteso: «Modulo compilato in `_octo/avanzamento/Richiesta stato avanzamento - 1.xlsx`». Si apre Excel: è il modulo del cliente con numero della proposta, ordine e posizioni (`ORD-2026-077 - pos.00001:00004`), date, le quattro posizioni con le percentuali e l'annotazione; etichette, celle unite e lo spazio riservato al cliente sono intatti.

## Che cosa dimostra
- Le percentuali vengono solo dagli importi dell'ordine e delle richieste: nessuna cifra presa altrove.
- Il modulo resta quello del cliente: si scrive una copia, solo nelle celle indicate dalla mappa.
- La mappa delle celle è un'impostazione del progetto, non codice: un altro cliente, un altro modulo.

## Che cosa non fa ancora
- Non legge le posizioni dal PDF dell'ordine: si scrivono una volta.
- Non produce il PDF né appone firme.
- Non scrive l'email che accompagna il modulo: si chiede in «Deliverable».
