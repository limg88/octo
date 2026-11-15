# Demo 23 — L'accesso con l'utente aziendale e «Oggi», il riepilogo giornaliero del PM

Durata: 5 minuti. Una sola demo per tutti gli incrementi di `docs/riepilogo-giornaliero.md` e di `docs/identita-e-login.md`: l'accesso, la pagina «Oggi» con ciò che Octo calcola e ciò che Claude valuta, lo stato delle segnalazioni, il registro dei rischi e la pagina «Tutti i progetti».

## Prerequisiti
- Node 24, pnpm 12, un browser predefinito.
- Nessun accesso a Claude né ad altri sistemi: l'accesso aziendale, la posta e Claude sono finti e vivono su questo computer finché la finestra è aperta. Con `REAL=1` la valutazione la fa Claude Code con il tuo utente.
- Ciò che un PM imposta una volta (posta, cruscotto, ore, previsionale, sprint, persone e calendario) è già impostato, così la pagina mostra segnalazioni e non moduli.

I numeri delle ore, del previsionale e dei bug dipendono dal giorno in cui lanci la demo: i dati finti sono sempre «il mese scorso» e «oggi».

## Passi

1. **Avvia la demo ed entra.**
   ```bash
   bash demo/23-oggi/run.sh
   ```
   Atteso: Octo mostra solo «Entra in Octo», senza progetti né sezioni. Premi «Entra con l'utente aziendale»: si apre il browser su una pagina finta con un solo collegamento, «Entra come Paola Verdi». Premilo e torna a Octo.
   Atteso: Octo si apre su «Aurora», nella sezione «Oggi», la prima della colonna di sinistra. In basso a sinistra: «Sei Paola Verdi · Esci».
   Dimostra: senza accesso Octo non si apre; la password non passa mai da Octo; chi è entrato lo dice l'organizzazione, non un campo scritto a mano.

2. **Leggi le fonti.** Premi «Leggi ora».
   Atteso: sotto il titolo compare a quando risale ogni fonte («Posta: …», «Tracker del cliente: … di cinque giorni fa»). In cima, su fondo giallo: «Il tracker del cliente è di 5 giorni fa. Bug e requisiti qui sotto sono a quella data.»
   Dimostra: la pagina dice sempre a quando risale ciò che mostra, e un dato vecchio è la prima cosa che si legge.

3. **Guarda «Da fare oggi».**
   Atteso, dall'alto:
   - «Alle 15:00: Aurora: prova generale del collaudo», dall'invito arrivato per posta;
   - «Sprint 28: i due tracker non sono allineati», con «Perché oggi: lo sprint sta finendo.»;
   - «Rispondi a Carla Bianchi · «Aurora: budget aggiuntivo approvato»»;
   - «…: le ore di 3 persone non tornano» (Bianchi Anna, Neri Sara, Ugo Gialli);
   - «Previsionale di …: 2 dati che mancano» (la tariffa di Costa Elena, i costi totali).

   Non compaiono: la mail «data del collaudo», perché Paola ha già risposto (la risposta non nomina «Aurora» ed è entrata lo stesso, perché risponde a una mail del progetto); l'avviso del sistema di monitoraggio, perché non è una persona; la mail del progetto «Zefiro».
   Dimostra: ogni segnalazione dice da dove viene (l'etichetta), a quando risale e perché è lì. Che una mail aspetti lo calcola il codice, dalle risposte.

4. **Leggi la valutazione di Claude.** Dopo la lettura, sotto la mail di Carla Bianchi compare da sola: «Valutazione di Claude: importanza alta. … «Il comitato ha approvato un budget aggiuntivo di 8.000 euro» fonte controllata». Sotto l'elenco: «Valutazione di Claude del … (modello)».
   Dimostra: ciò che è giudicato sta a parte, si dichiara tale, dice quando e con quale modello, e la frase citata è stata cercata nel file dal codice. Claude è stato interpellato una volta, da solo, perché c'era una mail nuova.

5. **Vai dove si risolve.** Sulla segnalazione delle ore premi «Apri «Ore»».
   Atteso: la sezione «Ore» sul mese scorso, con le stesse persone. Torna su «Oggi».

6. **Rimanda, e metti da parte.** Sulle ore premi «Rimanda», poi «A domani». Sull'allineamento premi «Fatto».
   Atteso: le due segnalazioni spariscono; in fondo: «2 segnalazioni messe da parte.» Il contatore accanto a «Da fare oggi» scende.
   Dimostra: lo stato delle segnalazioni resta nel progetto. Quella rimandata torna domani in cima; quella fatta torna se fra tre giorni lavorativi il problema c'è ancora, o subito se peggiora.

7. **Guarda «Da tenere d'occhio».**
   Atteso: i bug fermi in una riga sola con il conteggio, le storie poco chiare del periodo, «Aspetti una risposta da Luca Neri · «Aurora: ambiente di prova»» (una domanda di Paola senza risposta da cinque giorni), «Neri Sara lascia il progetto fra 4 giorni», «Sprint 28 finisce domani», «1 rischio proposto da Claude».
   Dimostra: ciò che non chiede un'azione oggi sta a parte e non fa rumore: un tipo, una riga.

8. **Apri il registro dei rischi.** Premi «Registro dei rischi» in alto a destra.
   Atteso: nessun rischio aperto e, sotto «Proposti da Claude», un rischio con la sua fonte («wiki/stato.md», la frase, «fonte controllata»). Cambia il titolo se vuoi e premi «Accetta».
   Atteso: il rischio passa fra i «Rischi aperti». Nella cartella del progetto compare `_octo/progetto/rischi.md`, che risposte e deliverable possono citare.
   Dimostra: un rischio entra nel registro solo se il PM lo accetta; uno scartato non viene riproposto.

9. **Torna a «Oggi», poi apri «Tutti i progetti».** Premi «Torna a «Oggi»»; poi il nome del progetto in alto a sinistra e «Tutti i progetti».
   Atteso: una riga per progetto. «Aurora»: quante cose da fare e quante da tenere d'occhio, le prime tre, la data dell'ultima valutazione. «Boreale»: «Niente da segnalare.» Premi «Apri «Oggi» di Boreale».
   Atteso: «Oggi Octo non ha nulla da segnalarti.»
   Dimostra: sopra i progetti Octo calcola soltanto; Claude non viene mai interpellato per un progetto che non apri.

10. **Esci.** In basso a sinistra premi «Esci».
    Atteso: torna la pagina «Entra in Octo»; progetti e sezioni non si vedono più.

## Che cosa dimostra
- Octo sa chi lo usa, e senza accesso non si apre.
- «Oggi» mette in una pagina ciò che nessuna sezione, da sola, direbbe: ore, previsionale, tracker, allineamento, posta, calendario, riunioni, rischi.
- Ciò che è calcolato è certo, immediato e datato; ciò che è giudicato è a parte, firmato e con la fonte controllata.
- Poche segnalazioni, ordinate con una regola che si legge, e ognuna si può fare, rimandare o mettere da parte.

## Che cosa questa demo non mostra
- L'accesso a un Entra ID vero: serve la registrazione dell'app nel tenant.
- Le commesse assegnate lette da NetSuite («Cerca le tue commesse» nelle impostazioni di NetSuite e l'avviso «non risulta assegnato a te»): richiedono l'archivio dei dati aziendali; sono provate dai test contro il database di prova (`pnpm db:setup`).
- La posta su Windows: non c'è ancora un lettore.

## Test e copertura
```bash
pnpm test
pnpm test:coverage
```
