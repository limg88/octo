# Demo 06 — Deliverable

Durata: 4 minuti. Mostra un deliverable dalla richiesta del PM al file approvato: Claude scrive la bozza dal progetto, il codice controlla le fonti, una seconda lettura la attacca come farebbe chi la riceve, il PM chiede modifiche a parole e approva.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude: la demo usa un modello finto. Con `REAL=1` usa Claude Code sul tuo seat.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/06-deliverable/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Deliverable».**
   Atteso: il catalogo con quattro schede — Email al cliente, Stato di avanzamento, Verbale di riunione, Stima — ciascuna con scritto se è per il cliente o interna.

3. **Scegli «Email al cliente» e compila.** A chi scrivi: `Carla Bianchi`. Di che cosa: `Data di consegna`. Che cosa chiedi: `Conferma della data`. Premi «Scrivi la bozza».
   Atteso: una riga dice che cosa sta leggendo; poi compare la bozza con «1 fonte controllata», la fonte `wiki/stato.md` e, sotto «Rilettura critica», «Può uscire: nessun punto contestabile trovato.»
   Dimostra: tre controlli prima che il PM legga — fonti verificate dal codice, rilettura indipendente, elenco delle cose da controllare.

4. **Chiedi una modifica che introduce un dato senza fonte.** In «Che cosa vuoi cambiare?» scrivi `Aggiungi il budget #inventa` e premi «Chiedi modifica».
   Atteso: «1 punto da controllare», la seconda fonte marcata «La frase non è nel file» e la rilettura critica che dice «Da correggere prima di farlo uscire», con il rilievo «Il budget non ha una fonte».
   Dimostra: un dato inventato viene segnalato due volte, dal codice e dalla rilettura. In alto il conteggio passa a «2 giri».

5. **Approva.** Premi «Approva».
   Atteso: «File pronti» con due file, `.md` e `.docx`. Un clic li apre.
   Dimostra: nei file il testo non ha più i numeri fra parentesi delle fonti; restano nella scheda, per il PM.

6. **Guarda dove sono.** Nel terminale:
   ```bash
   ls .tmp/demo-06/Aurora/_octo/deliverable/approvati
   ```
   Atteso: i due file, con giorno, tipo e oggetto nel nome.

7. **Istruzioni del progetto.** «Nuovo deliverable» → «Email al cliente» → apri «Istruzioni di questo progetto per questo deliverable», scrivi `Dai sempre del lei.` e premi «Salva le istruzioni».
   Atteso: «Istruzioni salvate.» Valgono per tutte le prossime email di questo progetto.

8. **Una stima.** «Nuovo deliverable» → «Stima». Che cosa va stimato: `Migrazione ordini`. Premi «Scrivi la bozza».
   Atteso: sotto «Stima» il totale «9,0 gg» con l'intervallo all'80%, le tabelle per fase e per ruolo e, fra gli avvisi, «Esclusa dai totali — W-03».
   Dimostra: Claude propone le righe, i conti li fa Octo. Una riga impossibile (ottimistico sopra il probabile) non viene corretta di nascosto: resta fuori dal totale e viene detta.

9. **Il registro.** Premi «Registro» nella colonna di sinistra.
   Atteso: una riga per deliverable con minuti di scrittura, minuti di revisione e giri, e in fondo il totale degli approvati. Lo stesso registro è nel file `_octo/deliverable/registro.md`.
   Dimostra: quanto costa ogni deliverable si misura da solo.

## Con Claude vero
```bash
REAL=1 bash demo/06-deliverable/run.sh
```
Stessi passi 2-5 senza `#inventa`: chiedi per esempio `Rendila più breve`. La bozza richiede un minuto o due: sono due letture del progetto. Consuma quota del tuo seat.

## Senza interfaccia
`pnpm e2e` esegue i passi da 2 a 6, 8 e 9 nella finestra vera e stampa `e2e: ok`.
