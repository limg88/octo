# Demo 22 — Il giro completo di Octo

Durata: 5 minuti. Una sola demo per tutto: due progetti, le fonti (con Confluence), una domanda, un deliverable, il cruscotto, le ore, il previsionale, l'avanzamento, l'allineamento e la gestione dei progetti. Mostra insieme i tredici incrementi di `docs/valutazione-interfaccia.md` e Confluence come fonte.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: progetti, posta, Azure DevOps, Jira e Confluence sono finti e vivono su questo computer finché la finestra è aperta.
- Ciò che un PM imposta una volta (file del cruscotto, cartelle delle ore, modello del previsionale, sprint) è già impostato, così il giro mostra risultati e non moduli.

Credenziali finte, se vuoi collegare anche gli altri sistemi: Azure DevOps organizzazione `contoso`, progetto `Aurora`, token `demo-pat`; Jira sito `demo`, email `pm@example.test`, token `demo-token`, progetto `AUR`.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/22-giro-completo/run.sh
   ```
   Atteso: si apre Octo su «Aurora». In cima alla colonna di sinistra il selettore del progetto; sotto, le sezioni: «Lavoro» (Chiedi, Deliverable, Cruscotto), «Ogni mese» (Ore, Previsionale, Avanzamento), «Ogni sprint» (Allineamento), «Progetto» (Impostazioni).
   Dimostra: il progetto in uso si vede sempre; ciò che si usa ogni giorno è in cima, ciò che si imposta una volta in fondo.

2. **Collega Confluence.** Apri «Impostazioni» e premi «Collega» nella riga «Confluence». Scrivi sito `demo`, email `pm@example.test`, API token `demo-token` (l'icona «i» accanto al token spiega dove si crea). Premi «Cerca gli spazi», scegli «Aurora (AUR)», poi «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.» La riga di Confluence passa a collegata.
   Dimostra: una fonte è una riga con il suo stato; gli spazi si scelgono da un elenco, non si scrivono; senza almeno uno spazio non si salva.

3. **Riempi la memoria.** Chiudi la riga e premi «Riempi la memoria ora».
   Atteso: l'anello che gira durante la lettura, poi «Fatto. Ora puoi fare domande» e il conteggio per fonte, fra cui «Confluence: 2 nuovi o aggiornati».
   Dimostra: le pagine di Confluence entrano nella memoria del progetto come posta e documenti.

4. **Fai una domanda.** Apri «Chiedi», scrivi `Quando consegniamo il modulo ordini?` e premi «Chiedi».
   Atteso: la risposta con «1 fonte controllata» e il collegamento alla fonte.

5. **Prepara un deliverable.** Apri «Deliverable», scegli «Email al cliente». Riempi «A chi scrivi» (`Carla Bianchi`), «Di che cosa» (`Data di consegna`), «Che cosa chiedi o comunichi» (`Confermare la data del collaudo`) e premi «Scrivi la bozza».
   Atteso: la bozza con le fonti e il pulsante «Approva».
   Dimostra: ogni domanda ha il suo campo; niente righe da scrivere con una sintassi.

6. **Guarda il cruscotto.** Apri «Cruscotto».
   Atteso: i numeri sono già lì: 15 bug aperti su 30 nel perimetro, 10 in lavorazione, 5 in verifica, 2 validati in attesa di rilascio, 11 fermi da oltre 30 giorni. «Leggi da Azure DevOps» è in alto; senza collegamento dice «Azure DevOps non è collegato…» con il pulsante che porta alle impostazioni.
   Dimostra: la prima cosa da fare è in cima; un errore porta dove si risolve.

7. **Guarda le ore.** Apri «Ore».
   Atteso: «Quadratura: 664 ore approvate, tutte nel confronto». Con «Mese precedente» compare «Nessuna ora nel periodo.»; con «Mese successivo» si torna al mese con i dati.
   Dimostra: il mese si cambia con due frecce, non si scrive.

8. **Compila il previsionale.** Apri «Previsionale». Sotto ciò che manca, nella riga «manca la tariffa al giorno di Costa Elena», scrivi `400` e premi «Salva». Poi premi «Compila il modello».
   Atteso: «Salvato.» accanto alla riga, poi «Modello compilato in…» con il percorso del file.
   Dimostra: il rimedio sta accanto al dato che manca; ogni salvataggio lo dice nello stesso punto.

9. **Chiedi un avanzamento.** Apri «Avanzamento». In «Impostazioni dell'ordine e del modulo» scrivi il numero dell'ordine `ORD-2026-077`, la posizione `00001` con importo `100.000`, e salva. Premi «Nuova richiesta», scrivi l'importo `40.000` e premi «Salva e compila il modulo».
   Atteso: accanto all'importo compare «40,00%»; poi «Modulo compilato in…».
   Dimostra: l'ordine si imposta una volta; ogni richiesta è un modulo breve con la percentuale calcolata.

10. **Guarda l'allineamento.** Apri «Allineamento».
    Atteso: «6 voci del cliente nello sprint: 3 con il ticket nello sprint, 1 con il ticket altrove, 2 senza ticket.» Lo sprint è un menu.

11. **Cambia progetto e toglilo.** Apri il selettore in alto a sinistra e scegli «Boreale»; torna su «Aurora» con ⌘1. Riapri il selettore, «Gestisci i progetti…», «Togli» accanto a Boreale, conferma. Poi premi «Rimettilo in elenco».
    Atteso: la conferma dice che cosa resta sul disco; Boreale sparisce dall'elenco e torna con un clic, con le sue impostazioni.
    Dimostra: togliere un progetto chiede conferma e si può annullare.

Per finire chiudi la finestra: i sistemi finti si fermano da soli.

## Varianti
- `KEEP=1 bash demo/22-giro-completo/run.sh` riapre i progetti del giro precedente senza ricrearli.
- `REAL=1 bash demo/22-giro-completo/run.sh` usa Claude Code con il tuo accesso al posto di quello finto (i dati restano finti).

## Che cosa non dimostra
- Confluence, Azure DevOps e Jira veri: qui rispondono sistemi finti. Confluence non è mai stato provato su un sito vero.
- Le finestre di scelta di file e cartelle, che sono del sistema.
