# Demo 84 — «Impostazioni» riviste: le fonti in un elenco, le persone in elenco e dettaglio

Durata: 5 minuti. Settimo e ultimo incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavole `ImpDopo`, `PersDopo`, `D16`, `D17`, `D18`).

## Prerequisiti
- Node 24, pnpm 12. Progetto di prova «Aurora», posta finta e Claude finto: nulla esce dal computer.

## Passi

1. **Avvia la demo e apri «Impostazioni».**
   ```bash
   bash demo/84-impostazioni-riviste/run.sh
   ```
   Atteso, scheda «Collegamenti»: «Avvio del progetto» è un titolo con una riga sotto («N su 6 collegati…») e «Leggi tutte le fonti» pieno a destra: niente riquadro.
2. **Le fonti sono un elenco.**
   Atteso: un solo riquadro con le colonne Fonte e Stato e, a destra, i comandi. Sette righe: Posta, Riunioni (Verbale), Azure DevOps, Jira, Confluence, NetSuite, Documenti. Se un altro computer ha letto una fonte, lo stato dice chi e quando. «Collega» è un pulsante normale.
   Sotto l'elenco, una volta sola, che cosa succede quando la credenziale è di chi condivide la cartella e a che cosa servono i «Documenti».
3. **Apri una fonte.** Premi «Collega» su Jira.
   Atteso: il modulo si apre sotto la sua riga, dentro lo stesso riquadro; «Chiudi» lo richiude.
4. **«Persone e calendario».**
   Atteso: in alto a destra «Nessuna modifica da salvare» e «Salva persone e calendario» pieno. «Persone» è una tabella da leggere (Nome, Ruolo, Parte, Allocazione %, Dal, Al): dove non c'è scritto nulla dice «dall'inizio», «c'è ancora», «non indicata». A destra, largo 400 px, il dettaglio della persona scelta: nove campi su due colonne, con le spiegazioni brevi sotto.
   Premi «Aggiungi una persona», scrivi `Verdi Luca` in «Nome».
   Atteso: la riga nuova è scelta nell'elenco e prende il nome mentre scrivi; «Nessuna modifica da salvare» sparisce. Premi «Salva persone e calendario».
   Atteso: «Salvati: … persone e … periodo.»
5. **Il glossario vuoto è una riga.** In fondo alla scheda.
   Atteso: «Glossario: sigle e nomi sentiti male · 0 righe · la forma giusta…» e «Chiedi a Claude le coppie». Premi il titolo: si apre con la tabella; premilo di nuovo: si richiude.
6. **«Pagina «Oggi»».**
   Atteso: tre righe in un riquadro; a sinistra (320 px) il titolo in grassetto e la spiegazione, a destra il comando: il campo degli indirizzi con «Salva gli indirizzi», la spunta della notifica, i tipi che non mostri.
7. **«Carta intestata».**
   Atteso: una riga con il nome, lo stato («Nessuna: i file Word escono su pagina bianca.» in grigio) e «Scegli un documento Word» a destra; la spiegazione sotto.
8. **«Avanzate».**
   Atteso: tre righe, l'etichetta in grassetto a sinistra e il menu (320 px) a destra; «Salva i modelli» sulla riga del titolo, con «Nessuna modifica da salvare» accanto finché non cambi una scelta.

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/sources.test.tsx apps/desktop/test/feeds.test.tsx apps/desktop/test/meetings.test.tsx apps/desktop/test/team.test.tsx apps/desktop/test/glossary.test.tsx apps/desktop/test/models.test.tsx apps/desktop/test/guide.test.tsx
```
