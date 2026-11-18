# Demo 60 — «Commessa» come riepilogo (R1)

Durata: 4 minuti. In Octo l'economia del progetto si tiene sotto controllo, non si gestisce: «Commessa» mostra le cifre di NetSuite, con l'avanzamento letto da NetSuite, e tiene dentro di sé «Ore» e «Previsionale». Budget, mesi, piano di fatturazione e anagrafica restano nelle schede progetto.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (`pnpm db:setup`, lo script lo lancia da solo).
- Nessun accesso a Claude o al NetSuite vero. Progetto sintetico «Aurora», commessa `PRJ000101` a corpo da 7.500; un ordine a fornitore; NetSuite scrive l'avanzamento del mese scorso (62%).
- Nel progetto c'è il file `sheet-plan.json` lasciato dalla versione precedente: una tariffa, ore a budget, una fattura prevista.
- I mesi della demo sono relativi a oggi.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/60-commessa-riepilogo/run.sh
   ```
   Atteso: nella colonna di sinistra, sotto «Ogni mese», ci sono solo «Commessa» e «Avanzamento». «Ore» e «Previsionale» non sono più voci.

2. **Apri «Commessa».**
   Atteso: quattro schede, «Sintesi», «Fatturazione», «Ore», «Previsionale». In «Sintesi»: Ordinato 7.500,00; Fatturato 2.250,00 (30%); Ricavi riconosciuti 5.250,00 (70%); Costi a oggi 3.147,50; Margine a oggi 58,03%; **Avanzamento 62%, «da NetSuite, al 28/…»**; Margine a finire 46,67%.
   Dimostra: l'avanzamento non si scrive in Octo. La pagina dice sempre da dove viene: da NetSuite con la data, oppure «ricavi riconosciuti sull'ordinato», oppure «stima di Octo».

3. **Scorri fino a «Costi secondo NetSuite» e a «Come sono calcolate le cifre».**
   Atteso: i costi di NetSuite per gruppo accanto a quelli calcolati; fra le regole c'è «Avanzamento».
   Dimostra: le cifre si confrontano con NetSuite nella stessa pagina.

4. **Premi «Copia i dati per un report».**
   Atteso: «Copiato: incollalo nel report o nella mail.» Incollato in un editor: le cifre della pagina, con la riga «Avanzamento: 62% (da NetSuite, al …)».

5. **Apri «Fatturazione».**
   Atteso: le fatture al cliente per ordine e per mese, gli ordini a fornitore. Non c'è più il piano di fatturazione.

6. **Guarda che cosa è successo al piano della versione precedente.**
   ```bash
   cat ".tmp/demo-60/Aurora/_octo/.riservato/commessa/piano-esportato.md"
   ls ".tmp/demo-60/Aurora/_octo/.impostazioni/sheet-plan.json"
   ```
   Atteso: un testo con la riga di Bianchi Luca (tariffa 60, ore a budget per mese), la fattura prevista e l'avanzamento dichiarato; il file `sheet-plan.json` è ancora lì, intatto.
   Dimostra: prima di smettere di usare il piano, Octo ne ha scritto il contenuto in un file leggibile, in una cartella che Claude non legge perché contiene costi e tariffe.

7. **Apri «Previsionale», poi «Impostazioni del previsionale» e «Tariffe e costi che NetSuite non dice».**
   Atteso: in «Tariffe al giorno» c'è Bianchi Luca, `PRJ000101`, 480.
   Dimostra: la tariffa che stava nel budget (60 l'ora) è passata alle impostazioni del previsionale: il previsionale dà le cifre di prima.

8. **Apri «Ore».**
   Atteso: la riconciliazione delle ore, con «Leggi i timesheet da NetSuite». A sinistra resta selezionata «Commessa».

## Che cosa non dimostra
- Le cifre contro il NetSuite vero, e se la vista dell'avanzamento è popolata per le commesse a corpo: sono in `docs/verifiche-da-fare.md`.

## Prova automatica nella finestra vera
```bash
pnpm e2e:commessa
```

## Test e copertura
```bash
pnpm test:coverage
```
