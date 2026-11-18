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

`pnpm e2e` (il giro delle demo nella finestra vera) è stato riallineato il 18/11/2026 e arriva a «ok»: seguiva ancora le schermate di prima delle demo 55 e 56 e conteneva i passi di Avanzamento e Allineamento, tolti con R4 e provati ora da `pnpm e2e:script`. Quando un passo fallisce lascia la schermata in `.tmp/e2e/errore.png`.

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
| R4b.1 | Il PM corregge l'istruzione di un tipo in meno di 5 minuti, senza codice | Dal 18/11/2026 si corregge a parole anche il tipo di Octo (demo 67): «Deliverable» → un tipo → «Come Octo scrive questo tipo» → scrivi che cosa cambiare → leggi le istruzioni proposte → «Usa queste istruzioni». Con Claude vero, cronometra una correzione vera e la bozza successiva; guarda che la riscrittura non abbia toccato ciò che non hai chiesto | Meno di 5 minuti; la bozza successiva segue la correzione; il resto delle istruzioni è com'era. Provato solo con Claude finto | da fare |
| R4b.2 | Le bozze dei dieci tipi con Claude vero sono quelle di prima | Una bozza per due tipi che usi spesso, sul progetto vero | Nessuna differenza di struttura rispetto alle bozze di prima del 18/11. I dieci tipi letti dai file sono stati confrontati con le costanti del codice: dieci su dieci uguali, quindi le istruzioni che arrivano a Claude sono le stesse | da fare |
| R4b.3 | Il catalogo dentro l'app installata | Installa la build (`pnpm dist`) e apri «Deliverable» | I dieci tipi ci sono | da fare |

Non costruito: correggere a parole il tipo distribuito con l'app, per tutti i progetti. I file ora ci sono; manca chi li scrive al posto del PM e dove tenere la correzione fuori dall'app installata.

## R5 — Memoria: pagine scritte da Claude

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R5.1 | Le tre pagine sul progetto vero | «Deliverable» → «Memoria: fatti correnti», poi le altre due, con Claude vero; leggi, correggi a parole, approva | Tre pagine in `_octo/progetto/memoria/`, ognuna con fonti controllate e nessun fatto che sai sbagliato | da fare |
| R5.2 | Cinque domande che chiedono contesto ricevono risposte che citano le pagine | In «Chiedi», cinque domande del tipo «perché abbiamo deciso…», «da quando…», «a che punto siamo su…» | In almeno quattro su cinque la risposta cita una pagina di memoria fra le fonti, e la fonte della pagina regge | da fare |
| R5.3 | Il PM corregge una pagina a parole in meno di 5 minuti | Riscrivi una pagina chiedendo una correzione nel riquadro della revisione, poi approva | Meno di 5 minuti dalla richiesta alla pagina nuova nel progetto | da fare |
| R5.4 | Una pagina sbagliata non inquina | Lascia una riga superata in una pagina e fai una domanda su quel punto | La risposta va alla fonte e dice che pagina e fonte non coincidono | da fare |

Non costruito, per scelta della revisione: il controllo di doppioni e contraddizioni fra le pagine, i contratti di output con l'esempio validato, l'aggiornamento periodico da solo.

## R6 — Windows: WSL2

Tutto questo si prova sul PC del pilota, a PC preparato (WSL2 installato, Claude Code installato e con l'accesso fatto **dentro** la distribuzione). Sono i sette punti di §6.4 della revisione, più l'installatore.

| # | Che cosa provare | Come | Esito che chiude | Esito |
|---|---|---|---|---|
| R6.1 | WSL c'è ed è la versione 2 | In PowerShell: `wsl -l -v` | Una distribuzione con VERSION 2. Se il PC aziendale non permette di installarla, R6 è fallito e va scritto | da fare |
| R6.2 | Claude Code dentro la distribuzione, con il seat | Nella distribuzione: `claude --version`, poi `claude` e l'accesso | Risponde a una domanda. L'accesso fatto su Windows non vale lì | da fare |
| R6.3 | Octo trova WSL2 e offre «Con calcoli» | Installa Octo, apri «Chiedi» | La casella «Con calcoli» c'è. Se manca: `wsl -l -v` e `wsl -e sh -c 'PATH="$HOME/.local/bin:$PATH" command -v claude'` dicono che cosa non trova | da fare |
| R6.4 | Un calcolo dentro WSL2, con il progetto su disco Windows | «Con calcoli», una somma su un file del progetto | La tabella esce con la fonte; i file sono in `%APPDATA%\Octo\lavoro\…`; nel progetto niente | da fare |
| R6.5 | **La prova ostile dentro WSL2** | Nella distribuzione, in una copia del repository: `node apps/desktop/scripts/fetch-python.mjs linux-x64`, poi `pnpm test:recinto`. Poi la stessa con progetto e cartella di lavoro sotto `/mnt/c` (variabile `TMPDIR=/mnt/c/Temp`) | 2 test passati in tutti e due i casi. Se sotto `/mnt/c` una scrittura riesce, il recinto su Windows non regge per i progetti su disco Windows: fermarsi e dirlo | da fare |
| R6.5b | Da dentro il recinto non parte nessun programma di Windows e non si legge il profilo Windows | È nella stessa prova ostile: i tentativi `windows_program` (`cmd.exe`) e `windows_profile` (`/mnt/c/Users`) | Tutti e due falliti. Octo toglie `WSL_INTEROP` e le cartelle di Windows dal PATH e nega la lettura di `/mnt` e `/run/WSL` tranne progetto, cartella di lavoro e interprete, ma **questo non è mai stato provato su un WSL vero**: se `cmd.exe` parte, il recinto su Windows non regge e ci si ferma | da fare |
| R6.6 | Cartelle sincronizzate con OneDrive o SharePoint | Progetto in una cartella sincronizzata, con qualche file «solo online» | Chiedi e un calcolo funzionano; un file solo online viene scaricato o segnalato, non letto vuoto | da fare |
| R6.7 | L'interprete per Linux distribuito con l'installatore | Dopo l'installazione: `wsl -e "/mnt/c/…/Octo/resources/python-linux/bin/python3" -c "import openpyxl; print(1)"` | Stampa 1. Se i collegamenti del pacchetto si sono persi nell'installatore di Windows, `bin/python3` manca e va usato `bin/python3.13` | da fare |
| R6.8 | Antivirus aziendale sui processi avviati da WSL | Guardare se un calcolo viene bloccato o rallentato | Nessun blocco, o l'eccezione chiesta all'IT | da fare |
| R6.9 | Tre giorni di posta letta su Windows senza intervento | Non verificabile: il lettore non è costruito. Il pilota ha il nuovo Outlook, che non si legge dal PC | Serve la risposta dell'IT: vedi la sezione che segue e `docs/richiesta-it-posta.md` | bloccato |

Sul Mac è provato che i percorsi con spazi reggono (il comando e la regola portano le virgolette): la prova ostile gira in una cartella con uno spazio nel nome.

## R6 — la posta su Windows: che cosa si sa e che cosa manca

**Rilevato il 18/11/2026**: il pilota usa il **nuovo Outlook per Windows** (versione 1.2026.1103.200, client 20261106001.18, WebView2 157.0.4341.46). È l'applicazione costruita su WebView2, non l'Outlook classico (Win32).

Che cosa ne segue:

| # | Domanda | Risposta | Conseguenza |
|---|---|---|---|
| P1 | Outlook classico o nuovo | **Nuovo** | Non c'è un archivio locale in un formato documentato (niente file OST o PST) e non c'è l'automazione sul PC (COM, MAPI) su cui si appoggiava il classico. Le strade «leggere il file» e «chiedere a Outlook» sono chiuse |
| P2-P4 | Tipo di account, dove sta l'archivio, Outlook aperto | Non più pertinenti | Riguardavano il file OST |
| P5 | Che cosa permette l'azienda | **Aperta: è la richiesta all'IT** (`docs/richiesta-it-posta.md`) | Restano tre strade, tutte da far dire all'IT: permesso delegato `Mail.Read` di Microsoft Graph sull'app di accesso di Octo; Outlook classico sul PC del pilota; IMAP |
| P6 | Le cartelle del progetto in Outlook | Da guardare con il pilota | Le regole di Octo (parole chiave, indirizzi, cartelle) valgono come sul Mac qualunque sia la strada |

Deciso dal PM il 18/11/2026: **non si costruisce nulla finché l'IT non risponde.** La strada di Graph rimetterebbe in discussione una scelta scritta in `docs/identita-e-login.md` («all'IT si chiede la sola identità: nessun permesso su posta o calendario»): la si riapre solo con la risposta in mano.

Esito che chiude: la risposta dell'IT scritta qui, con la strada scelta. Solo allora si stima il lettore. Fino ad allora su Windows la posta non si legge, e con lei mancano le mail e le riunioni di «Oggi».

## R6c — Esiti della prova da zero

Ciò che il codice chiude e solo la prossima prova sul progetto reale può confermare. I rilievi sono in `docs/esiti-prova-deem.md`.

| # | Che cosa | Come | Esito atteso | Stato |
|---|---|---|---|---|
| R6c.1 | Una richiesta a Claude sopravvive al cambio di sezione (rilievi 4, 20) | In «Chiedi» una domanda lunga, poi «Commessa» e ritorno; lo stesso con una stima in «Deliverable» | Accanto alla sezione la rotella «Claude sta lavorando qui»; al rientro la risposta o la bozza ci sono | da fare |
| R6c.2 | «Sintesi» e «Fatturazione» si caricano su una commessa che parte da zero (rilievi 21, 22) | Stato dell'app vuoto, apri «Commessa» con il cronometro | La riga di attesa nomina il mese e il conto («mese 3 di 12»); alla fine le cifre. **Scrivere quanto dura**: sul progetto reale non è stato misurato, perché la lettura passa dalla credenziale di NetSuite. Se si ferma, la pagina dice perché e «Riprendi la lettura» chiede solo i mesi che mancano | da fare |
| R6c.3 | Il dettaglio di una voce di «Adesso» si apre sotto la voce (rilievi 8, 9) | Clic su una voce di «Adesso» | Il dettaglio compare sotto la riga; «Perché contano oggi» è chiuso all'apertura | da fare |
| R6c.4 | Dove va il tempo di una stima (rilievo 20) | Scrivi una stima vera; leggi accanto ai tempi «ultimo giro: scrittura … s, controllo delle fonti … s, rilettura critica … s» | La bozza si legge prima dei rilievi. **Scrivere i tre tempi**: dicono se la lentezza è di chi scrive o della rilettura, e se serve altro | da fare |
| R6c.5 | «Oggi» mostra solo ciò che tocca al PM (rilievi 7, 12) | Apri «Oggi» sul progetto reale | In «Il punto» e in «Da tenere d'occhio» restano le voci tue; quelle di altri sono dietro una riga di conteggio. **Dire se la regola taglia troppo o troppo poco**: un punto è tuo se non ha nome o ha il tuo; una conversazione non tocca a te se è rivolta a un altro, se ha già risposto un collega o se non chiede nulla | da fare |
| R6c.6 | Le riunioni si agganciano al progetto giusto (rilievi 7, 11) | Una settimana di calendario e di Verbale con i due progetti aperti | Nessuna riunione di un altro progetto in «Oggi»; le dubbie in «Da assegnare» con la frase di Claude. **Contare quante finiscono in «Da assegnare»**: se sono molte, la regola è troppo stretta. Serve che in «Persone e calendario» ci siano le persone del progetto: senza, Octo tiene tutte le riunioni come prima | da fare |
| R6c.7 | La notifica arriva quando una voce entra in «Adesso» (rilievo 6) | Build non firmata, Octo in secondo piano, una mail importante in arrivo | La notifica di macOS compare. Se no: Impostazioni di Sistema → Notifiche → Octo, e in «Impostazioni di «Oggi»» l'opzione è accesa (nasce accesa); se il permesso è negato Octo lo scrive sotto l'opzione | da fare |
| R6c.8 | L'email dà del tu a chi il PM dà del tu (rilievo 16) | Un'email a una persona a cui hai già scritto dandole del tu, senza toccare «Tu / lei»; poi con «Tu / lei» fissato | Nel primo caso Claude segue le tue mail già mandate (è un'istruzione: **dire se la rispetta**); nel secondo segue il campo, sempre | da fare |
| R6c.9 | Rilettura critica breve e correggibile un rilievo alla volta (rilievi 17-19) | Una bozza vera con almeno due rilievi; «Correggi questo» su uno | Rilievi di una frase; dopo la correzione cambia solo quel passo (**confrontare il resto del testo**: è Claude a doverlo lasciare com'è); il campo generale è precompilato | da fare |
| R6c.10 | Un verbale entra da solo nel progetto giusto con la regola nuova | Verbali di una settimana | Un verbale entra quando un solo progetto ha una sua persona fra i partecipanti. **Guardare se entra qualcosa che non c'entra** (una riunione su altro a cui partecipa una persona del progetto): si toglie da «Riunioni» → «Sposta», e se succede spesso la regola va stretta | da fare |
