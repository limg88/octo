# Demo 26 — Correzioni dell'interfaccia: Claude trovato, tabelle in ordine, impostazioni al loro posto

Durata: 5 minuti. Otto difetti segnalati sull'app installata, uno per passo.

## Prerequisiti
- Node 24, pnpm 12, macOS o Linux con `zsh`.
- Nessun accesso a Claude né ad altri sistemi: posta, tracker e Claude sono finti e vivono su questo computer.
- Chi entra è già «Paola Verdi».

## Passi

1. **Claude Code si trova anche senza il PATH del terminale.**
   ```bash
   bash demo/26-correzioni-interfaccia/run.sh
   ```
   La demo avvia Octo come dal Finder: PATH ridotto a `/usr/bin:/bin`, e Claude Code (finto) in una cartella che solo il profilo della shell conosce, come con un gestore di versioni di Node.
   Atteso: nessun avviso «Claude non è installato»; in fondo alla colonna di sinistra c'è «Claude» con la versione.
   Controprova: chiudi e rilancia con `KEEP=1 NO_SHELL=1 bash demo/26-correzioni-interfaccia/run.sh`. Ora il profilo non dice nulla: compare una riga ambra «Claude non è installato su questo computer» con il pulsante «Riprova», e la pagina sotto resta tutta in vista. Chiudi e rilancia senza `NO_SHELL`.
   Dimostra: Octo chiede il PATH alla shell di login; l'avviso, quando serve, è una riga e non mezza pagina.

2. **«Da tenere d'occhio» è una tabella.** In «Oggi» scorri fino a «Da tenere d'occhio».
   Atteso: tre colonne — «Che cosa», «Dettaglio» e i pulsanti —; «Apri …» e «×» sono incolonnati a destra e non vanno a capo, qualunque sia la lunghezza del titolo.
   Dimostra: le azioni di una riga stanno sempre nello stesso posto.

3. **Le impostazioni di «Oggi» stanno in «Impostazioni».** In fondo a «Oggi» premi «Impostazioni di «Oggi»».
   Atteso: si apre «Impostazioni» sulla parte «Pagina «Oggi»»: gli indirizzi che Octo considera tuoi, il campo per aggiungerne, i tipi di segnalazione che non mostri. In «Oggi» il blocco non c'è più.
   Dimostra: ciò che si imposta una volta non occupa la pagina di ogni giorno.

4. **Cruscotto: segnali in riga, tabella ordinabile e filtrabile.** Apri «Cruscotto» e scorri ai requisiti poco chiari.
   Atteso: ogni segnale è un'etichetta intera con la sua «×» dentro; l'etichetta non si spezza su due righe e «È chiaro» resta nella sua colonna. Premi l'intestazione «Id»: le righe si ordinano e compare ▲; ancora: ▼; ancora: l'ordine di partenza. Scrivi una parola in «Filtra»: restano le righe che la contengono, con «n di m».
   Dimostra: le colonne tengono il loro posto; ogni tabella si ordina e si filtra allo stesso modo.

5. **Previsionale: ciò che calcola Octo e ciò che scrivi tu.** Apri «Previsionale».
   Atteso: l'intestazione ha due gruppi, «Calcolato da Octo» e «Da te, per questo mese». Nel primo i numeri, e sotto ogni riga «Come è calcolato»; nel secondo tre campi: «Ricavi corretti», «Da fatturare», «Tua nota». Sopra, una riga spiega che cosa fa ogni campo. «Altri dati» apre sotto la riga le ore degli esterni e i costi totali.
   Dimostra: un campo non sta più sotto un numero senza dire che cos'è.

6. **Tag in un elenco che si cerca.** Apri «Allineamento», poi «Che cosa confronto».
   Atteso: «Tag delle voci» mostra in alto i tag scelti come etichette con «×», un campo «Cerca fra 32 valori» e un elenco di altezza fissa che scorre. Scrivi `3.2`: restano i tag che lo contengono. Spunta `3.21.0`: compare fra gli scelti. Toglilo con la sua «×».
   Dimostra: l'elenco occupa lo stesso spazio con 5 tag o con 500.

7. **Allineamento: tabelle ordinabili.** Sotto, premi l'intestazione «Titolo» di una delle tabelle.
   Atteso: le righe si ordinano; la colonna degli identificativi è stretta, il titolo ha lo spazio che resta.
   Dimostra: lo stesso componente per ogni tabella.

8. **Persone e calendario.** Apri «Impostazioni», parte «Persone e calendario». Premi più volte «Aggiungi un periodo» e scrivi qualche nome (per esempio «Sprint 20» … «Sprint 28»).
   Atteso: ogni elenco sta in un riquadro con il numero di righe; le intestazioni delle colonne restano in vista mentre l'elenco scorre dentro il riquadro; da otto righe compare «Filtra». Passando il mouse su un valore troncato si legge per intero.
   Dimostra: in ogni riga si sa sempre che cosa contiene ogni campo.

9. **Solo le voci delle nostre persone.** In «Impostazioni» › «Persone e calendario» segna una persona come «fornitore» con il nome di un assegnatario del tracker (per esempio «Luca Verdi») e salva. In «Cruscotto» apri «Impostazioni del cruscotto», spunta «Solo le voci assegnate alle nostre persone» e salva.
   Atteso: i conteggi dei bug scendono: restano solo i bug assegnati a quella persona, anche se il tracker scrive «Verdi Luca». Togli la spunta: tornano tutti. La stessa spunta c'è in «Allineamento» › «Che cosa confronto».
   Dimostra: il perimetro è tag e persona insieme; chi non è dei nostri, o non è assegnato, resta fuori dai numeri ma non dalla memoria che «Chiedi» legge.

## Test
```bash
pnpm test
pnpm test:coverage
```
