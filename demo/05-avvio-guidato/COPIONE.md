# Demo 05 — Avvio guidato

Durata: 5 minuti. Mostra che un PM porta un progetto da zero a una memoria piena senza scrivere percorsi, nomi di progetto o regole a mano: Octo propone, il PM conferma, un solo pulsante legge tutto.

## Prerequisiti
- Node 24, pnpm 12, un Mac.
- Nessun sistema reale: posta e Azure DevOps sono finti e girano su questo computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/05-avvio-guidato/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Fonti».** In cima c'è «Avvio del progetto»; sotto, una riga per ogni fonte.
   Atteso: «Niente è ancora collegato…». Posta, Azure DevOps, Jira e NetSuite sono righe chiuse con il loro stato («non ancora configurata», «Non collegato.») e il pulsante blu «Collega»; i documenti hanno «Converti ora» perché non richiedono nulla. La pagina sta in una finestra. In alto tre parti: «Collegamenti», «Persone e calendario», «Avanzate».
   Dimostra: il PM vede in un colpo che cosa manca, e ogni riga porta dove si collega. Su un progetto appena aggiunto questa pagina si apre da sola.

3. **Posta: guarda la proposta.** Premi «Collega» nella riga «Posta»: si apre il suo modulo. Le parole chiave contengono già `Aurora`, il nome del progetto. Premi «Anteprima».
   Atteso: «3 mail entrerebbero con queste regole.» e sotto gli oggetti delle più recenti, fra cui un avviso automatico «[FIRING] Aurora - disco pieno».
   Dimostra: si vede l'effetto delle regole prima di scrivere qualcosa.

4. **Posta: correggi e salva.** In «Mittenti da escludere» scrivi `avvisi@monitor.example`, premi di nuovo «Anteprima» (ora 2 mail), poi «Salva».
   Atteso: in «Avvio del progetto» compare «1 su 4 collegati»; la riga «Posta» dice «Mai letta.».

5. **Azure DevOps: scegli invece di scrivere.** Premi «Collega» nella riga «Azure DevOps»: la posta si richiude. Il modulo ha due passi numerati. In «1 · Accesso»: organizzazione `contoso`, Personal Access Token `demo-pat`; la «i» accanto a «Personal Access Token» apre una piccola guida in quattro passi su dove crearlo e con quali permessi. In «2 · Che cosa leggere» premi «Cerca progetti e aree».
   Atteso: compare il progetto «Aurora» come pulsante. Un clic lo scrive nel campo «Progetto»; un secondo «Cerca progetti e aree» mostra anche l'area «Team A».
   Dimostra: il PM non deve conoscere a memoria nomi e percorsi del tracker.

6. **Azure DevOps: collega.** Premi «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.» e, in cima, «2 su 4 collegati». «Scollega» ora c'è, e chiede conferma dicendo che cosa succede.

7. **Riempi.** Torna in cima e premi «Riempi la memoria ora».
   Atteso: una riga per fonte man mano che finisce — Posta, Azure DevOps, Documenti — con quanti elementi sono entrati, poi «Fatto. Ora puoi fare domande nella scheda «Chiedi».»

8. **Guarda il progetto.** Nel terminale:
   ```bash
   find .tmp/demo-05/Aurora -name '*.md' | sort
   ```
   Atteso: le mail sotto `_octo/posta/`, i work item sotto `_octo/fonti/ADO/` con la nota `_lettura.md`, i testi dei documenti sotto `_octo/testo/`.

## Con Claude vero
```bash
REAL=1 bash demo/05-avvio-guidato/run.sh
```
Dopo i passi 2-7, in «Chiedi» scrivi `Che cosa è bloccato, quando è il collaudo e quanto costa il canone?`. Atteso: una risposta che cita un work item, una mail e l'offerta in Word. Consuma quota del tuo seat.

## Senza interfaccia
`pnpm e2e` esegue gli stessi passi nella finestra vera e stampa `e2e: ok`.
