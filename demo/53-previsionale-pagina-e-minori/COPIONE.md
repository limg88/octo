# Demo 53 — La pagina del previsionale, più leggibile, e tre correzioni minori

Durata: 4 minuti. Mostra la pagina mensile del previsionale dopo la verifica sui dati reali (nome della commessa in riga, ordinato, giorni e avanzamento separati, totale del progetto, segno sulle righe con dati incompleti) e tre correzioni piccole: virgola decimale nelle mediane, nome e cognome in «Ore» al posto del nome utente di Jira, avviso quando cruscotto e allineamento leggono uno stato in due modi.

## Prerequisiti
- Node 24, pnpm 12. Niente Docker.
- Nessun accesso a Claude, NetSuite o Jira veri. Progetto sintetico «Aurora» della demo 52: due commesse a giornate, `PRJ000606` (Aurora PI6, con le tariffe) e `PRJ000707` (Aurora PI7, senza). In più, sul tracker, ore del mese in corso registrate con il nome utente (`mario.rossi`, `ugo.gialli`).

## Passi

1. **Avvia la demo e leggi il terminale.**
   ```bash
   bash demo/53-previsionale-pagina-e-minori/run.sh
   ```
   Atteso, prima che si apra la finestra:
   ```
   1. Mediane dell’andamento, con la virgola decimale:
      14,7 gg · periodo prima: 9,5 gg

   2. Stato «Demo»: chiuso per l’allineamento, in verifica per il cruscotto. Avviso in «Allineamento»:
      Lo stato «Demo» è nel gruppo «Chiuso» dell’allineamento, ma il cruscotto lo legge «in verifica»: …

      Dopo aver detto al cruscotto che «Demo» è chiuso: 0 avvisi.
   ```
   Dimostra: le mediane non escono più con il punto («14.7 gg»). Quando il PM mette uno stato in un gruppo dell'allineamento il cui nome dice un'altra fase rispetto al cruscotto, «Allineamento» lo dice e spiega come far coincidere le due sezioni.

2. **Apri «Previsionale».** Il mese è quello scorso.
   Atteso, nella tabella:
   - sotto ogni codice il nome della commessa: «Aurora PI6», «Aurora PI7» (prima compariva solo al passaggio del puntatore);
   - la colonna «Ordinato»: 120.000,00 e 90.000,00;
   - due colonne distinte, «Giorni» (18 e 19) e «Avanzamento» (— per le commesse a giornate): prima erano una sola colonna «Giorni o %» che cambiava significato da una riga all'altra;
   - sulla riga `PRJ000707` l'etichetta «dati incompleti»;
   - in fondo la riga «Totale del progetto»: ordinato 210.000,00, costi interni 7.660,00, ricavi 7.360,00, giorni 37, margine del mese −4,08%.

   Dimostra: una riga con ricavi incompleti lo dice sulla riga stessa, non solo in fondo alla pagina. Il margine del progetto è negativo perché ai ricavi mancano le tariffe della commessa nuova: l'etichetta spiega il perché.

3. **Togli la lacuna.** In «Dati che mancano» premi «Su PRJ000707 usa per 3 persone la tariffa che hanno su PRJ000606».
   Atteso: i ricavi di `PRJ000707` diventano 6.020,00 e il totale 13.380,00; l'etichetta «dati incompleti» resta, perché manca ancora la tariffa di Neri Sara.

4. **Apri «Ore»** e premi «Mese successivo» fino al mese in corso.
   Atteso: fra le persone «Rossi Mario» con 6 ore sul tracker e nessun timesheet, e «ugo.gialli» con 2 ore.
   Dimostra: il timesheet del mese in corso non c'è ancora, ma chi è già comparso in un timesheet è chiamato con nome e cognome, non con il nome utente di Jira. Chi non è mai comparso in un timesheet resta come lo scrive il tracker.

## Che cosa dimostra
- La pagina del mese si legge senza passare il puntatore sulle righe e senza scorrere fino in fondo per sapere se un margine è affidabile.
- Con una sola commessa la riga di totale non c'è: sarebbe la stessa riga.

## Test
```bash
pnpm vitest run apps/desktop/test/forecast.test.tsx apps/desktop/test/dashboard.test.tsx apps/desktop/test/alignment.test.tsx packages/domain/test/hours.test.ts packages/domain/test/alignment.test.ts
```
