# Demo 77 — I ticket mancanti creati sul Jira interno, su conferma

Durata: 5 minuti. Incremento J5 della seconda prova: è l'unica cosa che Octo scrive fuori dal progetto.

## Prerequisiti
- Node 24, pnpm 12. Claude finto e Jira finto su questo computer (account `pm@example.test`, token `demo-token`, progetto `AUR`): nulla esce dal computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/77-ticket-su-jira/run.sh
   ```
2. **Collega Jira.** «Impostazioni» → «Collega: Jira»: sito `demo`, email `pm@example.test`, token `demo-token`, progetti `AUR` → «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.»
3. **Allinea lo sprint.** «Deliverable» → in fondo «Aggiungi al progetto» su «Allineamento dello sprint» → «Esegui».
   Atteso: «Sprint «Sprint 28»: 6 voci, 3 con ticket nello sprint, 1 con ticket altrove, 2 senza ticket.» e il pulsante «Crea su Jira i ticket mancanti…». Fin qui Octo non ha scritto nulla su Jira.
4. **Guarda che cosa creerebbe.** Premi «Crea su Jira i ticket mancanti…».
   Atteso: i due ticket con la spunta, ciascuno con il titolo che porta l'id della voce del cliente (`[AZDO 105] …`) e il tipo; «Progetto Jira in cui crearli» già su `AUR`. Togli la spunta al secondo.
5. **Conferma.** «Crea 1 ticket…».
   Atteso: una frase che dice quanti e dove: «Sto per creare 1 ticket nel progetto AUR di demo. Da Octo non si annulla.» Solo «Conferma e crea» scrive.
   Premi «Conferma e crea».
   Atteso: accanto al primo «Creato: AUR-901», e la sua spunta non si può più togliere né rimettere.
   ```bash
   cat .tmp/demo-77/Aurora/_octo/.lavori/allineamento/scritture.json
   ```
   Atteso: una riga con titolo, chiave, quando e «Paola Verdi».
   Dimostra: Octo crea solo ciò che hai spuntato, non crea due volte lo stesso ticket, tiene il registro di ciò che ha scritto. Non modifica e non cancella nulla: il client che scrive può fare solo `POST /rest/api/3/issue`.

## Sul Jira vero
Serve un token che possa creare issue nel progetto; il tipo deve esistere in quel progetto (la mappa dei tipi è nella configurazione dell'allineamento). Un ticket che Jira rifiuta è segnato e gli altri vengono creati lo stesso.
Prova automatica: `pnpm vitest run packages/connectors/test/reader-jira.test.ts packages/application/test/alignment-tickets.test.ts` e, nell'app vera, `pnpm e2e:script`.
