# Demo 03 — Documenti

Durata: 3 minuti. Mostra che Octo rende leggibili a Claude i file Word, Excel, PowerPoint e PDF della cartella del progetto, scrivendone il testo accanto, senza toccare gli originali.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude: la demo usa un modello finto. Con `REAL=1` usa Claude Code sul tuo seat.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/03-documenti/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora», che in `Documenti/` ha un'offerta in Word e un foglio Excel.

2. **Apri «Fonti».** In fondo alla pagina c'è la sezione «Documenti».
   Atteso: «Mai convertiti.» oppure, se sono passati dieci secondi dall'avvio, già l'esito della prima conversione automatica.

3. **Converti.** Premi «Converti ora».
   Atteso: «Ultima conversione …: 2 aggiornati, 0 già pronti.» (oppure «0 aggiornati, 2 già pronti» se la conversione automatica è già passata).

4. **Guarda i testi.** Nel terminale:
   ```bash
   find .tmp/demo-03/Aurora/_octo/testo -name '*.md'
   cat ".tmp/demo-03/Aurora/_octo/testo/Documenti/Scenari.xlsx.md"
   ```
   Atteso: un file `.md` per ogni documento, con lo stesso percorso dell'originale. Quello di Excel ha il titolo del foglio e le righe `Scenario base | 120`.
   Dimostra: il testo sta nella cartella del progetto, quindi Claude lo cerca e lo cita come ogni altro file.

5. **Modifica un documento.** In un altro terminale:
   ```bash
   node demo/lib/fake-documents.ts .tmp/demo-03/Aurora changed
   ```
   Poi premi «Converti ora».
   Atteso: «1 aggiornati, 1 già pronti.»
   Dimostra: si riconverte solo ciò che è cambiato. Con l'app aperta la conversione parte da sola ogni 15 minuti.

## Con Claude vero
```bash
REAL=1 KEEP=1 bash demo/03-documenti/run.sh
```
In «Chiedi» scrivi `Quanto costa il canone di manutenzione e quante giornate ha lo scenario esteso?`. Atteso: la risposta cita i due file sotto `_octo/testo/` (15.000 euro, 185 giornate). Consuma quota del tuo seat.

## Senza interfaccia
`pnpm e2e` esegue i passi 1, 3, 4 e 5 nella finestra vera e stampa `e2e: ok`.
