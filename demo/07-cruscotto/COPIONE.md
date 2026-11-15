# Demo 07 — Cruscotto bug e requisiti

Durata: 4 minuti. Mostra il cruscotto calcolato da Octo da un'esportazione del tracker tenuta nella cartella del progetto: bug aperti per fase, fermi oltre soglia, andamento su un periodo a scelta, dove si fermano i bug, requisiti poco chiari. Ogni cifra è calcolata dal codice; Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né a un tracker: l'esportazione è finta (36 bug e 6 storie, datati a ritroso da oggi).

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/07-cruscotto/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Cruscotto».**
   Atteso: «Da dove leggo bug e requisiti», con il file `dati/tracker/export.json` e la cronologia `dati/tracker/cronologia.json` già proposti.
   Dimostra: Octo trova da solo le esportazioni nella cartella; non c'è niente da cercare a mano.

3. **Limita al tuo perimetro e salva.** In «Solo gli elementi con questi tag» scrivi `Squadra` e premi «Salva». La prima volta si scrive, perché l'esportazione non è ancora stata letta; da allora, in «Impostazioni del cruscotto», i tag dell'esportazione sono caselle da spuntare.
   Atteso: «Dati aggiornati»; Bug aperti **15** su 30 nel perimetro; In lavorazione **10**; In verifica **5**; Validati, in attesa di rilascio **2**; Fermi da oltre 30 giorni **11**.
   Dimostra: i 6 bug dell'altro fornitore restano fuori; «aperto» vuol dire che qualcuno deve ancora fare qualcosa prima del rilascio.

4. **Guarda l'andamento.** Sotto «Andamento» ci sono le ultime 8 settimane: barre per entrati e usciti, linea per gli aperti a fine settimana, e la stessa cosa in tabella.
   Premi «12 mesi».
   Atteso: il grafico passa a dodici passi mensili.
   Premi «Scelgo io», cambia «Dal» e il «Passo».
   Atteso: il grafico segue le date e il passo scelti.
   Dimostra: il periodo non è fisso alla settimana.

5. **Guarda dove si fermano i bug.**
   Atteso: tre mediane in giorni — dall'apertura alla verifica, dalla verifica alla validazione, dalla validazione alla chiusura — ciascuna con il numero di bug su cui è calcolata.

6. **Scrivi una nota su un bug fermo.** Nella prima riga di «Bug aperti» premi «Scrivi una nota», scrivi `Sentito il cliente: dati entro venerdì` e premi «Salva la nota».
   Atteso: la nota compare nella riga come «Nota tua», con la data, al posto dell'ultimo commento del tracker.
   Dimostra: la decisione del PM resta nel progetto, non nel tracker.

7. **Guarda i requisiti poco chiari.**
   Atteso: quattro storie; la prima, «Esportazione in Excel», ha tre segnali (S1, S2, S5) e la frase «…ancora da definire con il cliente…».
   Premi «È chiaro» su «Stampa etichette».
   Atteso: la storia esce dall'elenco.

8. **Controlla dove sono le decisioni.** Nel terminale:
   ```bash
   cat .tmp/demo-07/Aurora/_octo/.impostazioni/dashboard.json
   ```
   Atteso: percorso dell'esportazione, tag, la nota e la storia esclusa, ciascuna con la sua data. L'esportazione non è stata toccata.

9. **(Facoltativo) Dati vecchi.** Chiudi Octo e rilancia con `OLD=1 KEEP=1 bash demo/07-cruscotto/run.sh`.
   Atteso: in «Cruscotto» l'avviso «Dati di oltre 3 giorni: aggiorna l'esportazione prima di usarli».
