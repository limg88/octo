# Demo 24 — La revisione dell'interfaccia: dal segnale alla fonte, alla domanda, alla bozza

Durata: 5 minuti. Una sola demo per i quattro incrementi della revisione: colori, tema e marchio; «Oggi» e «Cruscotto» come elenco con il dettaglio accanto; la fonte di una citazione accanto alla risposta e il passaggio a un deliverable; le attese dette dove avvengono.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: posta, tracker e Claude sono finti e vivono su questo computer. Con `REAL=1` risponde Claude Code con il tuo utente.
- Chi entra è già «Paola Verdi»: l'accesso lo mostra la demo 23.

I numeri delle ore, del previsionale e dei bug dipendono dal giorno in cui lanci la demo: i dati finti sono sempre «il mese scorso» e «oggi». Dove il copione dice un numero, conta che il numero sul pulsante sia quello delle righe elencate.

## Passi

1. **Avvia la demo e guarda la cornice.**
   ```bash
   bash demo/24-revisione-ux/run.sh
   ```
   Atteso: in alto a sinistra il polpo su fondo viola accanto a «octo»; a destra del nome due pulsanti, sole e luna. La testata dice «AURORA» in piccolo e sotto «Oggi», il titolo della sezione. Il percorso della cartella non è in vista: premi «Cartella del progetto» e compare.
   Dimostra: il titolo della pagina è la sezione in cui sei; ciò che è tecnico sta a un clic.

2. **Cambia tema.** Premi la luna, poi il sole, poi di nuovo la luna. Chiudi la finestra e rilancia con `KEEP=1 bash demo/24-revisione-ux/run.sh`.
   Atteso: fondo quasi nero con pannelli appena più chiari, poi fondo bianco con la colonna di sinistra grigio chiarissimo. La sezione scelta ha un segno viola a sinistra. Alla riapertura il tema è quello lasciato.
   Dimostra: i fondi sono neutri in entrambi i temi; la scelta è della persona e resta. Finché non scegli, Octo segue il sistema.

3. **«Oggi» come elenco e dettaglio.** Premi «Leggi ora» e aspetta.
   Atteso: il pulsante mostra un anello che gira e «Leggo…» senza cambiare misura; l'elenco di prima resta leggibile. Poi: a sinistra le cose da fare, ognuna con l'etichetta azzurra della provenienza e, dove c'è una scadenza, un'etichetta ambra con il rombo («Fine sprint», «Scadenza»); a destra il dettaglio della riga scelta, con «Calcolato da Octo» in testa.
   Scegli la mail di Carla Bianchi: nel dettaglio la «Valutazione di Claude» sta in un riquadro a parte, con la frase citata e «fonte controllata».
   Dimostra: ciò che è calcolato e ciò che è giudicato si distinguono; il colore ha sempre una parola accanto.

4. **Filtra, rimanda, annulla.** Premi il filtro «Posta»: il numero sul pulsante è quello delle righe. Sulla prima riga premi «Rimanda», poi «A domani».
   Atteso: la riga esce, in vista entra quella che ne prende il posto, e sopra l'elenco compare «Rimandata: …» con «Annulla». Premi «Annulla»: la riga torna ed è di nuovo quella in vista.
   Dimostra: filtri e conteggi sono le stesse righe; ciò che metti da parte si riprende con un clic.

5. **Dai bug fermi al bug.** In «Da tenere d'occhio» premi «Apri «Cruscotto»» sulla riga dei bug fermi.
   Atteso: «Cruscotto» si apre sul conteggio «di cui Fermi da oltre 30 giorni», già premuto, con l'elenco di quei soli bug. Sotto i conteggi una riga spiega: gli aperti sono in lavorazione o in verifica, i fermi sono una parte degli aperti, i validati non sono più aperti. Premi «Validati, in attesa di rilascio»: l'elenco cambia e ha tante righe quante ne dice il numero.
   Scegli un bug: a destra identificativo, assegnatario, stato, giorni nello stato e l'ultimo commento. Grafico, periodi e requisiti sono sotto, come prima.
   Dimostra: ogni conteggio apre il suo elenco; la relazione fra i numeri è scritta.

6. **Dal bug alla domanda.** Torna su «di cui Fermi…», scegli il primo bug e premi «Chiedi di questo bug».
   Atteso: si apre «Chiedi» con la domanda già scritta (identificativo, titolo, stato e giorni del bug) e non ancora inviata. Premi «Chiedi»: il pulsante mostra l'anello e «Chiedo…», accanto compare «Ferma».
   Torna a «Cruscotto»: il conteggio e il bug scelti sono ancora quelli.
   Dimostra: il contesto del bug viaggia con te; l'attesa è detta sul pulsante che l'ha avviata e si può fermare.

7. **La fonte accanto alla risposta.** In «Chiedi» scrivi «Quando consegniamo il modulo ordini?» e invia. Nella risposta premi il richiamo «1».
   Atteso: a destra il pannello «Fonte citata» con provenienza e data in azzurro, il nome del file, la frase citata, «Frase riscontrata nel file» e sotto: «Il controllo dice che la frase è nel file. Non dice che la conclusione tratta sia giusta». «Percorso completo» mostra il percorso; «Apri l'originale» apre il file. La risposta è rimasta dov'era.
   Poi chiedi «E il budget? #inventa»: il richiamo è ambra, il pannello dice «La frase non è nel file» e di verificare sull'originale.
   Dimostra: la citazione si consulta senza perdere la risposta; «riscontrata nel file» non è «conclusione verificata».

8. **Dalla risposta alla bozza.** Sotto la prima risposta premi «Prepara un deliverable da questa risposta».
   Atteso: «Deliverable» si apre con il riquadro «Contesto dalla risposta» (la domanda e quante fonti). Scegli «Voce di backlog»: il campo «Altro da sapere» è già compilato con domanda, fonti citate e risposta. Scrivi il bisogno e premi «Scrivi la bozza»: anello e «Scrivo…» sul pulsante.
   Poi: a sinistra la bozza con i suoi richiami, a destra «Rilettura» con la rilettura critica, ciò che va controllato, «Che cosa vuoi cambiare?» e «Approva»; sotto, la fonte citata. Accanto al titolo «Interno» o «Per il cliente». Se ci sono rilievi, «Segna come rivisto» li conta; chiedi una modifica e tornano da rivedere.
   Premi «Approva»: compaiono i file pronti (Markdown e Word).
   Dimostra: la bozza nasce dal contesto della risposta; ciò che hai rivisto vale per la bozza su cui l'hai rivisto.

9. **Cambia progetto.** Dal selettore in alto a sinistra scegli «Boreale», poi torna ad «Aurora».
   Atteso: in «Boreale» non c'è nulla di Aurora: né la domanda scritta, né il contesto, né il bug scelto. Tornando ad «Aurora», filtri e scelte ripartono dall'inizio.
   Dimostra: niente di un progetto segue il PM in un altro.

10. **Finestra piccola.** Restringi la finestra fino al minimo (900×600).
    Atteso: il dettaglio va sotto l'elenco, la fonte sotto la risposta, la rilettura sotto la bozza; tutti i pulsanti restano raggiungibili e nessuna pagina scorre in orizzontale.

## Sul progetto vero (DEEM)

Gli stessi passi da 3 a 8 valgono su un progetto già collegato: lancia `pnpm dev`, senza le variabili della demo, e scegli il progetto dal selettore. Conteggi e contenuti sono quelli del giorno: non confrontarli con numeri scritti qui, ma controlla che
- il numero di ogni filtro di «Oggi» e di ogni conteggio di «Cruscotto» sia quello delle righe elencate;
- un titolo lungo vada a capo dentro la sua riga e un commento lungo scorra dentro il suo riquadro;
- una risposta con molte citazioni si percorra con «‹» e «›», e il pannello dica quando lo stesso file è citato più volte.

Su un progetto vero «Fatto», «Rimanda» e «Non mi interessa» si annullano subito con «Annulla»; una nota su un bug e l'approvazione di un deliverable restano scritte. Per provare, usa un titolo che dica che è un collaudo e non approvare ciò che non deve uscire.

## Test e copertura

```bash
pnpm test:coverage
pnpm e2e
```
