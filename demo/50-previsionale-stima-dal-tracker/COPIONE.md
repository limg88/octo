# Demo 50 — Le ore che i timesheet non hanno ancora: stima dal tracker e costo orario

Durata: 4 minuti. Mostra come Octo arriva alle ore vere della commessa quando i timesheet non bastano: le ore del mese in corso, che NetSuite riceve a mese chiuso, sono stimate dalle ore registrate sul tracker per il costo orario della persona; chi non ha timesheet sulla commessa è contato per le ore del tracker al costo orario scritto dal PM.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (lo script lancia `pnpm db:setup`).
- Nessun accesso a Claude, a NetSuite o a Jira veri. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500. Timesheet in NetSuite: Rossi Mario 34 ore due mesi fa, Bianchi Luca 21,5 ore il mese scorso (25 euro l'ora). Sul tracker, già letto in «Ore»: 4,5 ore di Luca Bianchi nel mese in corso e 8 ore di Sara Verdi, che non ha timesheet (costo orario 70, scritto nelle impostazioni).

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/50-previsionale-stima-dal-tracker/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Commessa».**
   Atteso:
   | Persona | Ore | Costo | Fonte |
   |---|---|---|---|
   | Bianchi Luca | 21,5 | 537,50 | timesheet |
   | Rossi Mario | 34 | 850,00 | timesheet |
   | Sara Verdi | 8 | 560,00 | senza timesheet, ore dal tracker |
   | Bianchi Luca | 4,5 | 112,50 | stima: ore dal tracker, non ancora in NetSuite (mese in corso) |
   | Totale | 68 | 2.060,00 | |

   Dimostra: le 68 ore del foglio tenuto a mano si ricostruiscono da sole: 55,5 dai timesheet, 4,5 del mese in corso dal tracker, 8 di chi non ha timesheet.

3. **Leggi la riga sotto la tabella.**
   Atteso: «Di cui stimati dal tracker: 4,5 ore, 112,50. Sono le ore dei mesi il cui timesheet non è ancora in NetSuite, al costo orario dell’ultimo timesheet di ogni persona: una stima, da sostituire con il timesheet quando arriva.»
   Dimostra: la stima è sempre dichiarata, sulla riga e nel totale. Il costo orario (25) viene dall'ultimo timesheet di Bianchi Luca, e la persona è chiamata come nei timesheet, non con il nome utente del tracker.

4. **Leggi i margini.**
   Atteso: Margine a oggi 72,53% · avanzamento 51,5% su 4.000,00 di costi a budget.

5. **Premi «Copia per mail»** e incolla in un editor.
   Atteso: nella tabella la riga stimata è «Bianchi Luca (stima)», e sotto c'è la frase sulle ore stimate.
   Dimostra: chi legge la mail senza la pagina davanti sa quale parte è una stima.

6. **Passa a «Mese»** (il mese scorso).
   Atteso: costi interni 537,50, costi esterni 560,00; sotto la riga: «Sara Verdi: 8 h dal tracker, senza timesheet, a costo orario». Avanzamento 48,69%.
   Dimostra: chi non ha timesheet entra anche nel mese, accanto agli esterni: è un costo vero. La stima del mese in corso no: nel previsionale del mese per l'amministrazione Octo non stima niente.

7. **Apri «Commessa» › «Budget» e premi «Parti dalla proposta».**
   Atteso: fra le «Risorse esterne» c'è Verdi Sara con costo unitario 70: il costo orario scritto prima che il budget esistesse resta in uso, e da qui si cambia (dalla demo 59 le impostazioni del previsionale non hanno più questa tabella).

## Che cosa dimostra
- Quando il timesheet del mese arriva in NetSuite, la riga «stima» di quel mese sparisce e resta il timesheet: le stesse ore non sono mai contate due volte.
- Una persona mai comparsa in un timesheet e senza costo orario scritto compare con le ore e senza costo, e la pagina avvisa che il margine è più alto del vero.

## Che cosa non fa
- Con più commesse nel progetto le ore del tracker non vengono attribuite: il tracker non dice su quale commessa sono. In quel caso restano i timesheet e gli esterni dichiarati a mano nei dati del mese.

## Test
```bash
pnpm vitest run packages/domain/test/forecast.test.ts packages/application/test/forecast.test.ts apps/desktop/test/forecast.test.tsx
```
