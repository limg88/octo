# Demo 81 — «Commessa» rivista: una fascia di cifre, la fonte di ogni voce, i tuoi dati sotto la riga

Durata: 5 minuti. Quarto incremento della revisione fatta con Claude Design (`docs/claude-design/esito.md`, tavole `CommDopo`, `D03`, `D04`, `D05`).

## Prerequisiti
- Node 24, pnpm 12, Docker avviato (il NetSuite finto è un database del Postgres di prova). Nulla esce dal computer.

## Passi

1. **Avvia la demo e apri «Commessa».**
   ```bash
   bash demo/81-commessa-rivista/run.sh
   ```
   Atteso: il titolo della pagina è «Commessa»; subito sotto le schede «Documento interno: costi e margini non vanno al cliente.»; «Copia i dati per un report» in alto a destra.
2. **Leggi la fascia.**
   Atteso: un solo riquadro con cinque cifre: Ordinato 7.500,00 («ordine SO-17»), Fatturato (NetSuite) 2.250,00, Costi a oggi 3.147,50, Margine a oggi 58,03% («a finire 46,67%»), Scostamento da NetSuite 560,00 con «Da verificare» in ambra.
   Dimostra: lo scostamento fra ciò che calcola Octo e ciò che ha registrato NetSuite non è più una frase in fondo alla pagina.
3. **L'avviso sugli esterni** è sotto la fascia, con «Apri «Previsionale»» a destra.
4. **Le due colonne.** A sinistra «Ordine, ricavi e da regolare»: Voce, Valore, Fonte. «NetSuite» in blu dove la cifra è letta, «Octo» in grigio dove è calcolata. A destra «Ore e costi per persona»: «timesheet» in blu, «senza timesheet, dichiarate» in ambra; sotto «Costi secondo NetSuite» con «Lo scostamento è nella fascia in alto.»
5. **«Fatturazione».**
   Atteso: niente riquadri di cifre; «Dai fornitori» è una tabella con «Da fatturare», la riga «Totale» e la colonna «Fonte»; sotto «“Ricevuto” è il costo sulla commessa.»
6. **«Ore».** Il titolo resta «Commessa» e l'avviso «Documento interno» c'è anche qui.
   Atteso: «Mese» con il suo campo sulla stessa riga; un riquadro con due righe, ciascuna con nome, stato («Letti» in verde, «Non lette per ottobre 2026» in grigio), una nota, la «i» con il testo intero e il pulsante. È pieno solo quello della prima lettura che manca. Sotto, tratteggiato: «Il confronto delle ore compare qui dopo le due letture.»
7. **«Previsionale».**
   Atteso: una riga di comandi (Mese, «Impostazioni del previsionale» quieto, «Salva i dati del mese» pieno). La tabella ha solo le colonne calcolate; «Margine finale» dice «manca» in ambra. Sotto la riga scelta, «Assessment Aurora · PRJ000101 — i tuoi dati di ottobre 2026» con tre campi: «Ricavi corretti», «Da fatturare nel mese», «Tua nota»; «Calcolo e dettagli» a destra.
   Scrivi `SAL di ottobre` in «Tua nota» e premi «Salva i dati del mese».
   Atteso: «Salvato»; la nota resta nel campo.
8. **«Dati che mancano».** Una riga con «manca», la frase e a destra «Scrivi i costi di PRJ000101»: premilo.
   Atteso: si apre «Calcolo e dettagli» sotto la riga, sul campo dei costi totali.
9. **Stringi la finestra** sotto 1.120 px in «Sintesi», poi sotto 1.040.
   Atteso: le due colonne di tabelle vanno una sotto l'altra; poi la fascia va su due righe (3 + 2).

## Prova automatica
```bash
pnpm vitest run apps/desktop/test/project-sheet.test.tsx apps/desktop/test/hours.test.tsx apps/desktop/test/forecast.test.tsx
pnpm e2e:commessa
```
