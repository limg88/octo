# Demo 16 — Il cruscotto da Azure DevOps com'è adesso

Durata: 3 minuti. Mostra che il cruscotto non dipende più da un file esportato da qualcun altro: Octo legge Azure DevOps con il Personal Access Token del PM, nel momento in cui il PM lo chiede, e calcola il cruscotto da lì, con i cambi di stato veri e l'ultimo commento di ogni bug.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso ad Azure DevOps vero: lo script ne avvia uno finto su questo computer.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/16-cruscotto-da-ado/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Collega Azure DevOps.** Apri «Fonti» e premi «Collega» nella riga «Azure DevOps». Organizzazione `contoso`, Progetto `Aurora`, Personal Access Token `demo-pat`. Premi «Prova e salva».
   Atteso: «Collegamento riuscito e salvato.»
   Dimostra: la credenziale è la stessa che alimenta la memoria; resta su questo computer.

3. **Apri «Cruscotto».**
   Atteso: nessun file da scegliere a mano. In alto c'è «Leggi da Azure DevOps».

4. **Premi «Leggi da Azure DevOps».**
   Atteso: «Letti 3 work item, 1 con la cronologia, alle …», poi il cruscotto: «Dati aggiornati», 1 bug aperto, in verifica, con il commento «Corretto: in attesa del test del cliente».
   Dimostra: i dati sono di adesso, non di un file vecchio. Nella cartella del progetto ci sono `_octo/cruscotto/azure-devops.json` e `_octo/cruscotto/azure-devops-cronologia.json`.

5. **Guarda l'andamento.**
   Atteso: non compare la nota «Senza cronologia»: gli ingressi e le uscite seguono i cambi di stato letti da Azure DevOps.

6. **Guarda il riepilogo in numeri.** Nel terminale:
   ```bash
   cat .tmp/demo-16/Aurora/_octo/cruscotto/riepilogo.md
   ```
   Atteso: la data dei dati, il perimetro, i bug per fase e storie e bug per sprint e stato.
   Dimostra: i conteggi li fa il codice. Chi risponde in «Chiedi» e chi scrive un deliverable li cita da qui, con la loro data, al posto di contare o di usare un'esportazione vecchia trovata nella cartella.

7. **Rileggi quando vuoi.** Apri «Impostazioni del cruscotto» e premi di nuovo «Leggi da Azure DevOps».
   Atteso: una nuova lettura, con la nuova ora. Tag, periodi e note che avevi messo restano.

## Che cosa dimostra
- Il cruscotto e l'allineamento fra tracker usano lo stesso file: una lettura aggiorna entrambi.
- Octo legge soltanto: chiede i work item, i loro cambi di stato e i commenti. Non scrive mai su Azure DevOps.
- Un file esportato a mano resta utilizzabile: basta indicarlo nelle impostazioni.
