# Demo 27 — Chat che ricordano, un modello per ogni tipo di deliverable, l'ordine confrontato con NetSuite

Durata: 5 minuti.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né a NetSuite: Claude è finto, e le fatture di NetSuite sono un file scritto dalla demo nel progetto, come lo scriverebbe la lettura vera.
- Chi entra è già «Paola Verdi».

## Passi

1. **«Chiedi» si apre su una chat nuova.**
   ```bash
   bash demo/27-chat-modelli-avanzamento/run.sh
   ```
   Apri «Chiedi».
   Atteso: a sinistra «Nuova chat» (in evidenza) e sotto una voce «Domande precedenti · 2 domande»; a destra la pagina è vuota e dice «Chat nuova: fai una domanda…».
   Dimostra: entrando non si riparte dal fondo di tutta la cronologia; le domande fatte prima che esistessero le chat restano raccolte in una voce.

2. **Una chat ricorda.** Scrivi «Quando consegniamo il modulo ordini?» e invia. Poi, nella stessa chat, scrivi «E se slitta?» e invia.
   Atteso: la prima risposta è «La consegna è il 12 dicembre [1]». La seconda comincia con «Riprendo dalla domanda «Quando consegniamo il modulo ordini?»…» e ha comunque la sua citazione, controllata sul file. Nell'elenco a sinistra è comparsa la chat con il titolo della prima domanda e «2 domande».
   Dimostra: la seconda domanda è arrivata a Claude insieme alla prima e alla sua risposta; le risposte precedenti sono contesto, non fonti: la citazione viene di nuovo dai file.

3. **Riprendi una chat vecchia, aprine una nuova.** Premi «Domande precedenti»: compaiono le due domande di prima, una con la risposta e una con l'errore. Premi «Nuova chat» e chiedi «Chi è il referente?».
   Atteso: la risposta non comincia con «Riprendo…»: questa chat non sa nulla delle altre. A sinistra ci sono ora tre voci, la più recente in alto.
   Dimostra: ogni chat è un filo a sé; quella vecchia si riapre con un clic.

4. **Nessun modello sempre in vista.** Apri «Deliverable».
   Atteso: sotto i tipi c'è solo «Crea un tipo tuo»: «Carta intestata» e «Modello delle presentazioni» non ci sono più.
   Apri «Impostazioni», parte «Carta intestata»: la carta intestata del progetto sta qui.
   Dimostra: ciò che vale per tutto il progetto sta nelle impostazioni; ciò che è di un tipo sta nel tipo.

5. **Un modello Word per un tipo.** Torna a «Deliverable» e scegli «Note di rilascio». In «Modello di questo tipo» premi «Scegli un modello (.docx o .pptx)» e scegli `Modelli/Nota di rilascio - modello.docx` nella cartella del progetto (il percorso è stampato dal terminale).
   Atteso: compare «Word — la bozza ha le sezioni del documento, e il file Word esce sulla sua carta», con «Togli».
   Compila i campi obbligatori e premi «Scrivi la bozza».
   Atteso: la bozza ha esattamente le sezioni del modello — «Premessa», «Che cosa cambia», «Per chi usa il sistema», «Che cosa resta da fare» — e in «Informazioni mancanti» le sezioni per cui il progetto non dice nulla. Premi «Approva» e apri il file Word: in testa a ogni pagina c'è «Fornitore Demo S.p.A. — Nota di rilascio», l'intestazione del modello; il testo di esempio del modello non c'è.
   Dimostra: il modello Word dà al tipo la struttura e la carta. Apri «Email al cliente»: lì il modello non c'è.

6. **Un modello PowerPoint per un tipo qualsiasi.** Scegli «Storia con criteri di accettazione», premi «Scegli un modello» e scegli `Presentazioni/Stato avanzamento - periodo scorso.pptx`.
   Atteso: compare «PowerPoint — la bozza segue le slide della presentazione, e l'approvato esce anche in PowerPoint».
   Dimostra: la presentazione è del tipo a cui la dai, non del progetto.

7. **Un tipo tuo, con il suo modello.** «Nuovo deliverable», «Crea un tipo tuo»: scrivi titolo «Nota per il comitato» e in «Come va scritto» una riga qualsiasi. Premi «Salva e scegli un modello».
   Atteso: si apre subito la finestra di scelta del file; scelto il `.docx`, il tipo è nel catalogo e, aprendolo, «Modello di questo tipo» mostra «Word».
   Dimostra: un tipo nuovo nasce già con il suo modello.

8. **L'ordine confrontato con NetSuite.** Apri «Avanzamento».
   Atteso: l'ordine ING01526 vale 231.700,00 e «Chiesto finora» è 0,00: in Octo non c'è nessuna richiesta. Sotto, «Che cosa risulta su NetSuite» spiega che NetSuite non conosce il numero d'ordine del cliente e propone «SO2026_5320: ha fatture con gli stessi importi delle posizioni», già spuntato. Premi «Collega».
   Atteso: i riquadri diventano quattro: «Fatturato su NetSuite» 105.320,00 e «Resta da chiedere» 126.380,00. La tabella dice, posizione per posizione: 00001 e 00002 «Fatturata» con il numero e la data della fattura, 00003 e 00004 «Non fatturata». Una riga ambra: «2 fatture non sono fra le richieste di Octo: 2026/01530, 2026/01797».
   Dimostra: lo stato dell'ordine viene dalle fatture emesse, non da ciò che è stato scritto in Octo.

9. **Allinea Octo a NetSuite.** Premi «Registra come richieste già fatte».
   Atteso: compaiono «Richiesta 1» e «Richiesta 2», ognuna con la fattura come riferimento, le date concatenate e la posizione del suo importo; «Chiesto finora» è 105.320,00 e la riga ambra è sparita. «Nuova richiesta» propone la numero 3 con «Tutto ciò che resta: 126.380,00».
   Dimostra: le richieste fatte fuori da Octo entrano con un clic, e la prossima parte dal punto giusto.

## Test
```bash
pnpm test
pnpm test:coverage
```
