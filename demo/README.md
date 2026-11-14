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
| 12 | Tipi di testo: sei tipi in più nel catalogo dei deliverable (analisi funzionale da riunione, voce di backlog, modifiche al tracker, scenari di test, note di rilascio, technical proposal), ognuno con le sue domande, le sue regole e i suoi controlli | `bash demo/12-tipi-di-testo/run.sh` | [COPIONE](12-tipi-di-testo/COPIONE.md) |
| 13 | Allineamento: le voci del tracker del cliente in uno sprint confrontate con i ticket del tracker interno, con voci senza ticket, ticket nello sprint sbagliato, duplicati, riferimenti a voci che non ci sono e file di import dei mancanti | `bash demo/13-allineamento/run.sh` | [COPIONE](13-allineamento/COPIONE.md) |
| 14 | Persone e calendario: chi è sul progetto e quando, come scrivere a ciascuno e le date dei periodi, scritti una volta e usati da ore, risposte e deliverable; domande pronte in «Chiedi»; cartella di un progetto nuovo | `bash demo/14-persone-e-calendario/run.sh` | [COPIONE](14-persone-e-calendario/COPIONE.md) |

`pnpm e2e` segue gli stessi passi delle demo da 01 a 14 (la creazione del progetto nuovo no: la finestra di scelta della cartella è del sistema) (nella 11 il modello è già scelto: la finestra di scelta del file è del sistema) nella finestra vera, senza intervento.
