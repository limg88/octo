# Demo 43 — Il cruscotto da Jira, per un progetto senza Azure DevOps

Durata: 3 minuti. Mostra che il cruscotto non ha bisogno di Azure DevOps: se il progetto ha solo Jira, Octo legge le issue da lì, con il token del PM, e calcola il cruscotto con i cambi di stato veri e l'ultimo commento di ogni bug.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Jira vero: lo script ne avvia uno finto su questo computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/43-cruscotto-da-jira/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Cruscotto» prima di collegare qualcosa** e premi «Leggi da Azure DevOps».
   Atteso: «Né Azure DevOps né Jira sono collegati a questo progetto: collegane uno in «Impostazioni», poi torna qui a leggere.»
   Dimostra: senza un tracker collegato Octo lo dice, e nomina entrambi.

3. **Collega Jira.** Apri «Impostazioni» e premi «Collega» nella riga «Jira». Sito `demo`, Email `pm@example.test`, Token `demo-token`, Progetti `AUR`. Premi «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.» Azure DevOps resta non collegato.

4. **Torna a «Cruscotto».**
   Atteso: il pulsante ora è «Leggi da Jira» e il testo sopra dice che Azure DevOps non è collegato e che la lettura viene da Jira.

5. **Premi «Leggi da Jira».**
   Atteso: «Lette 5 voci, 5 con la cronologia, alle …», poi il cruscotto: «Dati aggiornati», 2 bug aperti (uno «In corso», uno «In test» in verifica); il bug «Certificato scaduto sul gateway» è chiuso («Completata»).
   Dimostra: gli stati di un Jira in italiano cadono nella fase giusta. Nella cartella del progetto ci sono `_octo/cruscotto/jira.json` e `_octo/cruscotto/jira-cronologia.json`.

6. **Apri un bug sul tracker.** Nella scheda «Bug» scegli «Il flusso ordini si ferma senza avviso» e premi «Apri su Jira».
   Atteso: il browser apre `…/browse/AUR-1` (nella demo l'indirizzo è quello del sito `demo.atlassian.net`, che non esiste: conta l'indirizzo).
   Dimostra: l'id di una voce di Jira è la sua chiave, e l'indirizzo è costruito da Octo, mai dalla finestra.

7. **Guarda l'andamento**, nella scheda «Andamento».
   Atteso: non compare la nota «Senza cronologia»: ingressi e uscite seguono i cambi di stato letti dal changelog di Jira.

8. **Guarda il riepilogo in numeri.** Nel terminale:
   ```bash
   cat .tmp/demo-43/Aurora/_octo/cruscotto/riepilogo.md
   ```
   Atteso: la data dei dati, i bug per fase, storie e bug per stato.

## Che cosa dimostra
- Un progetto con solo Jira ha il suo cruscotto, senza esportazioni a mano.
- Se il progetto ha entrambi i tracker, il cruscotto si legge da Azure DevOps, come prima: nulla cambia per chi lo usava.
- Octo legge soltanto: le issue dei progetti scelti, i loro cambi e i commenti. Non scrive mai su Jira.

## Che cosa non fa ancora
- Jira non ha un periodo di pianificazione (PI): quel filtro resta vuoto. Lo sprint è quello attivo della issue.
- I criteri di accettazione non hanno un campo standard in Jira: i segnali che li guardano non scattano.
