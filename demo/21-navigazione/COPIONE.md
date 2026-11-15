# Demo 21 — Le sezioni nella colonna di sinistra, il lavoro separato dalle impostazioni

Durata: 3 minuti. Mostra la navigazione nuova: le sezioni del progetto stanno nella colonna di sinistra, raggruppate per quanto spesso si usano, e ciò che si imposta una volta sta in fondo. È l'ottavo incremento di `docs/valutazione-interfaccia.md`.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: i dati sono finti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/21-navigazione/run.sh
   ```
   Atteso: si apre Octo su «Aurora». Nella colonna di sinistra, sotto il nome del progetto: «Lavoro» (Chiedi, Deliverable, Cruscotto), «Ogni mese» (Ore, Previsionale, Avanzamento), «Ogni sprint» (Allineamento), «Progetto» (Impostazioni). In alto a destra non c'è più la riga delle schede.
   Dimostra: ciò che si usa ogni giorno è in cima; ciò che si imposta una volta è in fondo, staccato.

2. **Passa da una sezione all'altra.** Fai clic su «Cruscotto», poi su «Ore».
   Atteso: la sezione in uso ha il fondo grigio; il contenuto cambia a destra.

3. **Usa la tastiera.** Con il fuoco su una sezione premi freccia giù e freccia su.
   Atteso: si passa alla sezione dopo e a quella prima, anche da un gruppo all'altro; dall'ultima si torna alla prima.

4. **Trova le impostazioni di una sezione.** In «Cruscotto» premi «Scegli…» o scrivi `dati/tracker/latest.json` e salva; poi guarda in cima alla pagina.
   Atteso: «Impostazioni del cruscotto» è il primo elemento della pagina, sopra i numeri. Lo stesso in «Ore», «Previsionale» e «Allineamento»: le impostazioni sono sempre in alto, mai in fondo dopo i risultati.

5. **Segui un rimando.** Apri «Previsionale».
   Atteso: se manca il modello, la pagina lo chiede. Con il modello indicato e senza timesheet, l'errore «Indica prima, in «Ore», dove sono i timesheet.» ha il pulsante «Apri «Ore»», che porta lì. Lo stesso in «Ore» per un sistema non collegato: «Apri «Impostazioni»».

6. **Apri «Impostazioni».**
   Atteso: la pagina che prima si chiamava «Fonti»: collegamenti, persone e calendario, avanzate.

7. **Stringi la finestra.**
   Atteso: le sezioni restano tutte visibili nella colonna di sinistra: nessuna scheda tagliata.

## Che cosa dimostra
- Lavoro e configurazione sono separati, e nessuna sezione sparisce nella finestra piccola.
- Le impostazioni di ogni sezione stanno sempre nello stesso posto, in alto.
- Un errore che si risolve altrove porta dove si risolve.

## Limiti
- «Avanzamento» e «Allineamento» tengono il loro nome; «Allineamento» è sempre visibile, anche per chi ha un solo tracker.
- Non ci sono scorciatoie da tastiera per andare a una sezione: solo le frecce, e ⌘/Ctrl con un numero per i progetti.
