# Demo 29 — La posta che tocca a me, e quella che seguo soltanto

Durata: 4 minuti.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né alla posta vera: la cartella di Mail e Claude sono finti. Il Claude finto legge la prima riga di ogni mail: «a tutti» è per tutti, un nome seguito da una virgola è per quella persona.
- Chi entra è già «Paola Verdi»; fra le persone del progetto c'è «Rossi Mario», fornitore.

## Che cosa c'è nella posta finta
| Mail | Scritta a | Che cosa dice |
|---|---|---|
| Budget aggiuntivo approvato | solo Paola | chiede una conferma |
| Recap della sessione di prova | Paola e altri tre | «Ciao a tutti, di seguito il recap…» |
| Ambiente di collaudo | Paola e altri tre | «Luca, ci confermi…» |
| Piano di rilascio (tre mail) | Paola e altri tre | l'ultima: «Paola, ci mandi il piano…» |
| Errore nei log di notte | Paola e altri tre | ha già risposto Rossi Mario |
| Notifica di Azure DevOps | solo Paola | una voce è cambiata |

## Passi

1. **Avvia e leggi la posta.**
   ```bash
   bash demo/29-posta-che-tocca-a-me/run.sh
   ```
   In «Oggi» premi «Leggi ora» e aspetta che compaia «Valutazione di Claude del …».
   Atteso in «Da fare oggi»: il filtro «Posta 2», con due sole righe «Rispondi a…»: il budget e il piano di rilascio.
   Dimostra: sei mail e una conversazione di tre non sono otto cose a cui rispondere.

2. **Perché tocca a te.** Scegli «Rispondi a Carla Bianchi · «Aurora: budget aggiuntivo approvato»».
   Atteso nel dettaglio: «Aspetta da oggi. Sei l'unico destinatario.»
   Scegli «Rispondi a Carla Bianchi · «R: Aurora: piano di rilascio»».
   Atteso: «Claude: la richiesta è rivolta a te.», e nel riquadro della valutazione la frase «Paola, ci mandi il piano di rilascio definitivo…» con «fonte controllata».
   Dimostra: ciò che è certo lo dice il codice; il resto lo legge Claude, con la frase su cui si fonda. Le tre mail della conversazione sono una riga sola, sull'ultima.

3. **Ciò che segui soltanto.** Scorri a «Da tenere d'occhio».
   Atteso, tre righe «Da seguire: …»:
   - il recap: «Rivolta a tutti, senza chiedere a te.»
   - l'ambiente di collaudo: «Rivolta a Luca.»
   - l'errore nei log: «Ha già risposto Rossi Mario.»
   La notifica di Azure DevOps non c'è da nessuna parte.
   Dimostra: una mail in cui sei fra i destinatari non ti chiede una risposta; un sistema che scrive a suo nome non aspetta nessuno.

4. **Tocca a me.** Sulla riga dell'ambiente di collaudo premi «Tocca a me».
   Atteso: la riga sale in «Da fare oggi» come «Rispondi a Carla Bianchi · «Aurora: ambiente di collaudo»», con «Hai detto tu che tocca a te.»; «Posta» passa a 3.
   Dimostra: la tua parola viene prima di Claude.

5. **Non tocca a me.** Scegli il budget e premi «Non tocca a me».
   Atteso: la riga scende in «Da tenere d'occhio» come «Da seguire…», con «Hai detto tu che non tocca a te.»; «Posta» torna a 2. Vale anche per le prossime mail della stessa conversazione.
   Dimostra: anche una mail scritta solo a te si può passare fra quelle da seguire, senza dire che non serve risposta.

6. **Senza Claude.** Chiudi e rilancia:
   ```bash
   NO_CLAUDE=1 bash demo/29-posta-che-tocca-a-me/run.sh
   ```
   Premi «Leggi ora».
   Atteso: in cima l'avviso «Claude non è installato su questo computer». In «Da fare oggi» solo il budget; le mail a molti sono «Da seguire», con «Sei fra 4 destinatari: Claude non l'ha ancora letta.»; l'errore nei log resta «Ha già risposto Rossi Mario.»
   Dimostra: senza Claude Octo non inventa a chi è rivolta una mail: chiede risposta solo dove è certo.

## Test
```bash
pnpm test
pnpm test:coverage
```
