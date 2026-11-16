# Demo 35 — Da sollecitare, la sintesi di Claude e il tracker che si rilegge da solo

Durata: 5 minuti. Mostra le voci del tracker il cui ultimo commento chiede qualcosa a cui nessuno ha risposto, con il sollecito che Claude scrive a richiesta e che il PM copia; il commento di Claude ai numeri di un periodo, controllato dal codice frase per frase; il tracker riletto da solo, senza premere nulla. Octo non scrive nel tracker e non invia nulla.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso ad Azure DevOps vero né a Claude: lo script avvia un Azure DevOps finto, già collegato, e usa un Claude finto. `REAL=1` usa Claude Code del tuo posto; `NO_CLAUDE=1` mostra la pagina senza Claude.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/35-cruscotto-solleciti-e-sintesi/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Cruscotto» e premi «Leggi da Azure DevOps».**
   Atteso: «Lette 23 voci, 23 con la cronologia», poi la scheda «Bug».

3. **Guarda «Da sollecitare».** Sotto i numeri: «Da sollecitare: 2», con «Solo in attesa del cliente» spuntato.
   Atteso: il bug «PDF dell'ordine senza logo», con la frase «Luca Galli, ci serve il logo in formato vettoriale: puoi mandarlo?», e la storia «Modulo ordini: export in PDF», assegnata a Carla Neri, con «Quale formato serve per la data nel PDF, quello italiano o ISO?». Ognuna dice chi ha chiesto, quando e da quanti giorni lavorativi.
   Togli la spunta: diventano 3; la terza è una domanda del cliente che aspetta noi.
   Dimostra: le trova il codice (ultimo commento che chiede, voce non chiusa, almeno 2 giorni lavorativi); «del cliente» viene dalle persone delle due parti scritte in «Impostazioni».

4. **Prepara un sollecito.** Sulla storia premi «Prepara il sollecito».
   Atteso: dopo qualche secondo un riquadro «Sollecito per Carla Neri» con poche righe che citano la voce e la domanda, firmate Paola Verdi. Premi «Copia»: «Copiato.»
   Dimostra: è una bozza a richiesta; la manda il PM, da dove vuole. «Apri su Azure DevOps» porta alla voce.

5. **Chiedi il commento ai numeri.** Apri la scheda «Andamento» e premi «Commenta il periodo».
   Atteso: «Scritto il …» con due frasi: i bug aperti di adesso e di inizio periodo, e il bug fermo da più tempo con «Apri su Azure DevOps». Sotto: «1 frase tolta: citava numeri o voci che qui non ci sono.»
   Dimostra: Claude commenta, non conta. Il Claude finto scrive apposta una frase con un numero suo («73 per cento»): il codice la toglie perché quel numero non è fra quelli della pagina.

6. **Cambia periodo.** Premi «3 mesi».
   Atteso: il commento resta, segnato «I dati o il periodo sono cambiati da quando è stato scritto.» Non viene rifatto da solo: «Commenta di nuovo» lo rifà.

7. **Fai comparire un bug sul tracker.** Torna alla scheda «Bug» e, in un altro terminale:
   ```bash
   kill -USR1 $(cat .tmp/demo-35/ado.pid)
   ```
   Atteso: entro 30 secondi, senza premere nulla, «Bug aperti» passa da 5 a 6 e in elenco c'è «Pagamento rifiutato senza messaggio»; l'ora di «Tracker letto il…» è nuova.
   Dimostra: il tracker entra nella lettura periodica delle fonti. Fuori dalle demo la lettura periodica è ogni 15 minuti e il tracker si rilegge quando la sua lettura ha più di un'ora; aprendo il Cruscotto con dati di oltre 24 ore parte una lettura da sola.

8. **(Facoltativo) Senza Claude.** Chiudi e rilancia con `NO_CLAUDE=1 KEEP=1 bash demo/35-cruscotto-solleciti-e-sintesi/run.sh`.
   Atteso: l'elenco «Da sollecitare» e i numeri ci sono come prima; «Prepara il sollecito» e «Commenta il periodo» sono spenti, con «Serve Claude Code su questo computer.»

## Che cosa dimostra
- Che cosa aspetta una risposta lo decide una regola del codice; Claude scrive solo la bozza, a richiesta.
- Nella sintesi ogni numero deve essere uno di quelli calcolati dalla pagina e ogni voce una del tracker: il resto non si mostra, e la pagina dice quante frasi ha tolto.
- I dati del tracker si aggiornano da soli; «Leggi da Azure DevOps» resta per chi vuole subito.

## Limiti
- La regola «il commento chiede qualcosa» (punto interrogativo, «puoi», «potete», «fateci sapere»…) è provata su dati sintetici: su un tracker vero può dare falsi positivi.
- La lettura da Azure DevOps non è ancora provata su un'organizzazione vera; leggere anche la cronologia delle storie la allunga.
