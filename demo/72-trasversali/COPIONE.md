# Demo 72 — Trasversali: lettore delle fonti, colonne, glossario, logo, previsionale

Durata: 5 minuti. Incremento I5 di `docs/esiti-prova-deem.md`: una fonte di testo si legge dentro Octo, aperta sulla frase citata; le colonne delle tabelle si allargano e si stringono; il progetto ha un glossario delle sigle sentite male; il logo è il polpo; nel previsionale «Calcolo e dettagli» è compatto e «Dati che mancano» è un elenco numerato.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto, che per il glossario propone sempre la coppia «aurora uan» → «Aurora ONE».

## Passi

1. **Avvia la demo e guarda il logo.**
   ```bash
   bash demo/72-trasversali/run.sh
   ```
   Atteso: in alto a sinistra il polpo che legge un foglio, accanto a «octo». È lo stesso file usato come icona dell'app nelle build.

2. **Leggi una fonte dentro Octo.** «Chiedi» → `Quando consegniamo?` → «Chiedi». Nel riquadro «Fonte citata» premi «Apri la fonte».
   Atteso: una finestra di Octo con `wiki/stato.md` impaginato (titolo, paragrafi) e il paragrafo che contiene «fissata al 12 dicembre 2026» evidenziato e in vista. «Apri con il sistema» apre l'originale come prima; la croce o Esc chiudono.
   Dimostra: una fonte in markdown o di testo non esce più da Octo per essere letta. Word, Excel e PDF restano al programma del sistema.

3. **Allarga una colonna.** «Oggi» → «Leggi ora». Nella tabella «Da tenere d'occhio» porta il mouse sul bordo destro dell'intestazione «Che cosa» e trascina; oppure, con la tastiera, Tab fino al bordo e frecce destra/sinistra.
   Atteso: la colonna segue. Cambia sezione e torna: la larghezza è rimasta. Doppio clic sul bordo: torna quella di Octo.
   Dimostra: le larghezze sono ricordate per tabella, su questo computer. Vale per tutte le tabelle di dati di Octo; in «Commessa» anche «Ore e costi per persona» e «Ordini a fornitore», che ora usano la stessa tabella.

4. **Proponi e approva una coppia del glossario.** «Impostazioni» → «Persone e calendario» → in fondo «Glossario: sigle e nomi sentiti male» → «Chiedi a Claude le coppie».
   Atteso: «Coppie proposte da Claude»: «aurora uan» → «Aurora ONE», con «Aggiungi» e «Scarta». Finché non premi «Aggiungi» non cambia nulla.
   Premi «Aggiungi».
   ```bash
   cat .tmp/demo-72/Aurora/_octo/.impostazioni/glossario.json
   ```
   Atteso: la coppia fra le `entries`.
   Dimostra: da qui in poi una trascrizione di Verbale che entra nel progetto ha «Aurora ONE» al posto di «aurora uan» (anche quelle già entrate, alla lettura successiva), e chi scrive i deliverable riceve la forma giusta. Le coppie si possono anche scrivere a mano nella tabella.

5. **Guarda il previsionale.** «Commessa» → «Previsionale» (serve il modello impostato: nella demo c'è) → su una riga «Calcolo e dettagli».
   Atteso: sotto la riga un modulo stretto, non largo quanto la tabella: ogni cifra accanto al suo nome, la spunta piccola con la sua frase. In fondo alla pagina «Dati che mancano» è un elenco numerato, una cosa per riga, con sotto ciò che la mette a posto.

## Che cosa non fa
- Non riporta le sigle alla forma giusta nei testi già scritti da Claude: vale per le trascrizioni e per ciò che viene scritto da ora.
- Il lettore evidenzia il paragrafo che contiene la frase citata, non le singole parole.
- L'icona dell'app è il PNG da 256 punti ingrandito a 1024: per una build pubblica serve l'originale a risoluzione piena (R6c.15 in `docs/verifiche-da-fare.md`).

## Verifica automatica
```bash
pnpm e2e:esiti
```
