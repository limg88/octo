# Demo 02 — Posta

Durata: 4 minuti. Mostra che Octo legge la posta che Mail tiene sul computer, sceglie le mail del progetto con regole applicate dal codice e le scrive nella cartella del progetto, una per file.

## Prerequisiti
- Node 24, pnpm 12, un Mac.
- La demo usa un archivio di Mail finto: non tocca la tua posta e non chiede permessi.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/02-posta/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora». Il terminale stampa il percorso dell'archivio finto: 6 mail, di cui 2 del progetto.

2. **Apri «Fonti».** Fai clic sulla scheda «Fonti», poi su «Collega» nella riga «Posta».
   Atteso: «La posta di questo progetto non è ancora configurata.» «Dal giorno» propone 30 giorni fa; sotto «Avanzate», «Cartella nel progetto» propone `_octo/posta`. «Leggi ora» è spento.

3. **Configura.** In «Parole chiave» scrivi `Aurora`. In «Mittenti da escludere» scrivi `avvisi@monitor.example`. Premi «Salva».
   Atteso: «Salvato. La prossima lettura riparte dal giorno indicato.» e l'etichetta «Mai letta.»
   Dimostra: le regole stanno nella cartella del progetto (`_octo/.impostazioni/sources.json`), quindi viaggiano con lei.

4. **Leggi.** Premi «Leggi ora».
   Atteso: «Ultima lettura …: 2 nuove, 0 già presenti.»
   Dimostra: delle 6 mail ne entrano 2. Restano fuori l'avviso automatico (mittente escluso), la risposta a un invito, la mail di un altro progetto (dove «Aurora» compare solo dentro «aurorale») e quella nel cestino.

5. **Guarda i file.** Nel terminale:
   ```bash
   find .tmp/demo-02/Aurora/_octo/posta -name '*.md'
   ```
   Atteso: due file sotto `_octo/posta/<anno-mese>/`, con giorno, ora e oggetto nel nome. Aprine uno: in testa mittente, destinatari, data, cartella di posta; sotto, il testo senza HTML.

6. **Arriva una mail nuova.** In un altro terminale:
   ```bash
   node demo/lib/fake-mail.ts .tmp/demo-02/Mail extra
   ```
   Poi premi di nuovo «Leggi ora».
   Atteso: «1 nuove, 2 già presenti.»
   Dimostra: la lettura riparte da poco prima dell'ultima e non riscrive ciò che c'è già. Con l'app aperta la stessa lettura parte da sola ogni 15 minuti.

## Con Claude vero
```bash
REAL=1 KEEP=1 bash demo/02-posta/run.sh
```
Nella scheda «Chiedi» scrivi `Quando è il collaudo e c'è budget aggiuntivo?`. Atteso: la risposta cita i file della posta appena letti (collaudo il 17 dicembre, 8.000 euro approvati). Consuma quota del tuo seat.

## Sulla tua posta
Senza `OCTO_MAIL_ROOT` Octo legge `~/Library/Mail`. macOS lo permette solo se in Impostazioni di Sistema › Privacy e sicurezza › Accesso completo al disco è abilitata l'app (in sviluppo: il terminale da cui la lanci). Se manca il permesso, la pagina Fonti lo dice.

## Senza interfaccia
`pnpm e2e` esegue i passi da 1 a 6 nella finestra vera e stampa `e2e: ok`.
