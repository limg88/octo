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

Correzione emersa e non fatta: **`pnpm e2e` (il giro delle demo 01-59 nella finestra vera) è fermo da prima di R1.** Lo script non segue più le revisioni delle schermate (demo 55 e 56): si ferma su pulsanti che ora stanno nel modulo aperto di una fonte. Ho corretto i primi due punti (lettura di una fonte, posto di «Ore» e «Previsionale»); il passo successivo che fallisce è «Riempi la memoria ora». Gli incrementi di questo giro sono provati nella finestra vera con script brevi (`pnpm e2e:commessa`, `pnpm e2e:riunioni`). Esito che chiude: `pnpm e2e` arriva a «ok».

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
