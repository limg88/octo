# Demo 32 — Claude filtra il rumore della posta e spiega «Adesso»

Durata: 5 minuti. Incremento C di `docs/oggi-revisione.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Con `REAL=1` giudica Claude Code con il tuo utente. Chi usa Octo è già «Paola Verdi».
- Nella posta di prova ci sono, oltre alle mail delle altre demo, un ringraziamento scritto solo a Paola («Aurora: materiale della sessione») e un avviso a molti («Aurora: uffici chiusi venerdì»).

## Passi

1. **Senza Claude, il rumore c'è tutto.**
   ```bash
   NO_CLAUDE=1 bash demo/32-oggi-claude-filtra/run.sh
   ```
   Premi «Leggi ora».
   Atteso: in «Da fare oggi» c'è «Rispondi a Luca Neri · «Aurora: materiale della sessione»» (è scritta solo a Paola: per il codice aspetta lei); in «Da tenere d'occhio» c'è «Da seguire» per «Aurora: uffici chiusi venerdì». «Adesso» mostra le voci, senza frasi sotto.
   Dimostra: il codice sa che una mail aspetta, non che cosa chiede. Senza Claude la pagina funziona e non toglie nulla. Chiudi la finestra.

2. **Con Claude, ciò che non chiede nulla esce dalla pagina.**
   ```bash
   bash demo/32-oggi-claude-filtra/run.sh
   ```
   Premi «Leggi ora» e attendi qualche secondo la valutazione, che parte da sola.
   Atteso: il ringraziamento di Luca Neri non è più in «Da fare oggi» e l'avviso sugli uffici chiusi non è più in «Da tenere d'occhio». La mail di Carla Bianchi sul budget resta, in «Adesso», con «Mail di importanza alta». In fondo: «Messe da parte: 0 · da Claude: 2».
   Dimostra: Claude giudica se una mail chiede davvero qualcosa; le altre mail restano dove il codice e Claude le avevano messe.

3. **Leggi il motivo e ripristina.** Premi «Messe da parte: 0 · da Claude: 2».
   Atteso: due righe con stato «Claude: non chiede un'azione» e, accanto al titolo, il motivo e la frase della mail («Ringrazia o informa: non chiede nulla. «Grazie Paola per il materiale…»»). Premi «Ripristina» sul ringraziamento.
   Atteso: la mail torna in «Da fare oggi» come «Rispondi a Luca Neri…»; il pulsante dice «da Claude: 1». Scorri in fondo e premi «Valuta di nuovo tutte»: la mail resta dov'è.
   Dimostra: la parola del PM vale più di quella di Claude e resta: la valutazione successiva non toglie di nuovo la mail.

4. **Leggi perché le voci di «Adesso» contano.** Guarda il riquadro «Adesso».
   Atteso: le voci sono quelle scelte dalla regola (la riunione «Fra … minuti», l'allineamento «Lo sprint sta finendo», la mail di importanza alta). Sotto, «Perché contano oggi, secondo Claude»: una frase per voce, ognuna con «Apri la fonte». Premi «Apri la fonte» su una frase: si apre il file da cui viene la citazione.
   Dimostra: che cosa viene prima lo sceglie il codice; Claude lo spiega soltanto, e ogni frase ha una fonte che il codice ha trovato nel file. Una frase senza fonte controllata non viene mostrata.

5. **Guarda che cosa dichiara la valutazione.** In fondo alla pagina, nel riquadro «Valutazione di Claude del …».
   Atteso: dice che una mail che non chiede nulla va fra le messe da parte con il motivo, che sotto «Adesso» Claude spiega le voci scelte da Octo, e che una volta a settimana propone anche i rischi.

## Che cosa non si vede in cinque minuti
- Una mail giudicata «non chiede nulla» con una frase che il codice **non trova** nella mail resta dov'è: il codice non toglie dalla pagina su una parola che non ha trovato (`packages/application/test/today.test.ts`, «takes nothing off the page on words the code did not find in the mail»).
- Un giudizio dato prima di questo incremento, senza «chiede un'azione», vale come «chiede»: la mail resta finché Claude non l'ha riletta, alla valutazione successiva.
- Il giorno dopo le frasi di «Adesso» non si mostrano più: sono scritte nella valutazione del giorno.

## Test
```bash
pnpm test:coverage
```
