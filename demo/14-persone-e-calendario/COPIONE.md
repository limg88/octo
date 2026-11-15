# Demo 14 — Persone e calendario, domande pronte, progetto nuovo

Durata: 5 minuti. Mostra tre cose piccole che servono ogni giorno: le persone e il calendario del progetto scritti una volta e usati da tutto il resto, le domande pronte in «Chiedi», e la cartella di un progetto nuovo creata da Octo.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: timesheet e ore del tracker sono finti (mese scorso), il modello che risponde è finto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/14-persone-e-calendario/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Guarda le ore senza le persone.** Apri «Ore».
   Atteso: Neri Sara è segnalata «Nessuna ora sul tracker».

3. **Scrivi persone e calendario.** Apri «Fonti», scendi a «Persone e calendario». In «Persone» scrivi:
   ```
   Neri Sara; analista; nostra; ; 31/01/2026
   Carla Bianchi; referente; cliente; ; ; dare del lei, prima la richiesta e poi il contesto
   ```
   In «Calendario» scrivi:
   ```
   Fase 3; 01/10/2026; 31/12/2026
   Sprint 28; 26/10/2026; 13/11/2026
   ```
   Premi «Salva persone e calendario».
   Atteso: «Salvate 2 persone e 2 periodi.» Nella cartella del progetto compare `_octo/progetto/persone-e-calendario.md`, con le persone divise fra «Dalla nostra parte» e «Dal cliente» e la tabella del calendario.
   Dimostra: è un testo del progetto come gli altri: risposte e deliverable lo leggono e lo citano. L'email al cliente segue ciò che è scritto sul destinatario.

4. **Torna a «Ore».**
   Atteso: Neri Sara è «Atteso»: ha lasciato il progetto a gennaio, le ore che mancano nel mese scorso non sono un'anomalia.

5. **Usa una domanda pronta.** Apri «Chiedi» e premi «Blocchi e rischi».
   Atteso: la domanda compare nel riquadro, completa, e non parte da sola: la puoi correggere prima di inviarla.

6. **Crea un progetto nuovo.** Nella colonna di sinistra premi il nome del progetto, poi «Aggiungi un progetto…»; sotto «Parto da zero» scrivi `Boreale`, premi «Scegli dove crearla…» e scegli la cartella `Nuovi progetti` stampata nel terminale.
   Atteso: «Boreale» compare fra i progetti e si apre su «Fonti». Nella cartella scelta c'è `Boreale/` con `LEGGIMI.md` e le cartelle `Contratti`, `Documenti`, `Riunioni`, `Tracker`.

7. **Riprova con lo stesso nome.** Di nuovo «Aggiungi un progetto…», `Boreale`, stessa cartella.
   Atteso: «Lì c'è già una cartella con questo nome»: Octo non scrive sopra una cartella che esiste.

## Che cosa dimostra
- Persone, ruoli, preferenze e date dei periodi si scrivono una volta e non si ripetono a ogni richiesta.
- Chi non era sul progetto in un periodo non genera segnalazioni sulle ore.
- Un PM nuovo parte da una cartella già ordinata.

## Che cosa non fa ancora
- Non legge persone e calendario da file di configurazione che il progetto ha già: si scrivono qui.
- Le domande pronte sono quattro e uguali per tutti i progetti.
