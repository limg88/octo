# Demo 39 — La chiusura di giornata: le riunioni chiudono gli open point

Durata: 5 minuti. Incremento H di `docs/oggi-pianificazione.md`.

## Prerequisiti
- Node 24, pnpm 12, due terminali.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Il progetto di prova ha tre open point in coda e, nel calendario, lo stand-up di ogni giorno e il SAL settimanale di oggi alle 11.
- Il Claude finto legge il riepilogo riga per riga: una riga che nomina un punto e dice «consegnato» lo chiude; una riga che lo nomina soltanto è ciò che se n'è detto; una riga «Azione: …» apre un punto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/39-oggi-chiusura/run.sh
   ```
   Atteso: «Oggi» di «Aurora». In «Il punto»: «3 in coda · …». In fondo al riquadro: «Claude non ha ancora letto le riunioni di questo progetto» e il pulsante «Chiudi la giornata».

2. **Leggi la posta.** Premi «Leggi ora» e attendi.
   Atteso: compaiono le riunioni di oggi e, in «Il punto», «… da confermare»: «Da confermare · Ambiente di prova per il collaudo — «Aurora: stand-up» del gg/mm/aaaa non è stata registrata: lì è stato risolto, o resta in coda?». Il punto è di Luca Neri, invitato allo stand-up; la data è quella dell'ultimo stand-up già finito (oggi, se sono passate le 9:45; altrimenti l'ultimo giorno lavorativo). Dopo le 9:45 c'è la stessa domanda per «Elenco dei casi di prova firmato», di Anna Bianchi. Su «Ambiente di prova per il collaudo» premi «Resta in coda».
   Atteso: la domanda sparisce, il punto resta in coda e sotto il suo titolo c'è la riga «gg/mm/aaaa: Aurora: stand-up: riunione non registrata, resta in coda».
   Dimostra: quando non c'è nulla da leggere, Octo chiede; la risposta è un clic e non viene richiesta due volte.

3. **Arriva la registrazione del SAL.** Nell'altro terminale:
   ```bash
   node demo/lib/fake-recorded.ts .tmp/demo-39/Aurora
   ```
   In Octo premi «Leggi ora».
   Atteso: in «Il punto» «1 riunione registrata da leggere», poi per qualche secondo «Leggo le riunioni…» (Claude parte da solo, una volta sola per questa registrazione).

4. **Che cosa è stato chiuso.** A lettura finita:
   - «Ambiente di prova per il collaudo» non è più in coda. Premi «Chiusi dal …».
     Atteso: «Ambiente di prova per il collaudo — chiuso il … · da quanto detto in riunione · «- Ambiente di prova per il collaudo: consegnato da Luca questa mattina, …»». «Fonte» apre `report.md` della riunione.
   - In fondo al riquadro: «Riunioni lette il … (claude-fake-default)».

   Dimostra: un punto si chiude solo con una frase che il codice ha trovato nel file della riunione. «Riapri» rimette in coda: la parola del PM vale di più.

5. **Che cosa resta in coda.**
   Atteso: «Risposta al cliente sulla variante CR-12» è ancora in coda; sotto il titolo: «gg/mm/aaaa: Risposta al cliente sulla variante CR-12: Paola la manda dopo il comitato, serve prima la stima di Mario.»
   Dimostra: se n'è parlato ma non è chiuso: va in coda per domani, con ciò che si è detto.

6. **Che cosa è nato.**
   Atteso: un punto nuovo, «Nuovo · Aggiornare il piano dei test dopo la consegna dell'ambiente · da Claude» — «di Anna Bianchi · aperto oggi · entro il …». «Fonte» apre la riga «Azione: …» del riepilogo. Premi «×» per toglierlo: non verrà riproposto.
   Dimostra: gli impegni presi in riunione entrano da soli, con la fonte; si tolgono con un clic.

7. **Il registro.** Apri `.tmp/demo-39/Aurora/_octo/progetto/open-point.md`.
   Atteso: sotto «Chiusi», il punto dell'ambiente con «Chiusura: `_octo/riunioni/…/report.md`: «…»».

8. **Una seconda lettura non fa nulla.** Premi «Chiudi la giornata».
   Atteso: nessun cambiamento: la riunione è già stata letta, Claude non viene interpellato.

## Che cosa non è verificato
- Con Claude vero: quanti open point estratti da una trascrizione vera sono rumore, e il costo della lettura.
- Una riunione non registrata si riconosce solo se il suo invito è nella posta del progetto.

## Test
```bash
pnpm exec vitest run packages/domain/test/open-points.test.ts packages/application/test/day-closing.test.ts packages/infrastructure/test/meeting-reader.test.ts apps/desktop/test/today.test.tsx
pnpm test:coverage
```
