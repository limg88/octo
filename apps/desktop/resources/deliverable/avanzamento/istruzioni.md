# Modulo di avanzamento per posizione d'ordine

Che cosa produce: il modulo Excel del cliente compilato per una richiesta (una per fattura) e `quote.csv`, con la quota di ogni posizione dopo ogni richiesta.

Dove stanno i dati: in `config.json`, accanto a questo file.
- `order`: l'ordine come lo nomina il modulo.
- `total`: il totale dichiarato dell'ordine, per controllo (può mancare).
- `positions`: le posizioni dell'ordine, `code` e `amount`.
- `requests`: le richieste in ordine di tempo: `n`, `from` e `to` (AAAA-MM-GG), `amount` (solo di questa richiesta), `note` (la fattura di riferimento), `positions` (le posizioni su cui va; vuoto: dalla prima).
- `modelPath`: il modulo vuoto del cliente, un file Excel del progetto.
- `form.fields`: quale cella prende che cosa, con i nomi `{n}`, `{ordine}`, `{posizioni}`, `{dal}`, `{al}`, `{al_precedente}`, `{nota}`.
- `form.table`: dove sta la tabella delle posizioni (`firstRow`, `rows`, e le colonne `position`, `previous`, `current`, `period`).

Regole del calcolo, da non cambiare senza dirlo al PM:
- l'importo chiesto riempie le posizioni una dopo l'altra, sempre dal totale chiesto fin lì;
- la richiesta che raggiunge il totale dell'ordine chiude tutte le posizioni al 100%;
- un importo che supera l'ordine, o ciò che resta sulle posizioni nominate, ferma il calcolo;
- quote a quattro decimali, importi al centesimo.

Per aggiungere una richiesta: aggiungi una voce a `requests` in `config.json`, con il numero successivo.
