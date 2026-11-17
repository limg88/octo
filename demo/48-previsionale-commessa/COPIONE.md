# Demo 48 — Previsionale: la scheda «Commessa», la commessa dall'inizio a oggi

Durata: 4 minuti. Mostra la vista che serve a un progetto a corpo: non il mese, ma la vita intera della commessa. Persona per persona ore e costo, come nel foglio che il PM teneva a mano; fatturato e ricavi riconosciuti letti da NetSuite; margine a oggi e a finire; il tutto copiabile in una mail.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500, cominciata due mesi fa: 34 ore di Rossi Mario due mesi fa, 21,5 ore di Bianchi Luca il mese scorso (25 euro l'ora), più Verdi Sara che non ha timesheet (8 ore dichiarate dal PM, 560 euro al giorno). Acconto del 30% fatturato, 70% dei ricavi riconosciuto. Costi a budget 4.000.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/48-previsionale-commessa/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Previsionale».** Non premere niente.
   Atteso: due schede, «Mese» e «Commessa»; è aperta «Commessa». Titolo «PRJ000101 · Assessment Aurora (A corpo)».
   Dimostra: un progetto venduto solo a corpo si apre sulla vista che gli serve. Un progetto con commesse a giornate si apre su «Mese».

3. **Leggi la testata.**
   Atteso: Ordinato 7.500,00 · Fatturato (NetSuite) 2.250,00 (30%) · Ricavi riconosciuti (NetSuite) 5.250,00 (70%).
   Dimostra: fatturato e riconosciuto Octo li leggeva già da NetSuite ma non li mostrava; qui sono riletti a ogni apertura.

4. **Leggi la tabella.**
   Atteso:
   | Persona | Ore | Costo | Fonte |
   |---|---|---|---|
   | Bianchi Luca | 21,5 | 537,50 | timesheet |
   | Rossi Mario | 34 | 850,00 | timesheet |
   | Verdi Sara | 8 | 560,00 | senza timesheet, dichiarate |
   | Totale | 63,5 | 1.947,50 | |

   Dimostra: tutta la vita della commessa, non un mese. Il mese di due mesi fa non era sul disco: Octo lo ha letto da solo (demo 46). Nessun avviso di mesi non letti.

5. **Leggi i margini.**
   Atteso: Margine a oggi 74,03% · Costi a budget 4.000,00 · avanzamento 48,69% · Margine a finire 46,67% · su costi previsti di 4.000,00.
   Dimostra: margine a oggi = (ordinato − costi) / ordinato; a finire sui costi totali previsti se il PM li ha scritti, altrimenti sui costi a budget, mai meno di quanto già speso.

6. **Premi «Copia per mail»** e incolla in un editor di testo.
   Atteso: «Copiato: incollalo nella mail.» Il testo incollato porta commessa, ordinato, fatturato, riconosciuto, la tabella allineata e i margini.
   Dimostra: il riepilogo che il PM scriveva a mano esce dalla pagina così com'è.

7. **Premi la scheda «Mese».**
   Atteso: la pagina mensile di sempre, con la riga `PRJ000101` del mese scorso.

## Che cosa dimostra
- La domanda di un progetto a corpo (speso finora, quanto resta, margine a finire) ha una pagina.
- Niente è stimato: un'ora senza costo resta fuori dal totale e la pagina lo dice, con l'avviso che il margine è più alto del vero.
- I numeri sono quelli di «Mese»: stessi timesheet, stesse ore dichiarate, stessi costi a budget.

## Che cosa non fa ancora
- Le ore del mese in corso non ancora in NetSuite (stima dal worklog): demo 50.
- I costi a budget proposti dai tetti delle persone: demo 51.

## Test
```bash
pnpm vitest run packages/domain/test/forecast.test.ts packages/application/test/forecast.test.ts apps/desktop/test/forecast.test.tsx
```
