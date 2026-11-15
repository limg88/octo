# Demo 25 — Le riunioni registrate con Verbale entrano nel progetto giusto

Durata: 5 minuti. Octo legge la cartella in cui Verbale esporta le riunioni e porta ognuna nella memoria del suo progetto: per l'invito già in posta, per le parole del titolo, oppure per mano del PM dalla pagina «Oggi». Mai a caso.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Verbale, a Claude o ad altri sistemi: la cartella di esportazione, la posta e Claude sono finti e vivono su questo computer. Con `REAL=1` risponde Claude Code con il tuo utente.
- Chi entra è già «Paola Verdi»: l'accesso lo mostra la demo 23.

Che cosa c'è nella cartella del Verbale finto (`.tmp/demo-25/Verbale`), sei esportazioni:

| Riunione | Che cosa deve succedere |
|---|---|
| «Punto settimanale», ieri alle 10 UTC | va in Aurora: nella posta di Aurora c'è l'invito a quell'ora (il titolo non nomina il progetto) |
| «Boreale: pianificazione di gennaio» | va in Boreale: il titolo nomina il progetto |
| «Allineamento fornitori» | di nessuno: aspetta in «Oggi» |
| «Riunione in corso» (`state: recording`) | saltata |
| «Formato futuro» (`schemaVersion: 2`) | saltata |
| «Esportazione rovinata» (`meeting.json` troncato) | saltata |

Le date sono relative al giorno in cui lanci la demo.

## Passi

1. **Avvia la demo e collega le riunioni.**
   ```bash
   bash demo/25-riunioni-verbale/run.sh
   ```
   Vai in «Impostazioni». Nel pannello «Avvio del progetto» c'è «1 su 6 collegati» (la posta). Sotto «Posta» c'è la riga nuova «Riunioni (Verbale)», con «Le riunioni di questo progetto non sono ancora collegate.». Premi «Collega».
   Atteso: il campo «Cartella in cui Verbale esporta» è già compilato con `~/…/.tmp/demo-25/Verbale` e sotto c'è scritto «È la cartella che Verbale usa su questo computer». Premi «Salva»: «Salvato.», lo stato diventa «Mai lette.» e il pannello dice «2 su 6 collegati».
   Dimostra: la cartella non si cerca a mano quando Verbale la dice; «Scegli…» apre la finestra del sistema quando non la dice.

2. **Riempi la memoria.** Premi «Riempi la memoria ora».
   Atteso: fra le righe del risultato, dopo «Posta», c'è «Riunioni (Verbale): 1 nuovi o aggiornati, 0 invariati.». In un terminale:
   ```bash
   ls .tmp/demo-25/Aurora/_octo/riunioni/*punto-settimanale*
   cat .tmp/demo-25/Aurora/_octo/riunioni/*punto-settimanale*/_meta.md
   ```
   Atteso: `_meta.md`, `markers.json`, `notes.md`, `transcript.md` e nient'altro (niente `audio/`, niente immagini, niente `meeting.json`). In `_meta.md`: data, «Durata: 45 minuti», «Partecipanti: Carla Bianchi, Paola Verdi», la cartella di origine.
   Dimostra: la riunione è entrata da sola in Aurora per l'invito letto un attimo prima dalla posta; entrano solo i testi.

3. **Che cosa non è entrato, e perché.**
   ```bash
   cat .tmp/demo-25/Aurora/_octo/riunioni/_lettura.md
   ```
   Atteso: sotto «Cartelle saltate» tre righe: `meeting.json` che non si legge, versione del formato non supportata (2), riunione non completa (recording). Sotto «Riunioni senza progetto» una sola riga: «Allineamento fornitori». La riunione di Boreale non c'è: ha un progetto, solo che non è questo.
   Dimostra: un'esportazione a metà, rovinata o di un formato sconosciuto non entra, ed è scritto.

4. **Assegna a mano da «Oggi».** Vai in «Oggi» e scegli la riga ««Allineamento fornitori» è registrata ma non ha un progetto» (etichetta «Riunioni da assegnare»).
   Atteso: nel dettaglio il pulsante principale è «Assegna a questo progetto»; fra le scelte in basso c'è «Non è di questo progetto». Premi «Assegna a questo progetto»: la riga esce dall'elenco e in `.tmp/demo-25/Aurora/_octo/riunioni/` c'è la cartella `…_allineamento-fornitori_c3c3c3c3`.
   Dimostra: ciò che Octo non sa attribuire lo chiede, non lo indovina. Da ora quella riunione resta di Aurora.

5. **Una risposta che cita la trascrizione.** In «Chiedi» scrivi «Che cosa si è detto in riunione? #riunione» e invia.
   Atteso: la risposta riporta una frase detta in riunione con il richiamo «1»; premilo: la fonte è `_octo/riunioni/…/transcript.md`, «Frase riscontrata nel file».
   Dimostra: la trascrizione importata è una fonte come le altre, citata e controllata. (`#riunione` serve solo al Claude finto per sapere di quale file parlare.)

6. **Il verbale dalla riunione scelta.** In «Deliverable» scegli «Verbale di riunione».
   Atteso: il campo «Quale riunione» è un elenco: «Un'altra riunione (la indico qui sotto)», poi «… · Punto settimanale» e «… · Allineamento fornitori». Scegli «Punto settimanale»: il campo di testo sparisce. Premi «Scrivi la bozza».
   Atteso: la bozza si intitola «Punto settimanale · <data>» e cita `transcript.md` di quella riunione.
   Dimostra: il verbale parte dalla riunione importata che il PM sceglie; un'altra riunione si può sempre indicare a parole.

7. **Una riunione esportata di nuovo.** In un terminale:
   ```bash
   AGAIN=1 bash demo/25-riunioni-verbale/run.sh
   ```
   Poi in «Impostazioni», sulla riga «Riunioni (Verbale)», premi «Leggi ora».
   Atteso: «Ultima lettura …: 1 nuove o aggiornate, 1 invariate.». Nella cartella di «Punto settimanale» ora c'è anche `report.md` e in `transcript.md` «venerdì» è diventato «mercoledì». La cartella è la stessa di prima.
   Dimostra: il riferimento è l'identificativo della riunione; correzioni e riepilogo nuovi riscrivono ciò che c'era.

8. **L'altro progetto.** Dal selettore in alto a sinistra scegli «Boreale».
   ```bash
   ls .tmp/demo-25/Boreale/_octo/riunioni/
   ```
   Atteso: `…_boreale-pianificazione-di-gennaio_b2b2b2b2`, arrivata con la lettura periodica (dieci secondi dopo l'avvio, poi ogni 15 minuti) senza che nessuno la chiedesse. In «Oggi» di Boreale non c'è «Allineamento fornitori»: è già di Aurora.
   Dimostra: una riunione va in un solo progetto; quella assegnata a mano non resta in sospeso negli altri.

## Che cosa prova
- Le riunioni concluse entrano senza intervento quando un invito o il titolo dicono di chi sono.
- Solo esportazioni complete e di un formato noto; il resto è annotato in `_lettura.md`.
- Nessuna assegnazione a caso: il dubbio diventa una segnalazione in «Oggi», con l'azione per risolverlo.
- Trascrizione citabile in «Chiedi» e fonte principale del deliverable «Verbale di riunione».

## Test e coverage
```bash
pnpm test:coverage
```
