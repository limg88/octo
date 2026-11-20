# Demo 78 — Stati, intestazioni e fasce di cifre: le regole comuni

Durata: 4 minuti. Primo incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`): solo regole comuni, nessuna schermata ridisegnata.

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora», posta finta e Claude finto: nulla esce dal computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/78-stati-e-regole-comuni/run.sh
   ```
2. **Leggi la giornata.** In «Oggi» premi «Leggi ora».
   Atteso: i titoli delle parti («Adesso», «Da fare oggi», «Da tenere d'occhio») sono titoli in 15 px, non più maiuscoletto grigio.
   Dimostra: l'intestazione di sezione ha una forma sola; il maiuscoletto resta ai sottogruppi («In corso», «In arrivo»).
3. **Guarda le etichette.** Nelle righe di «Adesso» e delle criticità.
   Atteso: le categorie («Riunioni», «Mail a cui rispondere», «Tracker», «Calendario») sono grigie; in ambra solo ciò che va verificato («Fra 40 minuti», «Mail di importanza alta»), senza il rombo. Tutte alte 20 px, con bordo, testo 12 px.
   Dimostra: il blu resta a ciò che nomina una fonte; uno stato non ha l'aspetto di un pulsante.
4. **Guarda una fascia di cifre.** «Cruscotto» → scheda «Bug».
   Atteso: i conteggi sono in un solo riquadro diviso da righe, non più pulsanti staccati; la cifra è in Inter; quello scelto ha il fondo viola tenue e la riga viola sotto.
5. **Passa al tema scuro** (in alto a sinistra) e apri «Impostazioni» → «Collegamenti».
   Atteso: gli stati verdi («Letto il …») hanno il loro bordo verde; un testo d'errore rosso si legge sul fondo scuro (`#f47067`, 6,9:1).
6. **Stringi la finestra** sotto i 1.040 px in «Cruscotto».
   Atteso: la fascia va su due righe, sempre dentro un solo riquadro.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test
```
