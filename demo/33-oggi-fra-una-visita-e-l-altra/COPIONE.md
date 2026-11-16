# Demo 33 — Fra una visita e l'altra: novità, contatore, prossima lettura, notifica

Durata: 5 minuti. Incremento D di `docs/oggi-revisione.md`.

## Prerequisiti
- Node 24, pnpm 12, due terminali.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Le notifiche del sistema devono essere permesse all'app che apre la demo (su macOS: Impostazioni di Sistema → Notifiche → «Electron»). La prima volta il sistema può chiedere il permesso.
- Solo in questa demo le fonti si rileggono **ogni minuto** (`OCTO_DEV_SYNC_SECONDS=60`) invece che ogni 15, e la riunione del giorno comincia fra 2 ore e 2 minuti.

## Passi

1. **Avvia la demo e guarda la pagina.**
   ```bash
   bash demo/33-oggi-fra-una-visita-e-l-altra/run.sh
   ```
   Atteso: Octo si apre su «Aurora», sezione «Oggi». Sotto il titolo, al posto dell'elenco delle fonti: «Prossima lettura fra 1 minuto · Posta: …». Il tracker, che è già un avviso giallo in cima, non è ripetuto in quella riga. Nella barra laterale, accanto a «Oggi», un numero: le voci di «Adesso» più quelle di «Da fare oggi».
   Resta sulla pagina almeno cinque secondi: è la prima visita, nessuna voce è segnata.
   Dimostra: la pagina dice quando si aggiorna da sola; la freschezza resta solo per le fonti che non sono già un avviso.

2. **Vai altrove.** Apri la sezione «Chiedi».
   Atteso: il numero accanto a «Oggi» resta visibile.

3. **Arriva posta nuova.** Nell'altro terminale lancia il comando stampato all'avvio:
   ```bash
   node demo/lib/fake-mail-turns.ts .tmp/demo-33/Mail
   ```
   Attendi la lettura successiva (meno di un minuto), senza toccare Octo.
   Atteso: il numero accanto a «Oggi» sale.
   Dimostra: il contatore lo calcola il codice dopo ogni lettura, anche mentre il PM è in un'altra sezione.

4. **Torna su «Oggi».**
   Atteso: le voci arrivate con la posta nuova portano l'etichetta «Nuovo», in «Da fare oggi» («Rispondi a Carla Bianchi · «R: Aurora: piano di rilascio»») e in «Da tenere d'occhio» (le mail «Da seguire»). Le voci che c'erano già non hanno etichetta. Dopo cinque secondi sulla pagina la visita è registrata: alla lettura successiva le etichette non ci sono più.
   Dimostra: fra una visita e l'altra si vede subito che cosa è cambiato; passare dalla pagina per un attimo non conta come visita.

5. **La notifica quando un segnale entra in «Adesso».** Apri di nuovo «Chiedi», o porta in primo piano un'altra applicazione, e attendi: entro tre minuti dall'avvio la riunione del giorno comincia «entro due ore».
   Atteso: una notifica del sistema con il titolo «Alle …: Aurora: prova generale del collaudo» e, sotto, «Aurora · entra in «Adesso»». Una sola. Fai clic sulla notifica.
   Atteso: Octo torna in primo piano su «Oggi» di Aurora, con la riunione in «Adesso»: «Fra 1 ora e 59 minuti» (o poco meno).
   Dimostra: il sistema avvisa solo quando qualcosa passa davanti a tutto, una volta per lettura al più, e porta alla pagina.

6. **Spegni la notifica.** In fondo a «Oggi» premi «Impostazioni di «Oggi»».
   Atteso: la casella «Avvisami con una notifica del sistema quando una voce entra in «Adesso»», accesa. Spegnila: da quel momento nessuna notifica per questo progetto.

## Che cosa non si vede in cinque minuti
- Con la finestra di Octo in primo piano su «Oggi» dello stesso progetto la notifica non scatta: la voce è già sotto gli occhi (`apps/desktop/test/app.test.tsx`).
- «Peggiorato» compare sulle voci che contano qualcosa (ore, previsionale, bug fermi, requisiti, allineamento, rischi proposti) quando il numero sale rispetto all'ultima visita; i giorni d'attesa di una mail, che crescono da soli, non lo fanno scattare (`packages/domain/test/today.test.ts`).
- La prima lettura dopo l'avvio non notifica nulla: serve da confronto per le successive.
- **Windows:** la notifica non è stata provata; va provata sul pilota.

## Test
```bash
pnpm test:coverage
```
