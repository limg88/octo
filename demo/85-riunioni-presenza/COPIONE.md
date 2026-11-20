# Demo 85 — Una persona sola non fa una riunione del progetto

Durata: 2 minuti. Dati sintetici, nessuna finestra: la regola si vede nei suoi casi.

## Perché
Nel giro sui progetti reali del 20/11/2026 molte registrazioni di Verbale erano nel progetto sbagliato: bastava che partecipasse una persona della squadra (un responsabile, uno sviluppatore) perché un colloquio su tutt'altro entrasse nel progetto, e Claude ne ricavava punti aperti.

## La regola nuova
Chi partecipa dice che una riunione è del progetto solo se:
- c'è almeno una persona del **cliente** del progetto, oppure
- ci sono almeno **due** persone della squadra e non sono meno degli altri presenti (il PM non conta).

Con una sola persona del fornitore la riunione entra ancora se Verbale nomina proprio l'evento di un invito del progetto, o se titolo o appunti nominano il progetto. Non entra più per il solo orario di un invito né per la sola presenza: aspetta in «Oggi», sotto «riunioni da assegnare».

## Prerequisiti
`pnpm install` fatto.

## Passi
1. Lancia i casi:
   ```bash
   bash demo/85-riunioni-presenza/run.sh
   ```
   Atteso: 4 test verdi.
2. Leggi i nomi dei casi nell'uscita:
   - «is told by somebody of the client, or by two of its people…»: cliente presente, o due della squadra in maggioranza → del progetto.
   - «is not told by one person of the supplier, nor by two among many others» → non basta.
   - «does not enter a project by one of its people alone, unless the client was there»: quattro registrazioni; entrano quella con il cliente e quella il cui titolo nomina il progetto; il colloquio con un responsabile e la riunione di un altro cliente restano da assegnare.
   - «enters by itself the only project all its known people are of»: lo standup con due della squadra entra come prima.

## Che cosa prova
Una riunione non entra più in un progetto per la presenza di una sola persona del fornitore; ciò che entrava per buone ragioni entra ancora.

## Limite
Le riunioni già importate restano dove sono: la regola vale per quelle che entrano da ora. Per ripulire un progetto, a Octo chiuso si tolgono `_octo/riunioni/` e `_octo/.stato/meetings.json` e si rilegge.
