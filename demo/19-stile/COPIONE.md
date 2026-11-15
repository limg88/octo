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

2. **Apri «Fonti» e scorri fino in fondo.**
   Atteso: Posta, Azure DevOps, Jira, NetSuite, «Persone e calendario» e «Modelli» hanno gli stessi campi (bordo sottile, stessa altezza, etichetta sopra); nei menu la freccia è disegnata staccata dal bordo destro e lo stesso margine sinistro. In ogni sezione un solo pulsante blu: quello che salva. «Riempi la memoria ora» è blu; «Scollega», dove c'è, è un pulsante senza cornice, che si evidenzia al passaggio. La scheda in uso è una pastiglia grigia, non una riga sottolineata.

3. **Apri «Previsionale».**
   Atteso: gli stessi campi di «Fonti». «Salva» è grigio finché non indichi il modello, e si legge. «Ore in una giornata» è un campo corto, non largo quanto la pagina.

4. **Apri «Avanzamento» e compila il minimo.** In «Posizioni dell'ordine» scrivi `00001; 1000`, premi «Aggiungi una richiesta», importo `500`, poi «Salva».
   Atteso: «Compila il modulo della richiesta 1» è il pulsante blu della pagina. «Ordine e richieste» è un pulsante con la freccia: aprilo, le richieste sono riquadri con il bordo arrotondato e «Togli la richiesta 1» è un pulsante senza cornice.

5. **Usa solo la tastiera.** Con «Ordine e richieste» aperto premi Tab più volte.
   Atteso: ogni campo, data e menu prende il bordo blu con un alone; ogni pulsante un contorno blu.

6. **Passa il mouse su una tabella.** Sulla tabella della richiesta 1.
   Atteso: la riga sotto il mouse si evidenzia; i numeri sono incolonnati.

7. **Stringi la finestra al minimo.**
   Atteso: le schede vanno a capo su due righe; «Fonti» resta raggiungibile.

## Che cosa dimostra
- Un solo insieme di regole per pulsanti (principale, normale, senza cornice, distruttivo), campi, moduli, fuoco e tabelle: tutte in `styles.css`.
- Il blu non è più di «Salva» per caso: segna l'azione per cui una pagina o un modulo esistono.

## Limiti
- Non cambia che cosa si scrive nei campi: le righe con i separatori e i percorsi a mano restano (incrementi 3 e 6).
- Il tema scuro ha i suoi colori ma non è stato guardato a schermo.
- Il bordo dei campi è volutamente tenue: si distinguono per bordo e ombra, non per contrasto forte.
