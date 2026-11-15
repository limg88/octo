# Demo 19 — Un solo stile per moduli, pulsanti e tabelle

Durata: 3 minuti. Mostra l'aspetto nuovo dell'app, asciutto e denso sul modello di Linear: campi, pulsanti e tabelle uguali in tutte le schede, che l'azione principale si riconosce e che il fuoco da tastiera si vede ovunque. È il secondo incremento di `docs/valutazione-interfaccia.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: i dati sono finti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/19-stile/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Fonti» e apri una riga.** Premi «Collega» su «Posta», poi su «NetSuite»; guarda anche le parti «Persone e calendario» e «Avanzate».
   Atteso: ovunque gli stessi campi (bordo sottile, stessa altezza, etichetta sopra); nei menu la freccia è disegnata staccata dal bordo destro. In ogni modulo un solo pulsante blu: quello che salva. «Riempi la memoria ora» è blu. La scheda in uso è una pastiglia grigia, non una riga sottolineata.

3. **Apri «Previsionale».**
   Atteso: gli stessi campi di «Fonti». «Salva» è grigio finché non indichi il modello, e si legge. «Ore in una giornata» è un campo corto, non largo quanto la pagina.

4. **Apri «Avanzamento».**
   Atteso: tre riquadri numerati con il bordo arrotondato; i campi delle celle e delle posizioni sono righe allineate; «Salva» è l'unico pulsante blu della pagina; «Aggiungi una cella» e «Aggiungi una posizione» sono pulsanti normali, la «×» di ogni riga è senza cornice.

5. **Usa solo la tastiera.** Premi Tab più volte.
   Atteso: ogni campo e menu prende il bordo blu con un alone; ogni pulsante un contorno blu.

6. **Passa il mouse su una tabella.** Apri «Deliverable», premi «Registro» e passa sulle righe; oppure, con un ordine già scritto, sulla tabella di una richiesta in «Avanzamento».
   Atteso: i numeri sono incolonnati; nelle tabelle dei dati la riga sotto il mouse si evidenzia.

7. **Stringi la finestra al minimo.**
   Atteso: le schede vanno a capo su due righe; «Fonti» resta raggiungibile.

## Che cosa dimostra
- Un solo insieme di regole per pulsanti (principale, normale, senza cornice, distruttivo), campi, moduli, fuoco e tabelle: tutte in `styles.css`.
- Il blu non è più di «Salva» per caso: segna l'azione per cui una pagina o un modulo esistono.

## Limiti
- Non cambia che cosa si scrive nei campi: le righe con i separatori e i percorsi a mano restano (incrementi 3 e 6).
- Il tema scuro ha i suoi colori ma non è stato guardato a schermo.
- Il bordo dei campi è volutamente tenue: si distinguono per bordo e ombra, non per contrasto forte.
