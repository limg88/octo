# Demo

Ogni fetta della roadmap si chiude con una demo eseguibile in pochi minuti.

| # | Demo | Comando | Copione |
|---|---|---|---|
| 01 | App e Chiedi: l'app si apre su un progetto sintetico e risponde con le fonti controllate una per una | `bash demo/01-app-e-chiedi/run.sh` | [COPIONE](01-app-e-chiedi/COPIONE.md) |
| 02 | Posta: le mail del progetto lette da Mail (archivio finto) e scritte nella cartella del progetto, regole applicate dal codice, lettura incrementale | `bash demo/02-posta/run.sh` | [COPIONE](02-posta/COPIONE.md) |
| 03 | Documenti: Word, Excel, PowerPoint e PDF della cartella resi leggibili a Claude come testo accanto agli originali, riconvertiti solo se cambiano | `bash demo/03-documenti/run.sh` | [COPIONE](03-documenti/COPIONE.md) |
| 04 | Sistemi: i work item di Azure DevOps (finto) letti con un token di sola lettura e scritti nel progetto, credenziale custodita dal sistema, nota sull'età dei dati | `bash demo/04-sistemi/run.sh` | [COPIONE](04-sistemi/COPIONE.md) |

`pnpm e2e` segue gli stessi passi delle demo da 01 a 04 nella finestra vera, senza intervento.
