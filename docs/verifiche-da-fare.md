# Verifiche da fare

Ciò che il codice non può chiudere da solo: serve il PM, il pilota, il suo PC Windows, i sistemi veri o giorni di calendario. Per ogni voce: che cosa provare, con quale comando o gesto, quale esito chiude il criterio. Finché una voce è aperta, l'incremento in `docs/roadmap.md` risulta «codice chiuso, criterio da verificare».

Regola per i dati: nessun nome, cifra o testo dei clienti entra nel repository. L'esito si scrive qui come «raggiunto» o «fallito, con il perché», senza importi.

## R1 — Economia a riepilogo

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R1.1 | Le cifre del riepilogo coincidono con NetSuite, per ogni commessa dei due progetti reali | In Octo: «Commessa» → «Sintesi», una commessa per volta. Confronta Ordinato, Fatturato, Ricavi riconosciuti e i costi per gruppo di «Costi secondo NetSuite» con la scheda progetto o con NetSuite | Per ogni commessa le quattro cifre coincidono al centesimo; dove «Costi a oggi» si scosta da NetSuite la pagina lo dice e lo scarto ha una spiegazione (ore non ancora in NetSuite, persone senza timesheet) | da fare |
| R1.2 | La vista dell'avanzamento di NetSuite è popolata per le commesse a corpo | In «Sintesi» di ogni commessa a corpo guarda la nota sotto «Avanzamento» | «da NetSuite, al …»: la vista è popolata. «da NetSuite: ricavi riconosciuti sull'ordinato»: la vista è vuota e vale il secondo passo; va scritto qui per quali commesse | da fare |
| R1.3 | L'avanzamento di NetSuite è una quota (0,4) o una percentuale (40) | Confronta la cifra di «Avanzamento» con quella della scheda progetto | Coincidono. Octo legge fino a 1 come quota e fino a 100 come percentuale: se NetSuite scrive «1» per dire 1%, la lettura è sbagliata e va corretta in `packages/connectors/src/dwsi/connector.ts` (`progressOf`) | da fare |
| R1.4 | Ogni quanto NetSuite aggiorna l'avanzamento | Guarda la data nella nota («al …») in due giorni diversi, o chiedi all'amministrazione | La frequenza è scritta qui | da fare |
| R1.5 | Il previsionale di un mese vero esce in Excel | «Commessa» → «Previsionale», scegli un mese chiuso, «Compila il modello» | Il file compilato si apre in Excel senza errori e le righe delle commesse hanno le cifre della pagina | da fare |
| R1.6 | Il piano tenuto dalla versione precedente è stato esportato, e il previsionale dà le cifre di prima | Apri «Commessa» sui due progetti reali, poi guarda `_octo/.riservato/commessa/piano-esportato.md` e, in «Previsionale», «Tariffe e costi che NetSuite non dice» | Il file c'è e contiene budget, mesi, fatture previste e anagrafica che avevi scritto; le tariffe del budget sono nella tabella; i ricavi del mese sono quelli di prima | da fare |

Non raggiunto e già misurato: **interfaccia sotto 18.700 righe**. Alla chiusura di R1 sono 18.857 (vedi «Stato» in `docs/roadmap.md`).

## R2 — Verifica di T0 su ciò che resta

Scheda dei criteri di uscita (tabella di §4 di `docs/revisione-roadmap.md`). Ogni riga va chiusa con «raggiunto» o «fallito, con il perché» e la data. Dove serve un registro, tienilo fuori dal repository (contiene domande e nomi del progetto) e riporta qui solo l'esito.

| # | Criterio | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|---|
| R2.1 | F1 — domande dall'app | Le cinque domande di F1 ripetute ora che la posta è nella cartella | In «Chiedi», sul progetto pilota, le stesse cinque domande del confronto del 14/11; per ognuna annota se la risposta è alla pari, meglio o peggio della Suite v0 e se le fonti risultano controllate | Cinque esiti scritti. Raggiunto se nessuna è peggio di v0 per ciò che viene dalla posta | da fare |
| R2.2 | F2 — tre giorni senza alimentare a mano | Tre giorni lavorativi di fila in cui posta, tracker e NetSuite si leggono da soli | Tieni Octo aperto; ogni sera guarda «Impostazioni» → «Collegamenti»: ogni fonte ha «Ultima lettura» del giorno e nessun avviso. Scrivi qui le tre date | Tre date consecutive senza alcun gesto di alimentazione (nessun «Leggi ora», nessuna esportazione copiata) | da fare |
| R2.3 | F4 — due deliverable reali | Due deliverable reali approvati **e inviati**, con tempi e giri | «Deliverable» → registro (`_octo/deliverable/registro.md`): due righe con minuti di bozza, giri e minuti di revisione; conferma tu che sono partiti | Due righe nel registro e la conferma dell'invio. Il primo (uno stato di avanzamento) risulta già approvato: manca sapere se è stato inviato, e il secondo | da fare |
| R2.4 | F1 — installazione e seat sul PC del pilota | A PC preparato (WSL2 e Claude Code con accesso dentro la distribuzione, fatti da qualcun altro), il pilota installa Octo e in basso a sinistra legge la versione di Claude | Installatore Windows dall'ultima build di CI (`installers.yml`); cronometro dal doppio clic alla prima risposta citata | Octo si apre, trova il seat, risponde a una domanda con una fonte controllata. Tempo scritto qui | da fare |
| R2.5 | F3 — il pilota collega un progetto in meno di 30 minuti, senza aiuto | Nella stessa sessione: «Aggiungi un progetto» → «Avvio del progetto» fino a «Riempi la memoria ora» | Non intervenire; annota dove si ferma o chiede | Meno di 30 minuti e nessun aiuto. Altrimenti «fallito», con il punto in cui si è fermato | da fare |
| R2.6 | F2 — quale Outlook ha il pilota | Nella stessa sessione rileva il programma di posta | Vedi la sezione «R6 — che cosa serve sapere sulla posta di Windows» qui sotto | Le risposte sono scritte lì: da quelle dipende se e come si costruisce il lettore | da fare |
| R2.7 | T1 — le riunioni entrano senza intervento | Due settimane di riunioni vere con l'assegnazione automatica della demo 61 | Prima scrivi le persone dei progetti in «Impostazioni» → «Persone e calendario». Per due settimane conta: riunioni registrate, entrate da sole nel progetto giusto, entrate nel progetto sbagliato, rimaste da assegnare | Nessuna nel progetto sbagliato, e almeno nove su dieci entrate da sole (metrica dei 90 giorni). Se una finisce nel progetto sbagliato: «fallito», con chi c'era | da fare |
| R2.8 | F5 — la Suite v0 non serve più; la collega produce un deliverable reale | Non verificabile prima di R4 | Vedi R4 | — | rimandato a R4 |
| R2.9 | T1 — due persone sullo stesso progetto su SharePoint | Fuori da questo giro | R7 | — | rimandato a R7 |

Correzione emersa e non fatta: **`pnpm e2e` (il giro delle demo 01-59 nella finestra vera) è fermo da prima di R1.** Lo script non segue più le revisioni delle schermate (demo 55 e 56): si ferma su pulsanti che ora stanno nel modulo aperto di una fonte. Ho corretto i primi due punti (lettura di una fonte, posto di «Ore» e «Previsionale»); il passo successivo che fallisce è «Riempi la memoria ora». Dopo R4 lo script contiene anche i passi delle demo 10, 13 e 54, che non esistono più: vanno tolti quando lo si riallinea. Gli incrementi di questo giro sono provati nella finestra vera con script brevi (`pnpm e2e:commessa`, `pnpm e2e:riunioni`). Esito che chiude: `pnpm e2e` arriva a «ok».

## R3 — Recinto sul Mac

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R3.1 | Un'analisi con calcoli scelta fra quelle del vault, rifatta con le stesse cifre | Scegli un'analisi del vault di cui hai le cifre. In «Chiedi», sul progetto vero, spunta «Con calcoli» e fai la stessa richiesta | Le cifre della tabella coincidono con quelle dell'analisi originale, e sotto la tabella ci sono i file giusti. Scrivi qui solo «raggiunto» o lo scarto in parole | da fare |
| R3.2 | La prova ostile sul tuo Mac, dopo ogni aggiornamento di Claude Code | `pnpm test:recinto` | 2 test passati. Passata il 18/11/2026 con Claude Code 2.1.327 su macOS (arm64); va rifatta a ogni aggiornamento, perché la sandbox è di Claude Code | raggiunto il 18/11/2026, da ripetere |
| R3.3 | L'interprete dentro l'app installata | Installa la build (`pnpm dist`), apri «Chiedi»: la casella «Con calcoli» c'è e una domanda con calcoli risponde | La casella c'è e il calcolo riesce. Nello sviluppo è provato; nell'app firmata e installata no (l'interprete va firmato con l'app) | da fare |
| R3.4 | Processore Intel | Come R3.3 su un Mac Intel, se ce n'è uno | Il calcolo riesce | da fare |

## R4 — Deliverable del progetto con script e modello

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R4.1 | Il modulo di una richiesta reale esce come deliverable del progetto | Sul progetto vero: «Deliverable» → «Deliverable del progetto, con script» → «Aggiungi al progetto» sul modulo di avanzamento; scrivi il numero della richiesta; «Esegui» con Claude vero; «Salva nel progetto» | Il file Excel salvato in `_octo/deliverable/avanzamento/` è uguale a quello che avevi prodotto con la sezione per la stessa richiesta (percentuali, intestazione, logo e celle unite) | da fare |
| R4.2 | L'elenco dei ticket mancanti dello sprint in corso | Come sopra con «Allineamento dello sprint» | `mancanti_<sprint>.csv` si importa nel tracker interno senza errori e le tre liste di `allineamento.md` sono quelle che ti aspetti | da fare |
| R4.3 | Una correzione a parole diventa regola | «Correggi a parole»: aggiungi una richiesta nuova al modulo di avanzamento dettandone i dati; leggi i file cambiati; «Approva la correzione»; «Esegui» | Meno di 5 minuti dal dettato al modulo della richiesta nuova, senza toccare un file a mano | da fare |
| R4.4 | La collega produce un deliverable reale (criterio di F5) | Sul suo computer, a recinto disponibile (su Windows dopo R6) | Un deliverable reale prodotto da lei senza aiuto | da fare |
| R4.5 | La Suite v0 non serve più per il lavoro quotidiano (criterio di F5) | Una settimana di lavoro annotando ogni volta che apri v0 e perché | Nessuna apertura di v0, oppure l'elenco di ciò che manca | da fare |

Uscito con le due sezioni e non rifatto: il confronto fra richieste e fatture di NetSuite, i titoli simili proposti fra voci senza ticket e ticket senza riferimento, il segnale dell'allineamento in «Oggi» a fine sprint. Se uno di questi ti serve, si aggiunge allo script a parole (R4.3) o si chiede.

## R4b — Catalogo in file

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R4b.1 | Il PM corregge l'istruzione di un tipo in meno di 5 minuti, senza codice | Oggi la via a parole è per progetto: «Deliverable» → un tipo → «Istruzioni per questo progetto». Cronometra una correzione vera e la bozza successiva | Meno di 5 minuti, e la bozza successiva la rispetta | da fare |
| R4b.2 | Le bozze dei dieci tipi con Claude vero sono quelle di prima | Una bozza per due tipi che usi spesso, sul progetto vero | Nessuna differenza di struttura rispetto alle bozze di prima del 18/11. I dieci tipi letti dai file sono stati confrontati con le costanti del codice: dieci su dieci uguali, quindi le istruzioni che arrivano a Claude sono le stesse | da fare |
| R4b.3 | Il catalogo dentro l'app installata | Installa la build (`pnpm dist`) e apri «Deliverable» | I dieci tipi ci sono | da fare |

Non costruito: correggere a parole il tipo distribuito con l'app, per tutti i progetti. I file ora ci sono; manca chi li scrive al posto del PM e dove tenere la correzione fuori dall'app installata.

## R6 — che cosa serve sapere sulla posta di Windows

In `docs/` non è scritto quale Outlook ha il pilota (`docs/roadmap.md`, «Scelte prese durante F2 (posta)»: «Dipende da quale Outlook ha il pilota»). Il lettore della posta su Windows non si costruisce alla cieca. Da rilevare nella sessione con il pilota (R2.6):

| # | Domanda | Come si vede | Che cosa ne segue |
|---|---|---|---|
| P1 | Outlook classico (Win32) o «nuovo Outlook» | In Outlook: File → Account di Office → «Informazioni su Outlook»; il nuovo Outlook ha l'interruttore «Nuovo Outlook» in alto a destra e non ha il menu File | Il classico tiene un archivio locale (file OST o PST) e si può interrogare sul PC; il nuovo non tiene un archivio leggibile: resta solo l'accesso con Microsoft Graph, che chiede un permesso all'IT |
| P2 | Tipo di account | File → Impostazioni account: Exchange/Microsoft 365, IMAP, altro | Con Exchange in modalità cache c'è un file OST; con IMAP anche |
| P3 | Dove sta l'archivio e quanto pesa | File → Impostazioni account → File di dati | Percorso e dimensione del file OST o PST; se è su un disco sincronizzato |
| P4 | Outlook è aperto mentre si lavora | Chiedere | Il file OST è bloccato finché Outlook è aperto: un lettore del file non funziona, serve chiedere i messaggi a Outlook stesso |
| P5 | Che cosa permette il PC aziendale | Chiedere all'IT o provare: esecuzione di PowerShell, automazione di Outlook (COM), registrazione di un'app per Graph | Decide fra le tre strade: automazione di Outlook sul PC, lettura del file, Graph |
| P6 | Le cartelle del progetto in Outlook | Guardare l'albero delle cartelle | Le regole di Octo (parole chiave, indirizzi, cartelle) valgono come sul Mac |

Esito che chiude: le sei risposte scritte qui. Solo allora si sceglie la strada e si stima il lettore.
