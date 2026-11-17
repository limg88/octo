# Demo 31 — Le messe da parte si consultano, «Fatto» si chiude da solo, «Rimanda» a una data

Durata: 5 minuti. Incremento B di `docs/oggi-revisione.md`.

## Prerequisiti
- Node 24, pnpm 12, due terminali.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Nel progetto di prova lo sprint «Sprint 28» finisce domani e l'esportazione del tracker è di cinque giorni fa.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/31-oggi-messe-da-parte/run.sh
   ```
   Atteso: Octo si apre su «Aurora», sezione «Oggi». Premi «Leggi ora». In cima, su fondo giallo: «I dati del tracker sono di 5 giorni fa…».

2. **Rimanda a una data scelta.** Scegli la voce delle ore («…: le ore di 3 persone non tornano»), premi «Rimanda».
   Atteso: oltre ad «A domani», «A lunedì», «Fra una settimana» ci sono «A fine sprint (…)» con la data di domani e il campo «A una data» con «Rimanda a questa data», spento finché la data non è dopo oggi.
   Scrivi una data della settimana prossima e premi «Rimanda a questa data».
   Atteso: la voce sparisce dall'elenco.
   Dimostra: il PM rimanda a quando gli serve, non a una delle tre date previste.

3. **Metti da parte altre due voci.** Sulla mail di Carla Bianchi premi «Non serve risposta». In «Da tenere d'occhio», sulla riga dei bug fermi premi «×».
   Atteso: in fondo alla pagina il pulsante «Messe da parte: 3».

4. **Consulta le messe da parte e ripristina.** Premi «Messe da parte: 3».
   Atteso: una tabella con «Che cosa», «Stato», «Da quando»: le ore con «Rimandato al …» e la data scelta, la mail e i bug con «Messo da parte», tutte con la data di oggi. Premi «Ripristina» sulla riga della mail.
   Atteso: la mail torna in «Da fare oggi» (o in «Adesso», se Claude l'ha valutata di importanza alta) e il pulsante dice «Messe da parte: 2».
   Dimostra: ciò che è messo da parte si ritrova, con lo stato e la data, e si riprende una voce qualsiasi, non solo l'ultima.

5. **Un segnale che si risolve da solo.** Nell'altro terminale lancia il comando stampato all'avvio, che esporta di nuovo il tracker:
   ```bash
   node demo/lib/fake-tracker.ts .tmp/demo-31/Aurora
   ```
   In Octo premi «Leggi ora».
   Atteso: l'avviso giallo del tracker vecchio non c'è più e in fondo compare «Risolti da soli oggi: 1 (Tracker).»
   Dimostra: la pagina dice che cosa ha chiuso senza il PM. Se il PM l'aveva segnata «Fatto», quel «Fatto» viene dimenticato: se il problema si ripresenta torna come nuovo, non come «ancora aperto».

6. **Un tipo silenziato si riaccende da qui.** Metti da parte tre voci dello stesso tipo, oppure apri «Impostazioni di «Oggi»» e silenzia un tipo; torna su «Oggi» e apri «Messe da parte».
   Atteso: sotto la tabella, «Tipi di segnalazione che non mostro» con «Mostra di nuovo» accanto a ogni tipo. Premilo: le voci di quel tipo tornano nella pagina.
   Dimostra: non serve più andare nelle impostazioni per riaccendere un tipo.

## Che cosa non si vede in cinque minuti
Un segnale segnato «Fatto» il cui numero **scende** (per esempio le persone con le ore che non tornano passano da 3 a 2) resta nascosto anche dopo i tre giorni lavorativi: torna solo se risale sopra il valore del giorno della decisione. Lo provano i test (`packages/domain/test/today.test.ts`, «keeps away what was marked done for as long as it gets better»).

## Test
```bash
pnpm test:coverage
```
