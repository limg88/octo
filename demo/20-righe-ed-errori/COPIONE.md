# Demo 20 — Niente righe scartate in silenzio, errori che dicono che cosa fare

Durata: 4 minuti. Mostra che una riga scritta male non sparisce più al salvataggio: Octo non salva e dice quale riga e perché, sotto il campo. E che gli errori nominano ciò che manca. È il terzo incremento di `docs/valutazione-interfaccia.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: i dati sono finti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/20-righe-ed-errori/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Scrivi una persona e un periodo a metà.** Apri «Impostazioni» e, in alto, la parte «Persone e calendario». Nella prima riga delle persone scrivi solo il ruolo `sviluppatore`; nel calendario il nome `Sprint 1` e solo la data «Dal». Premi «Salva persone e calendario».
   Atteso: sotto le persone «Persona 1: manca il nome.»; sotto il calendario «Periodo 1: servono il nome e le due date.»; accanto al pulsante «Non ho salvato: correggi ciò che è segnalato sotto i campi.»
   Dimostra: prima una riga incompleta spariva al salvataggio e la risposta era una conferma verde. Una parte che non è «nostra» o «cliente» e una data che non esiste non si possono più nemmeno scrivere: sono un menu e un campo data.

3. **Correggi.** Nome `Mario Rossi`, «Al» del periodo il 13 novembre 2026, poi salva.
   Atteso: «Salvati: 1 persona e 1 periodo.» e nessun avviso.

4. **Collega Jira a metà.** Torna alla parte «Collegamenti», premi «Collega» nella riga «Jira» e poi «Prova e salva» senza scrivere nulla.
   Atteso: sotto «Sito», «La tua email su Jira», «Progetti» e «API token» compare «Manca: va compilato per collegare il sistema.»; accanto ai pulsanti «Non ho provato il collegamento: compila i campi segnalati.»
   Dimostra: prima la risposta era «Controlla il giorno di inizio e la cartella», i due soli campi già compilati.

5. **Scrivi un ordine con una posizione sbagliata.** Apri «Avanzamento». In «Totale dell'ordine» scrivi `mille`; nelle posizioni `00001` e `1000`, poi con «Aggiungi una posizione» `00002` e `mille`. Premi «Salva».
   Atteso: sotto il totale «Non è un numero che capisco…»; sotto le posizioni «Posizione 2: servono un codice e un importo scritto in cifre…». Accanto a «Salva»: «Non ho salvato…».
   Dimostra: prima una posizione scritta male spariva e le percentuali si calcolavano sulle altre.

6. **Correggi e sbaglia l'importo di una richiesta.** Totale `1.000`, togli la posizione 2 con la «×» e salva. Premi «Nuova richiesta» e scrivi l'importo `5000`.
   Atteso: subito, sotto l'importo: «La richiesta 1 porta il totale chiesto 4.000,00 oltre il totale dell'ordine.» «Salva e compila il modulo» non salva. Con «Tutto ciò che resta: 1.000,00» l'importo torna giusto.

7. **Chiedi una lettura a un sistema non collegato.** Apri «Ore» e premi «Leggi i timesheet da NetSuite».
   Atteso: «NetSuite non è collegato a questo progetto: collegalo in «Impostazioni», poi torna qui a leggere i timesheet.» con il pulsante «Apri «Impostazioni»», che porta alla scheda. Lo stesso in «Cruscotto» con «Leggi da Azure DevOps».
   Dimostra: prima la risposta era «Questa fonte non è ancora configurata», senza dire quale.

8. **Guarda un «Salva» spento.** In «Ore», accanto a «Salva».
   Atteso: «Per salvare indica dove sono i timesheet e le ore del tracker.»

## Che cosa dimostra
- Ciò che Octo non capisce viene detto, con la riga, il motivo e la forma giusta; finché c'è un errore non si salva nulla.
- Gli errori stanno sotto il campo o accanto al pulsante che li ha provocati, e dicono che cosa manca e dove andare.

## Limiti
- I campi a righe con i separatori non ci sono più (incremento 6): restano liste separate da virgola per tag, persone attese e codici, che diventeranno selezioni.
- Un «Salva» riuscito non dà ancora una conferma uguale in tutte le schede.
- Gli errori che arrivano dai sistemi (credenziale rifiutata, sistema che non risponde) sono quelli di prima.
