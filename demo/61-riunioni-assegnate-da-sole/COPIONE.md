# Demo 61 — Riunioni che entrano da sole quando è certo (R2)

Durata: 3 minuti. Una riunione registrata con Verbale entra da sola nel progetto quando tutti i partecipanti che Octo conosce sono persone di quel progetto, e di nessun altro. Quando non è certo resta la segnalazione in «Oggi»: una riunione non viene mai data per somiglianza.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude, alla posta o a Verbale veri. Due progetti sintetici, «Aurora» (Luca Verdi, Sara Neri, Paola Verdi) e «Boreale» (Elena Costa, Ugo Gialli), sulla stessa cartella finta di Verbale.
- Due riunioni di oggi senza invito e senza il nome di un progetto nel titolo: «Daily Standup Fornitori», con le sole persone di Aurora, e «Allineamento ambienti», con Luca Verdi (Aurora) ed Elena Costa (Boreale).

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/61-riunioni-assegnate-da-sole/run.sh
   ```
   Atteso: si apre Octo su «Aurora».

2. **Guarda «Oggi».**
   Atteso: il segnale «"Allineamento ambienti" è registrata ma non ha un progetto». Nessun segnale per «Daily Standup Fornitori».
   Dimostra: la daily non aspetta il PM, perché le sue persone sono tutte di Aurora.

3. **Apri «Impostazioni» → «Riunioni (Verbale)» e premi «Leggi ora».**
   Atteso: «Ultima lettura …: 1 nuove o aggiornate» (oppure «1 invariate» se la lettura periodica è già passata). In «Riunioni di questo progetto» c'è «Daily Standup Fornitori».
   ```bash
   ls .tmp/demo-61/Aurora/_octo/riunioni
   ```
   Atteso: una cartella `…_daily-standup-fornitori_…`.

4. **Passa a «Boreale»**, «Impostazioni» → «Riunioni (Verbale)», «Leggi ora».
   Atteso: la daily dei fornitori non entra in Boreale. In «Oggi» c'è lo stesso segnale per «Allineamento ambienti», con «Assegna a questo progetto».
   Dimostra: con persone dei due progetti decide il PM, da uno dei due.

5. **Da «Aurora», togli la daily dal progetto**: «Impostazioni» → «Riunioni (Verbale)» → «Togli dal progetto», «Conferma», poi «Leggi ora».
   Atteso: la daily non rientra. In «Oggi» compare fra le riunioni da assegnare.
   Dimostra: un progetto che ha dato via una riunione non la riprende, nemmeno per i partecipanti.

## La regola
- Contano solo i partecipanti che sono fra le persone di almeno un progetto: un ospite non conta.
- Chi è nelle persone di più progetti (il PM) da solo non dice niente.
- La riunione entra nel progetto solo se è l'unico ad avere tutti i partecipanti noti. Vale dopo invito e parole chiave, che continuano a venire prima.

## Che cosa non dimostra
- Quante riunioni vere entrano da sole: va misurato su due settimane (`docs/verifiche-da-fare.md`, R2.7).

## Prova automatica nella finestra vera
```bash
pnpm e2e:riunioni
```

## Test e copertura
```bash
pnpm test:coverage
```
