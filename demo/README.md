# Demo

Ogni fetta della roadmap si chiude con una demo eseguibile in pochi minuti.

| # | Demo | Comando | Copione |
|---|---|---|---|
| 01 | App e Chiedi: l'app si apre su un progetto sintetico e risponde con le fonti controllate una per una | `bash demo/01-app-e-chiedi/run.sh` | [COPIONE](01-app-e-chiedi/COPIONE.md) |
| 02 | Posta: le mail del progetto lette da Mail (archivio finto) e scritte nella cartella del progetto, regole applicate dal codice, lettura incrementale | `bash demo/02-posta/run.sh` | [COPIONE](02-posta/COPIONE.md) |
| 03 | Documenti: Word, Excel, PowerPoint e PDF della cartella resi leggibili a Claude come testo accanto agli originali, riconvertiti solo se cambiano | `bash demo/03-documenti/run.sh` | [COPIONE](03-documenti/COPIONE.md) |
| 04 | Sistemi: i work item di Azure DevOps (finto) letti con un token di sola lettura e scritti nel progetto, credenziale custodita dal sistema, nota sull'età dei dati | `bash demo/04-sistemi/run.sh` | [COPIONE](04-sistemi/COPIONE.md) |
| 05 | Avvio guidato: da un progetto vuoto a una memoria piena, con parole chiave proposte, anteprima della posta, progetto e aree scelti con un clic e un solo pulsante che legge tutto | `bash demo/05-avvio-guidato/run.sh` | [COPIONE](05-avvio-guidato/COPIONE.md) |
| 06 | Deliverable: un'email al cliente dalla richiesta al file Word approvato, con fonti controllate, rilettura critica, modifiche a parole e conteggio di tempi e giri | `bash demo/06-deliverable/run.sh` | [COPIONE](06-deliverable/COPIONE.md) |
| 07 | Cruscotto: bug aperti per fase, fermi oltre soglia, andamento su un periodo a scelta e requisiti poco chiari, calcolati dal codice da un'esportazione del tracker nella cartella | `bash demo/07-cruscotto/run.sh` | [COPIONE](07-cruscotto/COPIONE.md) |
| 08 | Ore: le ore approvate dei timesheet confrontate con quelle segnate sul tracker, persona per persona, con quadratura, nomi diversi riconosciuti e assenze attese | `bash demo/08-ore/run.sh` | [COPIONE](08-ore/COPIONE.md) |
| 09 | Previsionale: il modello Excel dell'amministrazione compilato dal codice, una riga per codice di progetto, con formule vive, dati mancanti dichiarati e originale intatto | `bash demo/09-previsionale/run.sh` | [COPIONE](09-previsionale/COPIONE.md) |
| 10 | Avanzamento: le richieste di stato di avanzamento per posizione d'ordine, percentuali calcolate dal codice e scritte sul modulo Excel del cliente secondo una mappa delle celle | `bash demo/10-avanzamento/run.sh` | [COPIONE](10-avanzamento/COPIONE.md) |
| 11 | Presentazione: lo stato di avanzamento approvato reso come slide PowerPoint sulla presentazione del periodo scorso, con la sua copertina, il suo layout e le sue tabelle | `bash demo/11-presentazione/run.sh` | [COPIONE](11-presentazione/COPIONE.md) |

`pnpm e2e` segue gli stessi passi delle demo da 01 a 11 (nella 11 il modello è già scelto: la finestra di scelta del file è del sistema) nella finestra vera, senza intervento.
