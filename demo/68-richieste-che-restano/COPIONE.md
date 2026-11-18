# Demo 68 — Le richieste restano, «Commessa» dice che cosa legge, «Adesso» si apre

Durata: 5 minuti. Incremento I1 di `docs/esiti-prova-deem.md`: i guasti che bloccavano la prova da zero. Una richiesta a Claude continua mentre sei in un'altra sezione e la ritrovi al rientro; «Commessa» legge i mesi che mancano uno alla volta e lo dice; una voce di «Adesso» si apre sotto la sua riga; la bozza di un deliverable si legge prima che la rilettura critica finisca.

## Prerequisiti
- Node 24, pnpm 12, Docker acceso (il NetSuite finto è un database del Postgres di prova: `pnpm db:setup`).
- Nessun accesso a Claude né ad altri sistemi. Claude è finto: a una domanda che contiene `#attesa` risponde dopo 8 secondi. Il NetSuite finto impiega circa un secondo per ogni mese di timesheet.
- Nel progetto di prova la commessa `PRJ000101` è iniziata dodici mesi fa e Octo ha un solo mese di timesheet.

## Passi

1. **Avvia la demo e apri subito «Commessa».**
   ```bash
   bash demo/68-richieste-che-restano/run.sh
   ```
   Atteso: al posto della rotella muta, una riga che cambia: «Chiedo a NetSuite ordini e fatture della commessa…», poi «Leggo da NetSuite i timesheet di gennaio 2026: mese 3 di 11…» e così via fino in fondo; poi le cifre della commessa, senza l'avviso dei timesheet non letti.
   ```bash
   ls .tmp/demo-68/Aurora/_octo/ore/netsuite | wc -l
   ```
   Atteso: `13`, un file per mese.
   Dimostra: una commessa che parte da zero chiede un anno di mesi; ora si vede a che punto è, e ogni mese letto resta. Se la lettura si ferma, la pagina dice perché e offre «Riprendi la lettura», che chiede solo i mesi che mancano (lo provano i test: `packages/application/test/forecast.test.ts`).

2. **Apri una voce di «Adesso».** «Oggi» → «Leggi ora». Nel riquadro «Adesso» premi la prima voce.
   Atteso: il dettaglio, con «Fatto», «Più tardi» e il resto, si apre subito sotto la voce premuta. Un secondo clic lo richiude. «Perché contano oggi, secondo Claude», quando c'è, è chiuso e si apre con un clic.
   Dimostra: prima il clic sceglieva la voce ma il dettaglio compariva più in basso, fuori vista.

3. **Fai una domanda lunga e vai altrove.** «Chiedi» → scrivi `Quando consegniamo? #attesa` → «Chiedi». Subito dopo apri «Commessa», poi «Impostazioni».
   Atteso: nella colonna di sinistra, accanto a «Chiedi», una rotella: «Claude sta lavorando qui». Dopo qualche secondo sparisce.
   Torna in «Chiedi».
   Atteso: la risposta «La consegna è il 12 dicembre» è lì, con la sua fonte.
   Dimostra: le sezioni già aperte restano come le hai lasciate; prima, uscendo, la risposta andava persa.

4. **Scrivi un deliverable e guarda le fasi.** «Deliverable» → «Email al cliente» → compila i tre campi → «Scrivi la bozza».
   Atteso: la riga di attesa dice la fase («Bozza scritta: controllo le fonti una per una», «Rilettura critica in corso: la bozza si può già leggere»); la bozza compare prima dei rilievi, e accanto ai tempi resta scritto dove è andato l'ultimo giro (scrittura, controllo delle fonti, rilettura critica). Con Claude finto le fasi passano in un attimo: l'ordine è provato dai test (`packages/application/test/deliverables.test.ts`, `apps/desktop/test/deliverables.test.tsx`).

5. **Cambia progetto (facoltativo).** Se hai un secondo progetto in elenco, passaci e torna.
   Atteso: le sezioni ripartono da capo. Solo dentro lo stesso progetto restano come le hai lasciate.

## Che cosa non fa
- Non misura i tempi veri di NetSuite né di Claude: quelli si leggono sulla prossima prova con il progetto reale (voci R6c in `docs/verifiche-da-fare.md`).
- «Impostazioni» riparte ogni volta: lì non ci sono richieste lunghe da tenere.

## Verifica automatica
```bash
pnpm e2e:esiti
```
Segue i passi 1-3 nella finestra vera e finisce con `e2e esiti: ok`.
