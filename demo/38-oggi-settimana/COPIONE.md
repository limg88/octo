# Demo 38 — «Oggi»: le criticità della settimana

Durata: 4 minuti. Incremento G di `docs/oggi-pianificazione.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Il progetto di prova ha: open point (uno scaduto, uno aperto da più di cinque giorni lavorativi, uno con scadenza fra due giorni), due rischi nel registro, un tracker esportato cinque giorni fa.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/38-oggi-settimana/run.sh
   ```
   Atteso: in «Oggi» di «Aurora», sotto «Il punto» (e sotto «Adesso», se c'è), il riquadro «Criticità della settimana · fino al gg/mm/aaaa». La data è la domenica di questa settimana; da venerdì in poi è la domenica successiva.

2. **«In corso»: ciò che va risolto adesso.**
   Atteso, nella colonna di sinistra, dall'alto:
   - «scaduto da … giorni · Open point · Ambiente di prova per il collaudo» — «di Luca Neri»;
   - «adesso · Rischio · gravità alta · Il cliente non ha ancora nominato chi firma il collaudo» — «Ne parlo con Carla al SAL»;
   - «adesso · Tracker · …» (l'esportazione del tracker è vecchia) e, se ci sono, i bug fermi.

   Dimostra: prima ciò che è scaduto, poi i rischi per gravità, poi i segnali che restano sbagliati finché ci sono. Li calcola il codice, senza Claude.

3. **«In arrivo»: ciò che la settimana porta.**
   Atteso, nella colonna di destra, in ordine di data:
   - «‹giorno› gg/mm · Open point · Piano di rilascio da mandare al cliente»;
   - «‹giorno› gg/mm · Rischio · Licenze dell'ambiente di prova in scadenza»;
   - se lo sprint o il mese chiudono in settimana: «Sprint · Fine dello sprint», il previsionale da compilare.

   Dimostra: una scadenza si vede giorni prima, in ordine, qualunque cosa sia (punto, rischio, mail, sprint).

4. **Una criticità non si ripete.** Scorri fino a «Da tenere d'occhio».
   Atteso: i rischi del registro e i bug fermi non sono più in quella tabella: stanno nella settimana.

5. **Dai una data a un rischio.** Sulla riga del rischio «gravità alta» premi «Apri il registro». Nel registro, sulla stessa riga, scegli una data di questa settimana in «Entro il». Premi «Torna a «Oggi»».
   Atteso: il rischio è passato da «In corso» a «In arrivo», al suo giorno.
   Dimostra: un rischio con la data è ciò che quel giorno porta; senza data è da affrontare adesso.

6. **Togli la gravità.** Riapri il registro, in «Gravità» scegli «non detta», torna.
   Atteso: l'etichetta della riga è «Rischio», senza gravità.

7. **Apri dal riquadro.** Sulla riga del tracker premi il pulsante a destra.
   Atteso: si apre la sezione in cui si risolve («Fonti» o «Cruscotto»).

## Test
```bash
pnpm exec vitest run packages/domain/test/week.test.ts packages/application/test/today.test.ts apps/desktop/test/today.test.tsx
pnpm test:coverage
```
