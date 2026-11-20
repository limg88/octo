# Rivedere l'interfaccia con Claude Design

Tutto ciò che serve per portare Octo in Claude Design e riportare indietro il risultato.

## Che cosa c'è qui

| File | A che cosa serve |
|---|---|
| `brief.md` | il primo messaggio da incollare: prodotto, richiesta, vincoli, forma del risultato |
| `stile.md` | lo stile di oggi: colori nei due temi, testo, misure, componenti |
| `schermate/chiaro/`, `schermate/scuro/` | 18 schermate a pagina intera per tema, 1280 px di larghezza |
| `../../apps/desktop/src/renderer/styles.css` | il foglio di stile vero, da allegare |
| `../glossario.md` | le parole dell'interfaccia |

Le schermate vengono dall'app vera sui progetti di prova «Aurora»: nessun dato di clienti.

## Le schermate

| N. | Schermata | Che cosa mostra |
|---|---|---|
| 01 | Oggi | giornata piena: il punto, riunioni, adesso, criticità, da fare, da tenere d'occhio |
| 02–05 | Commessa | Sintesi, Fatturazione, Ore, Previsionale |
| 06 | Chiedi | nuova chat, con le domande pronte |
| 07 | Chiedi | risposta con richiami e fonte a lato |
| 08 | Deliverable | catalogo dei tipi e memoria del progetto |
| 09 | Deliverable | documento approvato, file pronti, rilettura |
| 10 | Deliverable | documento da rivedere |
| 11 | Deliverable | registro |
| 12–13 | Cruscotto | Bug, Andamento |
| 14–18 | Impostazioni | Collegamenti, Persone e calendario, Pagina «Oggi», Carta intestata, Avanzate |

Mancano, perché la galleria non li apre: i dialoghi dei progetti, l'ingresso, gli stati vuoti e d'errore, la finestra minima 900×600. Alcune schermate di questi stati, del 15/11 e quindi con la navigazione vecchia, sono in `docs/valutazione-interfaccia/`.

Per rifarle dopo una modifica (serve Docker per il finto NetSuite; circa 5 minuti):

```bash
pnpm db:setup     # una volta
pnpm galleria     # compila, fa il giro end-to-end, riscrive docs/claude-design/schermate/
```

## Passi

1. **Apri Claude** (claude.ai o l'app desktop) e inizia una conversazione nuova. Claude Design oggi sta dentro Claude: il sito separato claude.ai/design chiude entro il 14 dicembre 2026.
2. **Decidi la richiesta** in `brief.md` (A revisione critica, B una sezione a fondo, C sistema) e cancella le altre due. Consiglio: A per prima, poi B sulla sezione che ne esce peggio.
3. **Allega**: `stile.md`, `styles.css` e le schermate. Se gli allegati sono troppi parti da queste otto, nei due temi: 01, 02, 07, 08, 09, 12, 14, 15.
4. **Incolla il brief** e chiedi esplicitamente «un design» (tavole su una tela), non un documento.
5. **Lavora per giri brevi**: una sezione alla volta, commentando sulle tavole. Chiedi sempre i due temi e il prima/dopo.
6. **Chiudi con l'elenco di consegna** descritto in fondo al brief (token, componenti, schermate).
7. **Riporta in Octo**: salva l'elenco in `docs/claude-design/esito.md` e chiedi a Claude Code di applicarlo, una sezione per incremento, con la sua demo. Poi `pnpm galleria` per le schermate nuove.

## Sistema di design (facoltativo)

Sull'account non c'è ancora un sistema di design. Crearne uno da `styles.css` conviene se le sessioni saranno più d'una: ogni design nuovo parte dai colori e dai componenti di Octo senza riallegare nulla. Si può fare da Claude Code: basta chiederlo.
