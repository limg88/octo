# Demo 34 — Il cruscotto in tre schede, con un elenco dei bug che si lavora

Durata: 5 minuti. Mostra il cruscotto letto in tre parti («Sprint», «Bug», «Andamento»): i bug divisi per gravità e per persona, con ogni riga che fa da filtro; il collegamento al bug su Azure DevOps; i numeri confrontati con l'inizio del periodo scelto; lo sprint con le storie per stato, ciò che è a rischio e il confronto con gli sprint prima; i requisiti poco chiari solo per lo sprint che sta per essere pianificato; le decisioni prese, che si rileggono e si ripristinano. Ogni cifra è calcolata dal codice: Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso ad Azure DevOps vero: lo script ne avvia uno finto su questo computer, già collegato al progetto, con persone e calendario degli sprint già scritti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/34-cruscotto-schede-e-bug/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Cruscotto» e premi «Leggi da Azure DevOps».**
   Atteso: «Lette 23 voci, 23 con la cronologia, alle …», poi «Dati aggiornati» e tre schede: «Sprint», «Bug», «Andamento». È aperta «Bug».
   Dimostra: il periodo e l'età dei dati stanno sopra le schede e valgono per tutte.

3. **Leggi i numeri.**
   Atteso: «Bug aperti» 5, con sotto «+3 da inizio periodo»; «Fermi da oltre 30 giorni» 2, «+2 da inizio periodo». Premi «3 mesi»: le differenze cambiano, l'elenco no.
   Dimostra: ogni numero dice se va meglio o peggio rispetto all'inizio del periodo, dalla cronologia dei cambi di stato. Senza cronologia la pagina lo dice e non stima.

4. **Filtra dalle ripartizioni.** Sotto i numeri: «Per gravità» e «Per persona», ogni riga con il conteggio e quanti sono fermi. Premi «Mario Rossi».
   Atteso: l'elenco resta con i 2 bug di Mario, «Filtri: 2 di 5» e l'etichetta «Persona: Mario Rossi ×». Premi anche «1 - Critical»: resta «Errore nel calcolo dell'IVA». «Togli i filtri» riporta l'elenco intero.
   Dimostra: ogni ripartizione è anche un filtro, e i filtri si sommano al numero scelto in alto.

5. **Cerca e ordina.** Scrivi `pdf` in «Cerca per id o titolo»; poi svuota e scegli «Ordina per: Gravità».
   Atteso: prima un solo bug, poi i più gravi in cima.

6. **Apri un bug sul tracker.** Nel dettaglio a destra premi «Apri su Azure DevOps».
   Atteso: il browser apre `https://dev.azure.com/contoso/Aurora/_workitems/edit/301` (nella demo l'organizzazione è finta: la pagina chiede l'accesso).
   Dimostra: l'indirizzo lo costruisce Octo dalla fonte collegata; la finestra non ne riceve mai uno da fuori.

7. **Apri la scheda «Sprint».**
   Atteso: «Sprint 28 (in corso)» con le sue date e «Lo sprint è agli ultimi giorni»; storie: 5, di cui 1 da fare, 1 in lavorazione, 1 in verifica, 2 chiuse; il riquadro «A rischio: 2 storie non sono ancora in verifica». Premi «Chiuse»: restano le due chiuse.
   Sotto: «Bug dello sprint» (4 aperti) e «Sprint a confronto»: Sprint 27 ha 4 storie, 3 validate o chiuse, 2 chiuse in tempo, 1 ancora aperta.
   Dimostra: lo sprint in corso viene dal calendario del progetto; «chiuse in tempo» dalla cronologia delle storie.

8. **Guarda i requisiti poco chiari.**
   Atteso: «Controllo solo le storie del prossimo sprint: Sprint 29.» e due storie. Le due storie vaghe senza sprint («Notifiche push», «Tema scuro») non ci sono.
   Dimostra: il rumore del backlog non pianificato è tolto; i segnali sono scritti per esteso.

9. **Prendi una decisione e annullala.** Premi «È chiaro» su «Resi: richiesta dal portale».
   Atteso: la riga sparisce e in alto compare «Fatto. Annulla» per qualche secondo. Premi «Annulla»: la riga torna.
   Premi di nuovo «È chiaro», poi apri «Decisioni prese: 1»: la decisione è lì con la data e «Ripristina».
   Dimostra: nessuna decisione è più definitiva e invisibile.

10. **Apri la scheda «Andamento».**
    Atteso: il grafico delle settimane e «Dove si fermano i bug», con accanto a ogni mediana quella del periodo prima quando c'è.

## Che cosa dimostra
- La pagina si legge in tre parti; periodo ed età dei dati valgono per tutte.
- L'elenco dei bug si restringe per gravità, ambiente, persona e parole, e porta al tracker.
- «Fermo» ha una sola regola per Cruscotto e «Oggi»: più giorni della soglia.
- Lo sprint, il rischio a fine sprint e il confronto fra sprint sono calcolati dal codice dal tracker e dal calendario.

## Limiti
- L'ambiente di un bug non è letto da Azure DevOps: con la lettura diretta la ripartizione «Per ambiente» non compare (una ripartizione in cui nessun bug indica il valore non si mostra); compare con un'esportazione che lo porta.
- «Storie portate avanti» da uno sprint all'altro non si ricava: la cronologia tiene i cambi di stato, non i cambi di sprint. Il confronto mostra le storie ancora aperte in uno sprint finito e quelle chiuse dopo la sua fine.
