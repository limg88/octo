# Demo 08 — Ore: timesheet e tracker a confronto

Durata: 4 minuti. Mostra la riconciliazione delle ore: quelle approvate nei timesheet contro quelle segnate sul tracker, persona per persona, sul mese scorso. Ogni cifra è una somma fatta dal codice; Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude, al sistema dei timesheet o al tracker: le esportazioni sono finte (sei persone, venti giorni lavorativi del mese scorso) e Jira è un servizio finto su questo computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/08-ore/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Ore».**
   Atteso: «Da dove leggo le ore», con la cartella `dati/Timesheets` e il file `dati/ore-tracker/worklog_<mese>.csv` già proposti.

3. **Indica il codice del progetto e salva.** In «Codici di progetto dei timesheet» scrivi `PRJ000101` e premi «Salva».
   Atteso: «Quadratura: 664 ore approvate, tutte nel confronto»; totale 664 ore di timesheet contro 630 del tracker (5,1%).
   Dimostra: il mese è tenuto due volte nella cartella (un file parziale e uno completo) ma ogni riga conta una volta sola; la quadratura lo prova prima che tu legga la tabella.

4. **Leggi la tabella.** In cima ciò che va guardato:
   - Bianchi Anna: 160 contro 80, 50% — «Da guardare».
   - Costa Elena e Neri Sara — «Nessuna ora sul tracker».
   - E. Costa e Ugo Gialli — «Nessun timesheet».
   - Verdi Luca (6,3%) e Rossi Mario (11,1%) — «Torna»: «Mario Rossi» e «luca.verdi» sono stati riconosciuti da soli.

5. **Guarda che cosa è rimasto fuori.** Sotto «Rimasto fuori dal confronto»:
   Atteso: 16 ore non ancora approvate e 8 ore sul codice `PRJ000999`, che non è del progetto.
   Dimostra: niente sparisce in silenzio.

6. **Di' che un'assenza è attesa.** Sulla riga di Neri Sara premi «È atteso».
   Atteso: lo stato diventa «Atteso» e la riga scende in fondo. Fai lo stesso con Ugo Gialli (un esterno, senza timesheet qui).

7. **Unisci due nomi della stessa persona.** Apri «Impostazioni delle ore», in «Stessa persona, nomi diversi» scrivi `E. Costa = Costa Elena` e premi «Salva».
   Atteso: resta una sola riga «Costa Elena», 120 contro 120, «Torna».

8. **Cambia periodo.** Scegli un altro mese o due date in «Dal» e «Al».
   Atteso: la tabella segue il periodo; un mese senza ore dice «Nessuna ora nel periodo».

9. **Leggi le ore direttamente da Jira.** Apri «Fonti», nella sezione «Jira» scrivi sito `demo`, email `pm@example.test`, API token `demo-token`, progetti `AUR` e premi «Prova e salva». Torna in «Ore», scegli il mese scorso e premi «Leggi le ore da Jira».
   Atteso: «Lette 100 registrazioni di ore (<mese>)…» e la stessa tabella di prima: 664 ore contro 630.
   Nel terminale:
   ```bash
   ls .tmp/demo-08/Aurora/_octo/ore/jira
   ```
   Atteso: `worklog_<mese>.csv`. In «Impostazioni delle ore» il percorso delle ore del tracker è diventato `_octo/ore/jira`.
   Dimostra: non serve più esportare a mano; Octo legge con il tuo token di sola lettura, tiene solo persona, giorno, ore e issue, e non scrive su Jira.

10. **Chiedi i timesheet a NetSuite.** Sempre in «Ore» premi «Leggi i timesheet da NetSuite».
    Atteso: «Questa fonte non è ancora configurata.» Nella demo NetSuite non c'è: serve un database, e la lettura vera è provata dai test contro un database di prova.
    Dimostra: con NetSuite collegato in «Fonti» lo stesso pulsante legge le ore delle commesse per i mesi del periodo, le scrive in `_octo/ore/netsuite/timesheet_<mese>.json` e il confronto parte da lì, senza file esportati a mano. Di ogni riga restano persona, giorno, ore, commessa e stato di approvazione: mai il costo.

10. **Controlla dove sono le scelte.** Nel terminale:
   ```bash
   cat .tmp/demo-08/Aurora/_octo/.impostazioni/hours.json
   ```
   Atteso: percorsi, codice, le persone attese e il nome unito. Le esportazioni non sono state toccate.
