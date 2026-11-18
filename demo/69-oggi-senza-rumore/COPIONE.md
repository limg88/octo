# Demo 69 — «Oggi» senza rumore

Durata: 5 minuti. Incremento I2 di `docs/esiti-prova-deem.md`: in vista resta ciò che tocca al PM; una riunione che Octo non sa dire del progetto non entra in «Oggi» e aspetta in «Da assegnare»; le criticità della settimana si leggono come le altre liste; la valutazione di Claude sta in poche righe.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude né ad altri sistemi: posta e Claude sono finti. Chi usa Octo è «Paola Verdi».
- Nella posta di prova ci sono due inviti per oggi: «Aurora: prova generale del collaudo» (il titolo nomina il progetto) e «Comitato di direzione» (il titolo non lo nomina, e non partecipa nessuna persona del progetto).

## Passi

1. **Avvia la demo e leggi le fonti.**
   ```bash
   bash demo/69-oggi-senza-rumore/run.sh
   ```
   «Oggi» → «Leggi ora». Aspetta qualche secondo che Claude finisca.
   Atteso: fra le riunioni di oggi c'è solo «Aurora: prova generale del collaudo». In fondo alla pagina una riga: «1 riunione da assegnare».
   Dimostra: la regola. Una riunione è del progetto quando partecipa una sua persona (il PM non conta: è in tutte) o quando il titolo lo nomina.

2. **Apri «1 riunione da assegnare».**
   Atteso: «Comitato di direzione», con «Claude: non so dirlo» e la frase su cui si fonda. Per il dubbio Octo ha chiesto a Claude con il modello piccolo (`claude-haiku-5-5`), una volta sola.
   ```bash
   grep -A4 '"meetings"' .tmp/demo-69/dati/progetti/*/oggi.json 2>/dev/null || grep -rl '"meetings"' .tmp/demo-69/dati
   ```
   Atteso: la parola di Claude è tenuta con il suo motivo, così non viene richiesta a ogni apertura.

3. **Di' di chi è.** Premi «È di questo progetto».
   Atteso: la riga sparisce e «Comitato di direzione» compare fra le riunioni di oggi. Con «Non è di questo progetto» sarebbe sparita e basta. La parola del PM vale più della regola e di Claude, per tutta la serie.

4. **Guarda «Criticità della settimana».**
   Atteso: una lista come le altre della pagina: quando e che cosa in alto, il titolo, il dettaglio sotto, il pulsante a destra; «In corso» sopra, «In arrivo» sotto.

5. **Aggiungi un punto di un'altra persona.** In «Il punto» scrivi `Ambiente di prova`, di chi `Luca Neri`, «Aggiungi».
   Atteso: non entra nella coda: sotto compare «1 punto di un'altra persona», che si apre. Un punto senza nome, o con il tuo, resta in coda. Lo stesso vale in «Da tenere d'occhio»: una mail a cui deve rispondere un altro sta dietro «… conversazioni che non toccano a te».

6. **Guarda la valutazione di Claude.** In fondo alla pagina.
   Atteso: una riga con quando e con quale modello, e i pulsanti. Le spiegazioni sono dietro «Dettagli». Le frasi di Claude sulla pagina hanno un limite di 160 caratteri, scritto nelle istruzioni e nello schema della risposta.

7. **Notifica.** «Impostazioni di «Oggi»».
   Atteso: «Avvisami con una notifica del sistema…» è accesa fin dall'inizio. Se macOS ha negato il permesso a Octo, sotto l'opzione c'è scritto dove riaprirlo.

## Che cosa non fa
- Non prova la notifica sulla build non firmata: è la voce R6c.7 di `docs/verifiche-da-fare.md`.
- Le riunioni registrate con Verbale seguono la stessa regola e lo stesso elenco; qui non ce ne sono (vedi demo 25 e 61).

## Verifica automatica
```bash
pnpm e2e:esiti
```
