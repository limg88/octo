# Richieste per Verbale

Limiti trovati integrando Verbale in Octo (tappa T1) che si risolvono bene solo dal lato di Verbale. Verbale non è stato toccato: per ognuno Octo ha un ripiego, descritto qui. Fonte del contratto letto: `verbale/Sources/VerbaleCore/SessionStore.swift` e `Domain.swift`.

## 1. Dire dove si esporta

**Cosa.** Un file stabile che dica qual è la cartella di esportazione corrente.

**Perché.** Verbale la tiene come segnalibro del sistema nelle proprie preferenze (`destinationBookmark`), che un'altra app non può leggere in modo affidabile. Octo oggi la ricava dal campo `destination` dei manifest interni delle sessioni (`~/Library/Application Support/Verbale/Sessions/<id>/meeting.json`): è un dettaglio interno, non un contratto, e non dice nulla finché non c'è almeno una sessione.

**Contratto atteso.** `~/Library/Application Support/Verbale/export.json`, riscritto a ogni cambio di cartella:
```json
{ "schemaVersion": 1, "destination": "/Users/…/Riunioni" }
```

**Ripiego in Octo.** Legge il `destination` delle cinque sessioni più recenti e propone la prima cartella che esiste; se non ne trova, il PM la sceglie.

## 2. Riesportazione riconoscibile mentre avviene

**Cosa.** Durante una riesportazione, un segno che i documenti stanno cambiando.

**Perché.** `meeting.json` è scritto per ultimo e vale come «esportazione conclusa» solo la prima volta. In una riesportazione il manifest vecchio è già lì mentre `transcript.md` e gli altri vengono riscritti: chi legge in quel momento prende un misto di vecchio e nuovo senza poterlo sapere.

**Contratto atteso.** Una delle due: togliere `meeting.json` all'inizio di ogni esportazione e riscriverlo alla fine; oppure aggiungere al manifest `exportedAt` (istante) e `exportRevision` (intero crescente), e scrivere un file `.exporting` per la durata dell'esportazione.

**Ripiego in Octo.** A ogni lettura riscrive i file che differiscono: un misto preso a metà viene corretto alla lettura successiva (al più 15 minuti dopo).

## 3. Legame con l'evento di calendario

**Cosa.** Nel manifest, l'identificativo dell'evento da cui è partita la registrazione, quando Verbale lo conosce (chiamata Teams rilevata).

**Perché.** Octo attribuisce la riunione al progetto confrontando `started` e `duration` con gli inviti in posta: funziona, ma due riunioni alla stessa ora in due progetti restano ambigue, e le riunioni ricorrenti hanno in posta un solo invito con la data della prima occorrenza.

**Contratto atteso.** Campi facoltativi in `meeting.json`:
```json
{ "calendarEventUID": "…", "onlineMeetingURL": "https://teams.microsoft.com/…" }
```

**Ripiego in Octo.** Sovrapposizione di orario con gli inviti in memoria; poi parole chiave del progetto in titolo e appunti; altrimenti segnalazione in «Oggi» e assegnazione a mano.

## 4. Partecipanti

**Cosa.** L'elenco dei partecipanti, distinto dai nomi dati alle voci.

**Perché.** Il manifest ha solo `speakers` (etichetta della voce → nome), compilato quando qualcuno ha dato un nome a una voce o un profilo vocale è stato riconosciuto. Chi era presente e non ha parlato non c'è; chi ha parlato senza nome compare come «Microfono» o «Audio di sistema».

**Contratto atteso.** Campo facoltativo `participants`: `[{ "name": "…", "email": "…" }]`.

**Ripiego in Octo.** In `_meta.md` i partecipanti sono i nomi distinti di `speakers`; se non ce ne sono, la riga non c'è.

## 5. Manifest leggero

**Cosa.** I pochi campi che servono a chi importa, in un file piccolo.

**Perché.** `meeting.json` contiene l'intera riunione (segmenti con i tempi di ogni parola, impronte dei modelli): per una riunione di un'ora è dell'ordine del megabyte, e Octo deve leggerlo tutto per sapere titolo, data, durata e stato.

**Contratto atteso.** Un `export.json` nella cartella della riunione con `schemaVersion`, `id`, `title`, `started`, `timezone`, `duration`, `state`, `exportedAt`, e i campi dei punti 3 e 4. `meeting.json` resta com'è.

**Ripiego in Octo.** Rilegge un manifest solo se data di modifica o dimensione sono cambiate.
