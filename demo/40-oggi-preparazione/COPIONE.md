# Demo 40 — La scheda di preparazione di una riunione

Durata: 5 minuti. Incremento I di `docs/oggi-pianificazione.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Le notifiche del sistema devono essere permesse all'app che apre la demo (su macOS: Impostazioni di Sistema → Notifiche → «Electron»).
- Solo in questa demo: la «prova generale del collaudo» comincia fra 17 minuti e le fonti si rileggono ogni minuto. Nel progetto ci sono la registrazione della stessa riunione di una settimana fa e quattro open point.

## Passi

1. **Avvia la demo e leggi la posta.**
   ```bash
   bash demo/40-oggi-preparazione/run.sh
   ```
   Premi «Leggi ora» (o attendi la prima lettura, dieci secondi).
   Atteso: in «Riunioni di oggi» la riga «hh:mm–hh:mm Aurora: prova generale del collaudo», con «Sala riunioni del cliente · Carla Bianchi, Paola Verdi». La sua scheda è già aperta sotto la riga, senza clic: è la prossima riunione. Il pulsante della riga dice quante cose ci sono da portare.

2. **La parte calcolata dal codice.** Leggi la scheda:
   - **Open point da portare**: «Scaduto · Conferma della data del collaudo — tuo · … · entro il …» e «Preparare l'elenco dei casi di prova firmato dal cliente — di Anna Bianchi» (sono legati a questa riunione), «Nome di chi firma il verbale di collaudo — di Carla Bianchi» (Carla è invitata).
   - **L'ultima volta**: «Aurora: prova generale del collaudo, registrata il gg/mm/aaaa», con «Apri il riepilogo»; sotto, «Nato lì e ancora aperto: Preparare l'elenco dei casi di prova firmato dal cliente» e «Chiuso lì: Stima della migrazione dei dati».
   - **Posta di chi partecipa**: «Rispondi a Carla Bianchi · «Aurora: budget aggiuntivo approvato»».

   Dimostra: senza Claude la scheda dice già che cosa è rimasto aperto con queste persone, che cosa è successo l'ultima volta e quale posta aspetta.

3. **«Da portare, secondo Claude».** Alla prima apertura del giorno Claude prepara le riunioni ancora da cominciare, nella stessa esecuzione della valutazione. Mentre lavora la scheda dice «Claude sta preparando che cosa portare…».
   Atteso, a lavoro finito: due righe, ognuna con «Apri la fonte»:
   - «Chiedi a che punto è ciò che era rimasto aperto l'ultima volta.» (fonte: il riepilogo della settimana scorsa);
   - «Preparati a rispondere alla mail che aspetta: te lo chiederanno.» (fonte: la mail di Carla sul budget).

   Passa il mouse su «Apri la fonte»: la frase citata. Premi: si apre il file.
   Dimostra: Claude aggiunge, non toglie; ogni punto ha una frase che il codice ha trovato nel file. Un punto senza frase trovata non si mostra.

4. **Apri il riepilogo dell'ultima volta.** Premi «Apri il riepilogo».
   Atteso: si apre `report.md` della riunione di una settimana fa.

5. **Copia la scheda.** Premi «Copia la scheda», poi incolla in un editor di testo.
   Atteso: ora e titolo, i partecipanti, e le sezioni «Open point da portare», «L'ultima volta», «Posta di chi partecipa», «Da portare, secondo Claude», una riga per voce.
   Dimostra: la scheda si porta negli appunti della riunione.

6. **La notifica prima della riunione.** Apri la sezione «Chiedi» e attendi: a circa due minuti dall'avvio mancano 15 minuti alla riunione.
   Atteso: una notifica del sistema, «Alle hh:mm: Aurora: prova generale del collaudo» e sotto «Aurora · fra 15 minuti · N cose da portare». Una sola. Fai clic.
   Atteso: Octo torna in primo piano su «Oggi» di Aurora, con la scheda della riunione aperta.
   Dimostra: non si arriva impreparati neanche lavorando altrove. (Già prima, entro due ore dall'inizio, la riunione è in «Adesso».)

7. **Chiudi la scheda.** Premi il pulsante «N cose da portare» sulla riga.
   Atteso: la scheda si chiude; un altro clic la riapre.

## Che cosa non fa
- La notifica parte dopo una lettura periodica: con Octo chiuso non c'è.
- La scheda non dice che cosa è cambiato dall'ultima volta che l'hai aperta: la parte del codice è sempre quella di adesso, quella di Claude è della valutazione del giorno («Aggiorna la valutazione» la rifà).
- I numeri del tracker compaiono solo per le riunioni il cui titolo dice che sono di avanzamento (SAL, stato, sprint, stand-up).

## Test
```bash
pnpm exec vitest run packages/domain/test/prep.test.ts packages/application/test/today.test.ts packages/infrastructure/test/meeting-reader.test.ts apps/desktop/test/today.test.tsx
pnpm test:coverage
```
