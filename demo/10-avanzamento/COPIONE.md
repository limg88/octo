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
   Atteso: «Per cominciare servono tre cose…» e tre riquadri numerati. «1 · Il modulo del cliente» ha già `Moduli/Richiesta stato avanzamento.xlsx`; «2 · Che cosa va in ogni cella» ha già una riga per cella (D2, A4, C4…) e la tabella delle posizioni: si fa una volta per cliente. «3 · L'ordine» è «da fare».

3. **Scrivi l'ordine.** In «Numero dell'ordine» scrivi `ORD-2026-077`, in «Totale dell'ordine» `340.000`. Nelle posizioni scrivi `00001` e `100.000`; con «Aggiungi una posizione» aggiungi `00002` `60.000`, `00003` `142.000`, `00004` `38.000`. Premi «Salva».
   Atteso: mentre scrivi, sotto le posizioni compare «Le posizioni sommano 340.000,00.». Dopo il salvataggio si apre la pagina delle richieste: «Ordine ORD-2026-077», totale 340.000,00, chiesto finora 0,00, resta da chiedere 340.000,00.
   Dimostra: l'ordine è una tabella con una riga per posizione, non righe di testo con i separatori.

4. **Prepara la prima richiesta.** Premi «Nuova richiesta»: «Dal» il 1° marzo 2026, «Al» il 31 marzo 2026, importo `289.540`, fattura di riferimento `Fattura n. 101 del 31/03/2026`.
   Atteso: sotto «Come cambiano le posizioni», già mentre scrivi: 00001 e 00002 al 100,00%, 00003 al 91,23%, 00004 allo 0,00%.
   Dimostra: l'importo riempie le posizioni una dopo l'altra, e lo si vede prima di salvare.

5. **Salva e compila.** Premi «Salva e compila il modulo», poi «Apri il file».
   Atteso: «Modulo compilato in `_octo/avanzamento/Richiesta stato avanzamento - 1.xlsx`». Si apre Excel: è il modulo del cliente con numero della proposta, ordine e posizioni (`ORD-2026-077 - pos.00001:00004`), date, le quattro posizioni con le percentuali e la fattura; etichette, celle unite e lo spazio riservato al cliente sono intatti. In alto «Chiesto finora» è 289.540,00 e la barra è quasi piena.

6. **Chiudi l'ordine con la seconda richiesta.** Premi «Nuova richiesta»: «Dal» è già il 31 marzo. Metti «Al» il 30 aprile 2026, premi «Tutto ciò che resta: 50.460,00», fattura `Fattura da emettere il 30/04/2026`.
   Atteso: «Raggiunge il totale dell'ordine: tutte le posizioni chiudono al 100%»; «Precedente» è l'«Attuale» della richiesta 1; «Di periodo» 8,77% sulla 00003 e 100,00% sulla 00004. Premi «Salva senza compilare»: la richiesta 2 è in cima, aperta; la 1 è una riga che si apre con un clic.

7. **Prova un importo sbagliato.** Nella richiesta 2 premi «Correggi», cambia l'importo in `60.000`.
   Atteso: subito, sotto l'importo: «La richiesta 2 porta il totale chiesto 9.540,00 oltre il totale dell'ordine.» «Salva e compila il modulo» non salva. Premi «Annulla»: resta tutto com'era.

8. **Guarda le impostazioni.** Premi «Impostazioni» in alto a destra.
   Atteso: i tre riquadri del passo 2, ora tutti «fatto». In «Che cosa va in ogni cella» i pulsanti «Numero della richiesta», «Ordine», «Posizioni»… inseriscono il dato nella riga in cui stai scrivendo. «Chiudi» torna alle richieste.

## Che cosa dimostra
- Le percentuali vengono solo dagli importi dell'ordine e delle richieste: nessuna cifra presa altrove.
- Il modulo resta quello del cliente: si scrive una copia, solo nelle celle indicate dalla mappa.
- La mappa delle celle è un'impostazione del progetto, non codice: un altro cliente, un altro modulo.

## Che cosa non fa ancora
- Non legge le posizioni dal PDF dell'ordine: si scrivono una volta.
- Non produce il PDF né appone firme.
- Non scrive l'email che accompagna il modulo: si chiede in «Deliverable».
