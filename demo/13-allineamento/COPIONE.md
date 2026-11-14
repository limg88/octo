# Demo 13 — Allineamento: il tracker del cliente e il tuo, sprint per sprint

Durata: 4 minuti. Mostra il confronto fra le voci del tracker del cliente in uno sprint e i ticket del tracker interno: quali sono collegati, quali ticket stanno nello sprint sbagliato, quali voci non hanno ticket, quali ticket nominano una voce che non c'è. Ogni lista è fatta dal codice; Claude non interviene.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso ai tracker: l'esportazione del tracker del cliente (otto voci) e i ticket (otto, come li scrive la fonte Jira di Octo) sono finti e già nella cartella del progetto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/13-allineamento/run.sh
   ```
   Atteso: si apre Octo sul progetto «Aurora».

2. **Apri «Allineamento».**
   Atteso: «Che cosa confronto», con il file dell'esportazione e la cartella dei ticket già indicati.

3. **Indica lo sprint e la squadra e salva.** In «Sprint» scrivi `Sprint 28`, in «Tag delle voci che sono della tua squadra» `Squadra`, premi «Salva».
   Atteso: «6 voci del cliente nello sprint: 3 con il ticket nello sprint, 1 con il ticket altrove, 2 senza ticket.» e «Quadratura: ogni voce è in una sola delle tre liste.»
   Dimostra: la voce di un altro sprint e quella di un'altra squadra restano fuori; i numeri tornano.

4. **Leggi le liste.**
   - «Senza ticket»: le voci 105 e 106.
   - «Ticket da spostare nello sprint»: la 103, il cui ticket `AUR-3` è rimasto nello Sprint 27.
   - «Collegate»: la 101 per l'id nel titolo del ticket (`[AZDO 101]`), la 102 perché porta `AUR-7` fra i tag, la 104 con due ticket.
   - «Voci con più di un ticket»: la 104 (`AUR-4, AUR-5`).
   - «Ticket che nominano una voce che non c'è»: `AUR-8`, che nomina la 999.
   - «Forse sono la stessa cosa»: la voce 106 e il ticket `AUR-6`, titoli quasi uguali ma nessun riferimento. Octo li propone, non li collega.

5. **Di' quali stati vogliono dire la stessa cosa.** Apri «Che cosa confronto», in «Stati che vogliono dire la stessa cosa» scrivi:
   ```
   da fare: New = Da completare
   in corso: In Progress = In corso
   chiuso: Closed = Completata
   ```
   e premi «Salva».
   Atteso: fra le collegate, la 101 ha stati «Coerenti»; la 102 «Diversi»: per il cliente è in corso, il ticket è già completato.

6. **Scrivi il file di import.** In «Senza ticket» premi «Scrivi il file di import dei ticket mancanti», poi «Apri il file».
   Atteso: `_octo/allineamento/mancanti_sprint-28.csv` con due righe: titolo con l'id della voce (`[AZDO 105] …`), tipo `Story`, descrizione senza HTML, sprint. L'import nel tuo tracker lo fai tu.
   Dimostra: al prossimo confronto quei ticket risulteranno collegati, perché il titolo porta l'id.

## Che cosa dimostra
- Nessun collegamento è fatto «a somiglianza»: solo per tag o per id nel titolo. Le somiglianze sono proposte da confermare.
- Octo non scrive in nessuno dei due tracker.
- Le regole (prefisso del riferimento, tag della squadra, gruppi di stati) sono impostazioni del progetto.

## Che cosa non fa ancora
- Non legge i ticket da solo in questa demo: nell'uso reale sono quelli della fonte Jira configurata in «Fonti».
- Non mette priorità né assegnatario del tuo tracker nel file di import.
- Non tiene conto delle persone per cui l'assenza di ticket è attesa.
