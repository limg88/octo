# Demo 80 — «Deliverable» rivisti: catalogo a elenco, rilettura in due parti, registro con i totali

Durata: 5 minuti. Terzo incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavole `DelivDopo`, `ApprDopo`, `D08`, `D11`).

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora» e Claude finto: nulla esce dal computer.

## Passi

1. **Avvia la demo e apri «Deliverable».**
   ```bash
   bash demo/80-deliverable-rivisti/run.sh
   ```
   Atteso: il catalogo è un elenco in un riquadro, con due gruppi, «Per il cliente · N» e «Interno · N»; ogni riga ha il nome in grassetto (250 px) e la descrizione su una riga, tagliata con i puntini. «Crea un tipo tuo» è sulla riga del titolo. «Nuovo deliverable» è pieno: sei nel catalogo.
   Sotto: «Memoria del progetto» con le sue tre righe e, per i deliverable con script, «Aggiungi al progetto» a destra nella riga.
2. **Scrivi una bozza.** «Email al cliente» → nel primo campo `Collaudo #inventa` → «Scrivi la bozza».
   Atteso: a sinistra una riga «Collaudo… · Da rivedere» (ambra), scelta con il fondo viola tenue. «Nuovo deliverable» non è più pieno: l'azione principale ora è «Approva».
   Sotto il titolo una riga sola: «Email al cliente · Per il cliente · 1 giro · modello …». Niente tempi di scrittura: sono nel registro.
3. **Leggi la «Rilettura»**, larga 336 px, a destra del testo.
   Atteso: due parti. «Calcolato da Octo»: quante citazioni sono riscontrate, quante informazioni mancano e l'elenco «Da confermare: non trovato nelle fonti» (non è più in fondo al testo). «Valutato da Claude»: il verdetto, i rilievi, «N rilievi da rivedere» come testo, «Da controllare prima di approvare», il campo, «Chiedi modifica» e «Approva».
   Dimostra: ciò che il codice ha contato e ciò che Claude ha giudicato non si confondono.
4. **Approva.** Segna «Visto» sul rilievo, svuota il campo e premi «Approva».
   Atteso: lo stato diventa «Approvato» (verde, con il bordo); compare la riga «File pronti» con un pulsante per file; in «Valutato da Claude» restano solo verdetto e rilievi: niente campo né pulsanti.
5. **Apri il «Registro».**
   Atteso: «Registro» ha il fondo viola tenue; colonne Data, Tipo, Oggetto (grassetto), Stato (etichetta), poi tre misure a destra. L'ultima riga, in grassetto, dice «Approvati: 1» e sotto ogni misura la sua somma.
6. **Stringi la finestra** sotto 1.120 px su un documento.
   Atteso: «Rilettura» e «Fonte citata» vanno sotto il testo, a tutta larghezza.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/deliverables.test.tsx apps/desktop/test/scripted.test.tsx
```
