# Demo 55 — Revisione delle schermate: azioni in vista, tabelle allineate, stati leggibili

Durata: 5 minuti. I 23 interventi di `docs/revisione-ux.md` (UX-01 … UX-23), raggruppati per sezione.

## Prerequisiti
- Node 24, pnpm 12, macOS o Linux.
- Nessun accesso a Claude né ad altri sistemi: posta, tracker e Claude sono finti e vivono su questo computer.
- Chi entra è già «Paola Verdi».

## Passi

1. **Oggi: quattro punti all'ingresso.**
   ```bash
   bash demo/55-revisione-ux-schermate/run.sh
   ```
   In «Il Punto» aggiungi punti dal campo rapido finché sono più di quattro.
   Atteso: se ne vedono quattro e «Mostra gli altri N» conta i rimanenti; premendolo si vedono tutti nello stesso ordine, «Mostra meno» torna a quattro. «Adesso» è più in alto.
   Dimostra: la coda non toglie la prima schermata alle urgenze (UX-06).

2. **Schede e impostazioni chiuse.** Apri «Cruscotto», poi «Previsionale» e «Impostazioni», cambiando scheda con il mouse e con Tab. Prova anche l'altro tema dal selettore in basso.
   Atteso: solo la scheda attiva è viola tenue, in grassetto e sottolineata; il contorno del focus resta visibile. «Impostazioni del cruscotto» chiusa non lascia più spazio vuoto sotto di sé; aperta, il modulo resta staccato dal comando.
   Dimostra: la selezione si riconosce anche senza colore (UX-01, UX-05).

3. **Cruscotto → Bug: le azioni sopra il commento.** Seleziona un bug con un commento.
   Atteso: «Chiedi di questo bug», «Scrivi una nota» e l'apertura nel tracker stanno subito sotto i dati del bug, prima di nota e commento. «Scrivi una nota» mette il modulo nello stesso punto; «Annulla» riporta i pulsanti.
   Dimostra: l'azione frequente non richiede di scorrere (UX-12).

4. **Ore: misure allineate, assenza prevista neutra.** Apri «Ore». Su una riga «Nessuna ora sul tracker» premi il comando che la segna come attesa.
   Atteso: le intestazioni numeriche finiscono sullo stesso bordo destro delle cifre; ordinando una misura il simbolo ▲/▼ compare a sinistra dell'etichetta senza spostarla. La riga segnata dice «Assenza prevista» in grigio; «Torna» resta verde, le righe da verificare ambra. Scrivi «prevista» in «Filtra»: resta quella riga.
   Dimostra: uno stato previsto non sembra una quadratura riuscita (UX-03, UX-13).

5. **Previsionale: una riga per commessa.** Apri «Previsionale», scheda del mese.
   Atteso: sopra la tabella una spiegazione di tre frasi; ogni commessa occupa una riga. «Calcolo e dettagli» apre sotto la riga «Come è calcolato» e i campi di quella sola commessa. Con sole commesse a giornate c'è la colonna «Giorni» e non «Avanzamento» (il contrario con sole quote, entrambe se il mese è misto). Stringi la finestra: scorre la tabella, «Salva» resta fermo.
   Dimostra: il confronto fra commesse non è interrotto dalle spiegazioni (UX-14, UX-15, UX-16 nella scheda «Commessa»).

6. **Avanzamento: «Nuova richiesta» prima delle fatture.** Apri «Avanzamento», imposta l'ordine se richiesto e aggiungi due richieste.
   Atteso: «Nuova richiesta» sta dopo i totali e gli avvisi; il modulo si apre in quel punto. «Correggi» su una richiesta dello storico apre il modulo in alto e porta lì il focus (il titolo del modulo). Le posizioni «Non fatturata», quando NetSuite è collegato, sono grigie e non ambra.
   Dimostra: il modulo compare dove si è scelta l'azione (UX-17, UX-18).

7. **Allineamento: un avviso, export in testa.** Apri «Allineamento». In «Che cosa confronto» metti uno stato in un gruppo diverso dalla fase che ha nel Cruscotto e salva.
   Atteso: un solo riquadro ambra «Uno stato è letto in modo diverso dal Cruscotto» (o «N stati…»); un clic mostra l'elenco e un solo rimando alle due configurazioni. Sotto il titolo «Senza ticket» c'è subito il pulsante di export, prima di filtro e righe; dopo l'export il risultato e «Apri il file» sono lì accanto.
   Dimostra: i risultati partono più in alto e l'azione sta in testa alla sua lista (UX-19, UX-20).

8. **Chiedi e Deliverable.** In «Chiedi» apri una chat nuova, fai una domanda e premi un richiamo numerato. In «Deliverable» crea una bozza, approvala e apri «Registro».
   Atteso: la chat vuota ha una sola frase su continuità e fonti; sotto «Frase riscontrata nel file» c'è «Leggi il contesto della fonte per valutare la conclusione.». Sul documento approvato con rilievi la rilettura dice «La rilettura segnalava correzioni prima dell'invio.» e i file restano in cima; con più di otto fonti l'elenco è una riga «Fonti · N» che si apre con un clic, e i richiami nel testo funzionano anche a elenco chiuso. Il registro parla di tempi e giri, non di costi.
   Dimostra: stato attuale e giudizio storico non si contraddicono (UX-07 … UX-11).

9. **Impostazioni.** Apri «Impostazioni»: «Collegamenti», «Persone e calendario», «Avanzate».
   Atteso: il pulsante pieno è «Leggi tutte le fonti»; l'editor delle persone usa la larghezza della finestra e mostra anche l'ultima colonna e «×» senza scorrere di lato, mentre il calendario tiene la sua misura; l'introduzione dei modelli spiega «Predefinito» in due frasi.
   Dimostra: nomi espliciti e spazio usato dove serve (UX-21, UX-22, UX-23).

Le tabelle semplici (UX-02) e l'attesa comune all'apertura delle sezioni (UX-04) si vedono rispettivamente nelle demo 49 e 54 (registro Attività, Commessa, Avanzamento a corpo) e in ogni sezione appena aperta: una riga con la rotellina, letta dagli screen reader.

## Test
```bash
pnpm test
pnpm test:coverage
pnpm exec vitest run apps/desktop/test/<file>.test.tsx   # mirati
```
