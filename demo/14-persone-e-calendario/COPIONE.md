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

3. **Scrivi persone e calendario.** Apri «Impostazioni» e, in alto, la parte «Persone e calendario». Ogni persona è una riga con un campo per valore. Nella prima: nome `Neri Sara`, ruolo `analista`, allocazione `50`, «Al» il 31 gennaio 2026. Premi «Aggiungi una persona»: nome `Carla Bianchi`, ruolo `referente`, parte «cliente», «Come scrivergli» `dare del lei, prima la richiesta e poi il contesto`.
   Nel calendario: `Fase 3` dal 1° ottobre al 31 dicembre 2026; con «Aggiungi un periodo», `Sprint 28` dal 26 ottobre al 13 novembre 2026.
   Premi «Salva persone e calendario».
   Atteso: «Salvati: 2 persone e 2 periodi.» Nel testo del progetto Neri Sara è «analista, al 50% del suo tempo». Un'allocazione di `150` o scritta a parole non si salva: «Persona 1: l'allocazione è una percentuale, più di 0 e al massimo 100.» Nella cartella del progetto compare `_octo/progetto/persone-e-calendario.md`, con le persone divise fra «Dalla nostra parte» e «Dal cliente» e la tabella del calendario.
   Dimostra: è un testo del progetto come gli altri: risposte e deliverable lo leggono e lo citano. L'email al cliente segue ciò che è scritto sul destinatario.

4. **Torna a «Ore».**
   Atteso: Neri Sara è «Atteso»: ha lasciato il progetto a gennaio, le ore che mancano nel mese scorso non sono un'anomalia.

5. **Usa una domanda pronta.** Apri «Chiedi» e premi «Blocchi e rischi».
   Atteso: la domanda compare nel riquadro, completa, e non parte da sola: la puoi correggere prima di inviarla.

6. **Crea un progetto nuovo.** Nella colonna di sinistra premi il nome del progetto, poi «Aggiungi un progetto…»; sotto «Parto da zero» scrivi `Boreale`, premi «Scegli dove crearla…» e scegli la cartella `Nuovi progetti` stampata nel terminale.
   Atteso: «Boreale» compare fra i progetti e si apre su «Impostazioni». Nella cartella scelta c'è `Boreale/` con `LEGGIMI.md` e le cartelle `Contratti`, `Documenti`, `Riunioni`, `Tracker`.

7. **Riprova con lo stesso nome.** Di nuovo «Aggiungi un progetto…», `Boreale`, stessa cartella.
   Atteso: «Lì c'è già una cartella con questo nome»: Octo non scrive sopra una cartella che esiste.

## Che cosa dimostra
- Persone, ruoli, preferenze e date dei periodi si scrivono una volta e non si ripetono a ogni richiesta.
- Chi non era sul progetto in un periodo non genera segnalazioni sulle ore.
- Un PM nuovo parte da una cartella già ordinata.

## Che cosa non fa ancora
- Non legge persone e calendario da file di configurazione che il progetto ha già: si scrivono qui.
- Le domande pronte sono quattro e uguali per tutti i progetti.
