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

2. **Scrivi una persona e un periodo sbagliati.** Apri «Fonti» e scendi a «Persone e calendario». In «Persone» scrivi `Mario Rossi; sviluppatore; boh; 32/13/2026`, in «Calendario» `Sprint 1; ieri; domani`. Premi «Salva persone e calendario».
   Atteso: sotto il primo campo «Riga 1, «Mario Rossi; sviluppatore; boh; 32/13/2026»: la parte è «nostra» oppure «cliente».»; sotto il secondo «Riga 1, «Sprint 1; ieri; domani»: c'è una data che non esiste o non è scritta come giorno/mese/anno.»; accanto al pulsante «Non ho salvato: correggi ciò che è segnalato sotto i campi.»
   Dimostra: prima «boh» diventava «nostra», il periodo spariva e la risposta era «Salvate 1 persone e 0 periodi».

3. **Correggi.** Scrivi `Mario Rossi; sviluppatore; nostra; 01/03/2026` e `Sprint 1; 02/11/2026; 13/11/2026`, poi salva.
   Atteso: «Salvate 1 persone e 1 periodi.» e nessun avviso.

4. **Collega Jira a metà.** In «Jira» premi «Prova e salva» senza scrivere nulla.
   Atteso: sotto «Sito», «La tua email su Jira», «Progetti» e «API token» compare «Manca: va compilato per collegare il sistema.»; accanto ai pulsanti «Non ho provato il collegamento: compila i campi segnalati.»
   Dimostra: prima la risposta era «Controlla il giorno di inizio e la cartella», i due soli campi già compilati.

5. **Scrivi un ordine con una riga sbagliata.** Apri «Avanzamento». In «Totale dichiarato dall'ordine» scrivi `mille`; in «Posizioni dell'ordine»:
   ```
   00001; 1000
   pippo
   00002; mille
   ```
   Premi «Salva».
   Atteso: sotto il totale «Non è un numero che capisco…»; sotto le posizioni «Riga 2, «pippo»: scrivila nella forma «codice; importo».» e «Riga 3, «00002; mille»: c'è un numero che non capisco…». Nulla è salvato.
   Dimostra: prima le due righe sparivano e le percentuali si calcolavano su una posizione sola.

6. **Correggi e sbaglia l'importo.** Totale `1.000`, posizioni `00001; 1000`; premi «Aggiungi una richiesta», importo `5000`, «Salva».
   Atteso: «La richiesta 1 porta il totale chiesto 4.000,00 oltre il totale dell'ordine.» e il modulo «Ordine e richieste» resta aperto, con i campi da correggere in vista.

7. **Chiedi una lettura a un sistema non collegato.** Apri «Ore» e premi «Leggi i timesheet da NetSuite».
   Atteso: «NetSuite non è collegato a questo progetto: collegalo in «Fonti», poi torna qui a leggere i timesheet.» con il pulsante «Apri «Fonti»», che porta alla scheda. Lo stesso in «Cruscotto» con «Leggi da Azure DevOps».
   Dimostra: prima la risposta era «Questa fonte non è ancora configurata», senza dire quale.

8. **Guarda un «Salva» spento.** In «Ore», accanto a «Salva».
   Atteso: «Per salvare indica dove sono i timesheet e le ore del tracker.»

## Che cosa dimostra
- Ciò che Octo non capisce viene detto, con la riga, il motivo e la forma giusta; finché c'è un errore non si salva nulla.
- Gli errori stanno sotto il campo o accanto al pulsante che li ha provocati, e dicono che cosa manca e dove andare.

## Limiti
- I campi restano righe con i separatori: diventano tabelle nell'incremento 6.
- Un «Salva» riuscito non dà ancora una conferma uguale in tutte le schede.
- Gli errori che arrivano dai sistemi (credenziale rifiutata, sistema che non risponde) sono quelli di prima.
