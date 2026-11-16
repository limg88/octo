# Demo 37 — «Il punto»: gli open point rimasti dal giorno prima

Durata: 5 minuti. Incremento F di `docs/oggi-pianificazione.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Il progetto di prova ha già un registro di open point: tre aperti nei giorni scorsi (uno scaduto) e uno chiuso ieri.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/37-oggi-il-punto/run.sh
   ```
   Atteso: Octo si apre su «Aurora», sezione «Oggi». Il primo riquadro, sopra tutto il resto, è «Il punto · 3 in coda · 1 nuovo dal gg/mm/aaaa · 1 chiuso dal gg/mm/aaaa» (la data è l'ultimo giorno lavorativo: di lunedì è venerdì).
   Dimostra: la pagina si apre su ciò che è rimasto aperto, non su ciò che le fonti dicono oggi.

2. **Leggi la coda.**
   Atteso, in quest'ordine:
   - «Scaduto · Ambiente di prova per il collaudo» — «di Luca Neri · aperto da 6 giorni lavorativi · era entro il …: scaduto da … giorni»;
   - «Risposta al cliente sulla variante CR-12» — «tuo · aperto da 2 giorni lavorativi»;
   - «Nuovo · Elenco dei casi di prova firmato» — «di Anna Bianchi · aperto da 1 giorno lavorativo».

   Dimostra: prima ciò che è scaduto, poi ciò che ha una data, poi il più vecchio. Ogni punto dice di chi è e da quanto è aperto. Accanto a «Oggi», nella barra laterale, il numero conta anche il punto scaduto.

3. **Dove si chiude oggi.** Premi «Leggi ora» e attendi: arrivano gli inviti delle riunioni.
   Atteso: se lo stand-up o il SAL di oggi devono ancora cominciare, sotto «Ambiente di prova per il collaudo» compare «↳ se ne parla oggi alle 09:30: Aurora: stand-up» (o «alle 11:00: Aurora: SAL settimanale»): Luca Neri è fra gli invitati. Dopo le 12 nessuna riga: le riunioni con lui sono finite.
   Dimostra: il punto dice in quale riunione di oggi si può chiudere, dal nome di chi lo ha in carico e dagli invitati.

4. **Che cosa è stato chiuso.** Premi «Chiuso dal …: 1».
   Atteso: «Stima della migrazione dei dati — chiuso il … · da te». Premi «Riapri».
   Atteso: il punto torna in coda («4 in coda»). Premi «Risolto» sulla sua riga per richiuderlo.
   Dimostra: una chiusura si vede il giorno dopo e si annulla con un clic.

5. **Cambia un punto.** Sulla riga «Risposta al cliente sulla variante CR-12» premi «Modifica», scrivi una data di questa settimana in «Entro il» e «Carla Bianchi» in «Di chi», poi «Salva».
   Atteso: la riga dice «di Carla Bianchi · … · entro il …» e sale sopra i punti senza data.

6. **Un punto a mano.** In fondo al riquadro scrivi «Verbale del collaudo da mandare al cliente» e premi «Aggiungi».
   Atteso: il punto è in coda, «Nuovo», «tuo · aperto oggi».

7. **Un punto da una segnalazione.** In «Da fare oggi» seleziona «Rispondi a Carla Bianchi · «Aurora: budget aggiuntivo approvato»» e premi «Segna come open point».
   Atteso: il punto entra in coda con lo stesso titolo; il pulsante sparisce dal dettaglio. Quando alla mail viene data risposta, il punto si chiude da solo («da solo: il dato è cambiato»).
   Dimostra: una segnalazione diventa un impegno che resta finché non è chiuso.

8. **Il registro è un testo del progetto.** Apri nel Finder `.tmp/demo-37/Aurora/_octo/progetto/open-point.md`.
   Atteso: «## Aperti» e «## Chiusi», una riga per punto con di chi è, da quando, entro quando.
   Dimostra: «Chiedi» e i deliverable (verbale, stato di avanzamento) possono citarlo.

9. **Togli un punto.** Premi «×» sulla riga «Verbale del collaudo da mandare al cliente».
   Atteso: sparisce dalla coda e non è fra i chiusi. Premi «Riduci» in alto a destra del riquadro.
   Atteso: resta la sola riga del titolo con i conteggi; «Espandi» lo riapre.

## Che cosa non fa ancora
- Nessun punto nasce da una riunione e nessuna riunione ne chiude uno: è l'incremento H.

## Test
```bash
pnpm exec vitest run packages/domain/test/open-points.test.ts packages/application/test/open-points.test.ts apps/desktop/test/today.test.tsx
pnpm test:coverage
```
