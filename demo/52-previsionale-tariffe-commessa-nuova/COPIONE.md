# Demo 52 — Una commessa nuova senza tariffe, e i dati rimasti su un codice vecchio

Durata: 3 minuti. Mostra che cosa succede quando un progetto a giornate passa a una commessa nuova (un nuovo PI): le tariffe sono scritte per commessa, quindi la nuova non ne ha. Octo propone quelle della commessa precedente, persona per persona o tutte insieme. Mostra anche l'avviso per i dati del mese scritti su un codice che non è più fra le commesse del progetto.

## Prerequisiti
- Node 24, pnpm 12. Niente Docker.
- Nessun accesso a Claude o a NetSuite veri. Progetto sintetico «Aurora» con due commesse a giornate: `PRJ000606` (Aurora PI6), con le tariffe, e `PRJ000707` (Aurora PI7), nuova. Il mese scorso quattro persone hanno lavorato sulla nuova: tre hanno una tariffa sulla vecchia (400, 420, 480), una è nuova sul progetto. Nelle impostazioni sono rimaste 174 ore di un esterno sul codice `PRJ000505`, che non è più del progetto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/52-previsionale-tariffe-commessa-nuova/run.sh
   ```

2. **Apri «Previsionale».** Il mese è quello scorso.
   Atteso: la riga `PRJ000707` ha costi interni e ricavi 0,00. In «Dati che mancano» quattro righe «PRJ000707: manca la tariffa al giorno di …».
   Dimostra: è la situazione di ogni cambio di commessa: prima le tariffe andavano riscritte tutte a mano.

3. **Leggi le proposte.**
   Atteso: accanto a Bianchi Anna «Usa 420,00, come su PRJ000606»; a Rossi Mario «Usa 400,00, come su PRJ000606»; a Verdi Luca «Usa 480,00, come su PRJ000606». Neri Sara non ha proposta: non ha tariffe su nessuna commessa. In cima: «Su PRJ000707 usa per 3 persone la tariffa che hanno su PRJ000606», con la frase «La commessa è nuova e non ha tariffe: propongo quelle dell'ultima commessa su cui ogni persona ne ha una. Controllale: da una commessa all'altra possono cambiare.»
   Dimostra: una proposta non è una tariffa: finché il PM non la prende, i ricavi restano fuori.

4. **Premi «Su PRJ000707 usa per 3 persone la tariffa che hanno su PRJ000606».**
   Atteso: «Salvato.»; restano la riga di Neri Sara (da scrivere a mano) e i costi totali. La riga `PRJ000707` ora ha i ricavi: 5 × 400 + 5 × 420 + 4 × 480 = 6.020,00.
   Dimostra: le tariffe sono scritte sulla commessa nuova; quelle della vecchia non cambiano.

5. **Leggi l'ultima riga di «Dati che mancano».**
   Atteso: «Per PRJ000505 hai scritto dati di questo mese (ore di esterni, ricavi, importi), ma non è fra le commesse del progetto: non sono contati. …»
   Dimostra: prima quei dati venivano ignorati in silenzio.

## Che cosa dimostra
- La proposta prende, per ogni persona, la tariffa scritta per ultima su un'altra commessa.
- Si può prendere una proposta alla volta («Usa 420,00, come su PRJ000606») o tutte insieme.
- Le tariffe di commesse chiuse restano dove sono: l'avviso riguarda solo i dati del mese che nessuno conta.

## Test
```bash
pnpm vitest run packages/domain/test/forecast.test.ts apps/desktop/test/forecast.test.tsx
```
