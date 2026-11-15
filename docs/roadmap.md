# Roadmap e decisioni

## Da dove viene Octo (14/11/2026)

Revisione delle quattro versioni precedenti:
- **Suite v0** (skill di Claude Code su un vault di progetto): l'unica in uso reale, anche da altri PM tecnici.
- **octobrief**, **octobrief-next**, **octobrief-new**: web app con motore proprio. Nessuna ha avuto un utente oltre a Giovanni; sul lavoro vero risultano meno utili di v0 (risposte più povere, deliverable più rigidi, correzioni più lente, memoria incompleta, configurazione faticosa).

Conclusione: la versione definitiva è il motore di v0 (Claude che legge liberamente la cartella del progetto) con in più l'alimentazione automatica, la configurazione guidata e un'interfaccia per chi non usa il terminale.

## Decisioni

| Tema | Decisione |
|---|---|
| Forma | app desktop installabile, Windows e Mac (Electron) |
| Modello | Claude Code sul seat di ciascun PM, sul suo computer |
| Memoria | la cartella del progetto è la fonte di verità; lo stato dell'app sta a parte |
| Controlli | il modello propone, il codice controlla dopo: ciò che non è verificato viene marcato, non tolto |
| Fonti di T0 | posta e file locali, Azure DevOps, Jira, NetSuite/DWSI |
| Teams | in T1, tramite l'app «Verbale» |
| Pseudonimizzazione | tolta (era una scelta prudenziale, non un obbligo) |
| Server | solo dopo T0, e solo per la memoria distillata (cruscotti e analisi fra progetti) |
| Parole | «deliverable» e «istruzioni»; il termine «ricette» non si usa |
| Manutenzione | una persona: codice nuovo sotto le 15.000 righe |
| Repository | privato; nessun dato di clienti, demo su dati sintetici |

## T0 — MVP a fette

Ogni fetta finisce con qualcosa di usabile su un progetto reale. La successiva parte solo se il criterio di uscita è raggiunto.

| Fetta | Contenuto | Criterio di uscita |
|---|---|---|
| **F1. App e Chiedi** | installatore Mac e Windows; un progetto è una cartella; Chiedi con citazioni controllate | domande su DEEM dall'app, sul vault v0; l'app si installa e trova il seat sul PC Windows del pilota |
| **F2. Alimentazione** | posta e file locali, ADO, Jira, DWSI; lettura periodica; pagina Fonti con freschezza | tre giorni senza alimentare DEEM a mano; posta e file letti anche su Windows |
| **F3. Configurazione guidata** | nuovo progetto: l'app propone cartelle, progetti ADO/Jira e codici PRJ; primo riempimento automatico | il pilota collega un suo progetto in meno di 30 minuti, senza aiuto |
| **F4. Deliverable** | catalogo dentro l'app (email al cliente, stato avanzamento, verbale, stima); bozza in Markdown scritta da Claude nella cartella di lavoro; controlli del codice e red-team; revisione a parole; approvazione; esportazione in Word; registro dei tempi e dei giri | due deliverable reali del ciclo escono da Octo, con il tempo di correzione registrato |
| **F5. Deliverable del progetto** | deliverable definiti nel progetto (modelli e istruzioni propri, come il modulo economico o la dashboard); connettori del PM in Chiedi; cartella di un progetto nuovo creata da un modello | la Suite v0 non serve più per il lavoro quotidiano; la collega produce un deliverable reale |

## Dopo T0

| Tappa | Contenuto | Criterio di uscita |
|---|---|---|
| **T1** | integrazione con «Verbale» per Teams; verbali; condivisione della cartella su SharePoint | due persone sullo stesso progetto; le riunioni entrano senza intervento |
| **T2** | cruscotto economico; server del distillato | i numeri coincidono con NetSuite; una domanda su 3 progetti con risposta citata |
| **T3** | aggiornamento automatico; 3-5 PM | metriche dei 90 giorni raggiunte |

## Metriche dei primi 90 giorni
- deliverable reali prodotti a settimana per PM;
- almeno il 90% degli elementi entra in memoria senza intervento;
- da installazione a prima risposta citata in meno di 30 minuti, senza aiuto;
- correggere un'istruzione in meno di 5 minuti, senza codice;
- almeno il 95% delle citazioni controllate.

## Stato

| Fetta | Stato |
|---|---|
| F1 | codice chiuso il 14/11/2026, demo `demo/01-app-e-chiedi`. Provata su DEEM con cinque domande reali a confronto con la Suite v0: alla pari o meglio sul contenuto della cartella, indietro su tutto ciò che viene dalla posta. Da verificare sul PC Windows del pilota |
| F2 | in corso. Posta da Mail su Mac: fatta il 14/11/2026, demo `demo/02-posta`. Documenti Office e PDF convertiti in testo: fatti il 14/11/2026, demo `demo/03-documenti`. Azure DevOps, Jira e NetSuite/DWSI: fatti il 14/11/2026, demo `demo/04-sistemi`. Resta: posta su Windows. Criterio di uscita (tre giorni senza alimentare DEEM a mano) da verificare sui sistemi reali |
| F3 | codice chiuso il 14/11/2026, demo `demo/05-avvio-guidato`. Criterio di uscita (il pilota collega un suo progetto in meno di 30 minuti, senza aiuto) da verificare con il pilota |
| F4 | codice chiuso il 14/11/2026: catalogo (email al cliente, stato di avanzamento, verbale, stima), bozza con fonti controllate, rilettura critica, modifica a parole, approvazione, Markdown e Word, tempi e giri; demo `demo/06-deliverable`. Aggiunti stima, registro e carta intestata. Criterio di uscita da verificare su due deliverable reali |
| F5 | in corso. Fatti il 14/11/2026: tipi di deliverable definiti dal PM a parole. Non fattibile oggi: i connettori del PM dentro Chiedi (vedi sotto). Fatti poi: Excel e PowerPoint su modello (previsionale, modulo di avanzamento, presentazione: demo 09, 10, 11) e la cartella di un progetto nuovo creata da Octo con un posto per contratti, documenti, riunioni e tracker (demo 14). Restano le prove su un progetto vero |

## Scelte prese durante F1
- **Claude in modalità ristretta** (`--restricted --strict-mcp-config`), con i soli strumenti Read, Grep e Glob:
  - non legge fuori dalla cartella del progetto;
  - non usa connettori;
  - non carica impostazioni, hook o plugin del computer né della cartella. Una cartella condivisa non può quindi far eseguire codice.
- **Le regole del progetto vincolano la risposta**: in modalità ristretta Claude ignora il `CLAUDE.md` della cartella, quindi Octo lo legge e lo passa nel prompt come regole del PM (per esempio: niente numeri da uno snapshot più vecchio di 72 ore). Le parti su strumenti e skill non disponibili vengono ignorate; l'esecuzione resta di sola lettura qualunque cosa dicano.
- **File grandi e export JSON** (trovato sulla prima prova con DEEM, 14/11): un file citato fino a 200 MB viene aperto; oltre è marcato «troppo grande», non «non trovato». Una frase vale anche se il file scrive i caratteri come `\uXXXX`.
- **Modello** (demo 17): per progetto si sceglie il modello delle risposte, quello della scrittura dei deliverable e quello della rilettura critica, fra le famiglie che Claude Code conosce; senza scelta vale il predefinito di Claude Code del PM, come in v0. Il modello che ha lavorato resta scritto accanto a ogni risposta e a ogni deliverable. Provato con Claude vero: predefinito e modello scelto sono rispettati. Una domanda banale costa poco in quota, ma il primo avvio carica un contesto ampio.
- **Variabili di un'altra sessione Claude** (`ANTHROPIC_*`, `CLAUDE*`) tolte dall'ambiente del processo: vale sempre l'accesso del PM.
- **La domanda viaggia sullo standard input**: nessun problema di virgolette su Windows.
- **Citazioni**: una frase vale come prova se è lunga almeno 12 caratteri e si trova nel file, ignorando a capo e spazi ripetuti. Un file citato si apre solo se il suo percorso reale sta nella cartella del progetto.
- **Stato dell'app** (elenco dei progetti, stato delle letture) in file JSON nella cartella dati dell'utente. Lo storico delle domande sta nella cartella del progetto (`_octo/.cronologia/`), fuori dalle fonti citabili, così segue il progetto.
- **Sprint e stima dei ticket Jira**: ogni sito chiama a modo suo i campi dello sprint e della stima; Octo li scopre dall'elenco dei campi del sito quando si collega, senza che il PM li conosca. Senza, ogni ticket risultava senza sprint e l'allineamento non poteva dire quali ticket sono nello sprint. Le fonti Jira già collegate si rileggono da capo una volta.
- **Previsionale: costi da NetSuite, tariffe per commessa, esterni** (demo 09): i costi interni sono la somma del costo che NetSuite scrive su ogni riga di timesheet approvata; in app si scrivono solo le tariffe, per persona o per persona e commessa (quella della commessa vince); degli esterni si scrivono una volta costo e tariffa per commessa e ogni mese le ore. Il costo delle righe letto da NetSuite sta in `_octo/.riservato/`, a parte dalle ore: quella cartella, le impostazioni e la cronologia non sono cercate né citabili.
- **Timesheet da NetSuite** (demo 08, passo 10): in «Ore», «Leggi i timesheet da NetSuite» legge dal data warehouse, con l'utente di sola lettura della fonte, le ore delle commesse per i mesi del periodo e le scrive in `_octo/ore/netsuite/`, un file per mese; il confronto e il previsionale partono da lì. Mai il costo orario. Provato contro un database di prova, non contro il warehouse vero.
- **Cruscotto da Azure DevOps** (demo 16): «Leggi da Azure DevOps» legge con il Personal Access Token della fonte tutti i work item del progetto e delle aree, e per i bug i cambi di stato e i commenti; li scrive in `_octo/cruscotto/` nel formato dell'esportazione e punta lì il cruscotto. Sola lettura. Non provato su un'organizzazione vera: se l'accesso è limitato ai dispositivi aziendali, il token può essere rifiutato da questo computer.
- **Cambio di computer** (demo 15): «Copia di sicurezza» scrive in un file l'elenco dei progetti e lo stato delle letture, mai le credenziali; «Ripristina» li rimette su un altro computer, chiede dove sono le cartelle che non trova e non tocca i progetti già in elenco. La cartella del progetto va tenuta in un posto copiato altrove: la copia di sicurezza non la contiene.
- **Interfaccia isolata**: nessun accesso a Node, un solo ponte con richieste validate; ogni errore arriva come codice e l'interfaccia lo spiega a parole.
- **Versioni delle dipendenze**: solo rilasci pubblicati da almeno 14 giorni.
- **Non verificato**: installatore e avvio su Windows; il percorso di Claude Code su Windows è cercato solo nell'installazione nativa (`%USERPROFILE%\.local\bin\claude.exe`), altrimenti sul PATH.

## Scelte prese durante F2 (posta)
- **Si parte dalla posta**: nel confronto con v0 quasi tutte le azioni richieste al PM venivano da mail della settimana, che Octo non vedeva.
- **Lettore portato da octobrief-new** (`addons/sync`): legge l'archivio che Mail tiene sul Mac (indice e un file per messaggio), senza chiedere nulla a Mail e senza scrivere. Nessun modello è coinvolto.
- **Quali mail entrano lo decide il codice**: parole chiave cercate come parole intere, indirizzi o `@dominio`, cartelle di posta, mittenti esclusi. Fuori sempre bozze, cestino, indesiderata e le risposte agli inviti.
- **Una mail è un file Markdown** nella cartella del progetto, sotto `<cartella>/<anno-mese>/`, con giorno, ora e oggetto nel nome. In testa mittente, destinatari, data, cartella di posta e allegati (solo i nomi). Il testo è quello scritto dall'autore: i messaggi citati sotto si tolgono, salvo scelta contraria.
- **Dove va la posta**: Octo propone `raw/Mail` se la cartella ha già `raw/` (vault della Suite), altrimenti `Posta`.
- **Le regole stanno nel progetto** (`.octo/sources.json`), così viaggiano con la cartella. Cursore ed esito dell'ultima lettura stanno sul computer.
- **Lettura**: su richiesta e ogni 15 minuti ad app aperta. Riparte da due giorni prima dell'ultima, perché una mail può arrivare in archivio dopo quelle successive; ciò che è già scritto risulta «già presente». Cambiare le regole fa ripartire dal giorno di inizio.
- **Freschezza**: la pagina Fonti mostra l'ultima lettura e avvisa dopo un giorno senza letture o se l'ultima è fallita.
- **Permesso su macOS**: leggere `~/Library/Mail` richiede «Accesso completo al disco» per Octo. Se manca, la pagina lo dice.
- **Windows**: nessun lettore ancora; la pagina dice che la posta non è disponibile. Dipende da quale Outlook ha il pilota.
- **Non verificato**: la lettura della posta reale (fatta solo su archivio finto, anche nella finestra vera).

## Scelte prese durante F2 (documenti)
- **Perché**: nel confronto con v0 due file Excel del vault erano invisibili a Chiedi, perché Claude in sola lettura apre solo testo.
- **Estrazione portata da octobrief-new** (`packages/infrastructure/src/extract`): Word, Excel, PowerPoint (anche con macro) e PDF. Il formato si decide dall'estensione del file.
- **Il testo sta accanto, non al posto**: per ogni file `percorso/file.ext` Octo scrive `_octo/testo/percorso/file.ext.md`. Gli originali non vengono toccati. La cartella non è nascosta, perché la ricerca di Claude salta le cartelle nascoste.
- **Forma del testo**: in testa il file di origine, la sua data e dimensione e gli avvisi (file protetto, troncato, formato non letto); sotto, il testo diviso per pagina, slide o foglio. Le righe di un foglio sono `valore | valore`.
- **Solo ciò che cambia**: un file già convertito e non modificato (stessa data e dimensione, stesso estrattore) non viene riletto. Il testo di un file eliminato viene tolto.
- **Quando**: su richiesta («Converti ora») e ogni 15 minuti ad app aperta, dopo la posta. Nessuna configurazione.
- **Un thread per file**, con 60 secondi di tempo: un foglio enorme non blocca l'app e un file che manda in stallo il lettore viene abbandonato con l'avviso `timeout`. Restano i limiti di octobrief-new contro i file gonfiati (100 MB decompressi, 12 MB di testo).
- **Fuori**: file oltre 100 MB, cartelle nascoste, `node_modules`, i file di blocco di Office (`~$…`), i link.
- **Claude lo sa**: il prompt di Chiedi dice dove sta il testo e di citare quel file.
- **Non portato**: l'isolamento in un processo separato con limite di memoria. Su un server multiutente serviva; qui i file sono quelli del PM. Da rivedere quando la cartella sarà condivisa fra più persone.
- **Non verificato**: la conversione su un vault reale (numero e peso dei file di DEEM).

## Scelte prese durante F2 (Azure DevOps, Jira, NetSuite/DWSI)
- **Connettori portati per intero da octobrief-new** (`packages/connectors`, con i loro 355 test): sola lettura, chiamate HTTP solo verso i percorsi ammessi, nessun redirect, warehouse letto con un utente che non può scrivere. Non conoscono il resto di Octo: dipendono solo dal dominio.
- **Tutto gira sul computer del PM**, con la sua credenziale nominativa. Nessun server, nessuna richiesta all'IT.
- **La credenziale non sta nella cartella del progetto**: è cifrata dall'archivio del sistema operativo (Portachiavi su Mac, DPAPI su Windows) in un file dei dati dell'app. Una volta salvata non torna più a schermo. Senza archivio sicuro, Octo non la salva.
- **«Prova e salva»**: nulla viene salvato finché il sistema non accetta la credenziale per ciò che è stato indicato. Un token sbagliato, un progetto che non esiste e una credenziale che può scrivere danno ciascuno il suo messaggio.
- **Un elemento, un file**: ogni work item o issue è un file Markdown (titolo, campi, descrizione, commenti); ogni vista del warehouse è un file per commessa, con tutte le righe. Il formato è quello dell'incremento 8a di octobrief-new.
- **Dove**: Octo propone `raw/ADO`, `raw/Jira`, `raw/NetSuite` se la cartella ha già `raw/`, altrimenti `Fonti/…`.
- **Nota sull'età dei dati**: ogni fonte tiene nella sua cartella `_lettura.md` con la data della lettura, fino a quando arrivano i dati e quanti elementi ci sono. Il prompt di Chiedi dice a Claude di citarla. Sostituisce il `_freshness.json` che in v0 si pubblicava a mano.
- **Lettura incrementale**: i tracker ripartono dall'ultimo punto letto; il warehouse non ha un cursore e si rilegge intero, ma si riscrive solo ciò che cambia. Il punto raggiunto si salva a ogni passo: una lettura interrotta riprende da lì.
- **Cambiare cosa si legge** (altro progetto, altre aree, altri codici) toglie i file della fonte e riparte: non restano elementi fuori perimetro.
- **Warehouse**: ore dal giorno di inizio; ordini, fatture e ricavi sempre interi, perché residui e totali ne hanno bisogno. Il server si indica per nome, non per indirizzo. La sicurezza della connessione la dichiara il PM (cifrata e verificata, cifrata, non cifrata): quella più debole resta sul suo computer.
- **Quando**: «Leggi ora» e ogni 15 minuti ad app aperta, dopo la posta e prima dei documenti.
- **App impacchettata**: il client Postgres è una libreria CommonJS; il processo principale ha ora il suo `require`.
- **Test**: il warehouse finto è un Postgres vero (`pnpm db:setup`, porta 5460); dove non c'è, quei test restano fuori.
- **Non verificato**: Azure DevOps, Jira e DWSI reali. In octobrief-new il primo contatto con un ADO vero aveva richiesto due correzioni, già incluse nei connettori portati.
- **Aperto per F4**: le skill di v0 leggono lo snapshot ADO in un loro formato (`azdo_latest.json`). I deliverable di Octo dovranno leggere questi file, oppure Octo dovrà scrivere anche quello snapshot.

## Scelte prese durante F3 (configurazione guidata)
- **La guida è un pannello, non una procedura a passi obbligati**: «Avvio del progetto», in cima alla pagina Fonti, elenca posta, Azure DevOps, Jira, NetSuite e documenti come «fatto» o «da fare». Ogni passo è facoltativo e ci si torna quando si vuole. Su un progetto appena aggiunto la pagina si apre da sola.
- **Octo propone, il PM conferma**:
  - parole chiave della posta: il nome del progetto;
  - giorno di inizio: 30 giorni fa;
  - cartelle di destinazione: secondo come è fatta la cartella (`raw/…` oppure `Posta`, `Fonti/…`);
  - porta e sicurezza del warehouse: i valori più comuni.
- **Anteprima della posta**: prima di salvare, il PM vede quante mail entrerebbero con le regole scritte e gli oggetti delle cinque più recenti. Nulla viene scritto.
- **Scegliere invece di scrivere**: con organizzazione e token, «Cerca progetti e aree» elenca i progetti che il token vede; scelto il progetto, anche le sue aree. Un clic li mette nei campi. Per Jira elenca i progetti con la loro chiave.
- **NetSuite resta a mano**: il connettore legge solo le commesse che il PM dichiara e a cui è legato; non elenca le altre. È una protezione voluta, non una mancanza: i codici PRJ li scrive il PM.
- **Un solo pulsante**: «Riempi la memoria ora» legge posta, sistemi collegati e documenti, uno dopo l'altro, e dice l'esito di ciascuno man mano. Una fonte che fallisce non ferma le altre. È lo stesso caso d'uso della lettura periodica.
- **La guida segue ciò che cambia**: ogni salvataggio di una fonte avvisa l'interfaccia. Trovato dalla prova nella finestra vera: prima la guida si aggiornava solo alla lettura successiva.
- **Non fatto**: creare la cartella di un progetto nuovo da un modello (oggi il PM sceglie o crea la cartella dalla finestra di sistema); rilevare da soli organizzazione ADO o sito Jira.

## Lettura del vault reale (14/11/2026) e cosa cambia
Con il permesso del PM ho letto il vault su cui gira la Suite v0. Nessun contenuto del vault è riportato qui: solo ciò che cambia le scelte di Octo.

**Come lavora davvero v0**
- È Claude Code senza restrizioni: legge, scrive, esegue script, usa connettori in tempo reale. La posta non viene salvata: è letta al momento.
- I deliverable sono skill con script e file Office modificati dall'interno, contratti di output, esempi validati e un red-team obbligatorio. Quasi tutte le skill stanno nell'account del PM, non nella cartella.
- Il tracker del cliente non è raggiungibile dal PC del PM: un export da un'altra macchina produce uno snapshot unico, pubblicato una volta al giorno. Tutto legge quello.
- La cartella è un repository git condiviso fra due persone, con regole precise. `raw/` è la casella del PM: l'agente non ci scrive.
- Il lavoro è iterativo: lo stesso deliverable passa per 2-6 giri di revisione. L'errore più frequente è sul dato, non sul formato. I minuti di correzione non sono quasi mai stati annotati.

**Decisioni del PM (14/11)**
- Octo dev'essere indipendente: l'esperienza sta tutta dentro Octo, senza dipendere da skill dell'account né dal terminale.
- Octo resta fuori da git.
- Il pilota su Windows è la collega che lavora sullo stesso vault.

**Cosa ho cambiato subito**
- **Tutto ciò che Octo scrive sta sotto `_octo/`**: posta (`_octo/posta`), sistemi (`_octo/fonti/…`), testi estratti (`_octo/testo`), impostazioni (`_octo/.impostazioni`). Octo non propone più cartelle sotto `raw/`.
- **`_octo/` si esclude da git da sola** (un suo `.gitignore`), senza toccare i file del progetto.
- **La ricerca di Claude salta ciò che git ignora**: verificato, una cartella ignorata diventava invisibile a Chiedi. Un file `.ignore` nella stessa cartella la riammette alla ricerca e lascia git com'è.
- Chiedi legge per primo anche il manifest delle fonti, se il progetto ne ha uno.

**Conseguenza accettata**: su un vault condiviso via git, posta e testi estratti restano sul computer di chi li genera. Ogni persona alimenta la propria copia.

## Disegno di F4 (deliverable)
- **Catalogo dentro l'app**: ogni deliverable è una cartella (istruzioni, contratto di output, modello) distribuita con Octo. Punto di partenza: le skill generalizzate di `second-brain-starter` (stato avanzamento, email al cliente, stima, verbale).
- **Claude scrive solo nella cartella di lavoro**: verificato che, in modalità ristretta, gli si può permettere di scrivere in una sola sottocartella (`_octo/lavori/<id>/`) e in nessun altro posto, senza eseguire comandi.
- **Prima il Markdown, poi il file**: la bozza è Markdown, rivista dentro Octo; solo dopo l'approvazione Octo produce Word. È la regola che il vault si era già dato.
- **Niente script nel progetto e niente Python sul PC**: ciò che deve dare sempre lo stesso risultato (conti, controlli, impaginazione) lo fa il codice di Octo.
- **Controlli**: citazioni verificate come in Chiedi; red-team come seconda lettura indipendente, in sola lettura; dati interni fuori dai documenti per il cliente.
- **Revisione a parole, a giri**: ogni richiesta del PM è un giro; Octo li conta e misura i tempi.
- **Registro automatico**: per ogni deliverable, minuti di bozza, giri e minuti di revisione. È la misura del ritorno che a mano non veniva compilata.
- **Istruzioni del progetto**: il PM corregge a parole le istruzioni di un deliverable per il suo progetto; Octo le tiene in `_octo/deliverable/` e le applica ai cicli successivi.
- **Fuori da F4**: PowerPoint e Excel su modelli del cliente, e i deliverable specifici di un cliente (modulo economico, dashboard). Sono F5.

## Scelte prese durante F4 (deliverable)
- **Claude non scrive file**: restituisce il testo in un formato fisso (testo con richiami, citazioni, cose mancanti), come in Chiedi, e i file li scrive Octo. La prova di scrittura confinata in una cartella era riuscita, ma così non serve nessun permesso di scrittura.
- **Tre letture per ogni bozza**: lo scrittore; il codice, che apre ogni file citato e cerca la frase; la rilettura critica, in un'esecuzione separata che non vede come la bozza è stata scritta. Provato con Claude vero su un progetto sintetico: bozza in 96 secondi, tutte le fonti controllate, rilettura che trova un'incoerenza reale fra due frasi.
- **La rilettura critica non blocca l'approvazione**: dice «può uscire» o «da correggere prima» con i suoi rilievi; decide il PM. È un contraddittorio, non un cancello.
- **Modifica a parole**: lo scrittore riceve la bozza in revisione e la richiesta, e restituisce la bozza intera. Se la modifica fallisce, la bozza resta com'era.
- **Ciò che esce non ha i richiami alle fonti**: servono al PM; nel file approvato spariscono.
- **Approvare scrive due file** sotto `_octo/deliverable/approvati/`: Markdown e Word. Il Word lo produce il codice (titoli, paragrafi, elenchi, tabelle): lo stesso testo dà sempre lo stesso documento. Non è ancora sulla carta intestata.
- **Tempi e giri misurati da Octo**: minuti di scrittura, minuti di revisione e numero di giri per ogni deliverable. Una pausa oltre 20 minuti non conta come revisione.
- **Istruzioni del progetto**: per ogni tipo di deliverable il PM può aggiungere istruzioni che valgono per quel progetto. Raffinano quelle del catalogo; non possono autorizzare ciò che non deve mai arrivare a un cliente.
- **Le regole del progetto valgono anche qui**: il `CLAUDE.md` della cartella vincola lo scrittore come vincola Chiedi.
- **Il catalogo è codice di Octo**: tre tipi, ciascuno con campi da chiedere, istruzioni ed elenco di controllo. Riprendono le skill generalizzate di `second-brain-starter`.
- **Le carte di Octo stanno in cartelle nascoste** (`_octo/.lavori`, `_octo/.impostazioni`, `_octo/.istruzioni`): nella prova reale lo scrittore aveva letto anche le bozze in corso e le impostazioni come se fossero fonti. La ricerca di Claude salta le cartelle nascoste.
- **Stima** (quarto tipo): Claude propone le righe (attività, da che cosa dipende lo sforzo con la sua fonte, tre valori, stato dell'informazione); totali, intervallo all'80% e tabelle per fase e ruolo li calcola il codice con il PERT a tre punti dello starter. Una riga impossibile resta fuori dal totale e viene detta, mai corretta di nascosto. Provata con Claude vero: 29,6 giornate con intervallo, e la rilettura critica ha dato 12 rilievi.
- **Registro**: una pagina nella scheda e il file `_octo/deliverable/registro.md`, aggiornato a ogni approvazione.
- **Bozza formattata**: titoli, tabelle e a capo sono resi come tali (tabelle in stile GitHub, a capo semplice rispettato): un'email tiene le sue righe, una stima le sue tabelle.
- **Limite d'uso riconosciuto**: quando il seat del PM ha finito la quota, Octo lo dice con parole sue invece di «Claude non ha risposto». Trovato perché la prima stima reale era caduta proprio per questo.
- **Carta intestata**: il PM sceglie una volta un documento Word; Octo ne tiene una copia nel progetto (`_octo/.modelli/`) e a ogni approvazione ci scrive dentro solo il testo. Intestazione, piè di pagina, margini, caratteri e ogni altra parte restano quelli del documento: provato su una carta intestata vera, cambia una sola parte su 36.
- **Il Word lo scrive il codice di Octo, senza librerie di impaginazione**: titoli, paragrafi, elenchi e tabelle hanno la loro formattazione diretta, senza stili né numerazioni da cui dipendere. Per questo lo stesso corpo sta in qualunque documento.
- **Non fatto**: PowerPoint ed Excel, deliverable specifici di un cliente.

## Scelte prese durante F5
- **Tipi di deliverable del progetto, a parole**: il PM dà un titolo, dice chi lo legge, che cosa chiedergli prima (una domanda per riga, `*` se obbligatoria), come va scritto e che cosa controllare. Octo lo aggiunge al catalogo di quel progetto e lo scrive con gli stessi tre controlli degli altri. Le istruzioni si possono incollare: è la via per portare in Octo, senza codice, le skill che oggi stanno nell'account del PM.
- **Dove stanno**: in `_octo/.tipi/`, uno per file, nascosti alla ricerca di Claude perché sono impostazioni e non fonti. Salvare di nuovo con lo stesso titolo sostituisce.
- **Limite**: un tipo a parole produce testo (Markdown e Word). Non compila moduli Excel né deck PowerPoint del cliente, e non esegue script.
- **Connettori del PM dentro Chiedi: non fattibile oggi.** Ho chiesto a Claude, in un'esecuzione non interattiva, quali strumenti dei connettori avesse: nessuno, né in modalità ristretta né senza. I connettori collegati all'account (posta, tracker) non arrivano a un'esecuzione lanciata da un programma. Finché è così, ciò che v0 legge dal vivo in Octo entra copiandolo nella cartella: è il lavoro di F2. Da riprovare a ogni aggiornamento di Claude Code.

## Quali skill della Suite v0 entrano in Octo (deciso con il PM il 14/11/2026)
Dalla descrizione funzionale delle 31 skill di v0. Criterio: entra ciò che un altro PM userebbe sul suo progetto e che risulta usato davvero (log delle correzioni e uso dichiarato).

**Già in Octo**: email al cliente, verbale, stima, carta intestata.

**Entrano come generiche, in quest'ordine**
1. **Cruscotto bug e requisiti**, dentro Octo: bug per fase, fermi da N giorni, andamento, e i segnali dei requisiti poco chiari (in refinement, criteri di accettazione assenti, descrizione minima, in attesa, punti da chiarire nel testo). Unisce la dashboard e il report bug.
   **Fatto** (demo 07). Scheda «Cruscotto», calcolata dal codice senza Claude. Decisioni prese:
   - *Fonte*: un'esportazione del tracker in JSON tenuta nella cartella del progetto (`{ exported_at, items }`) e, se c'è, la cronologia di stati e tag. Octo le trova da sole e le legge soltanto. Con la cronologia l'andamento segue i cambi veri; senza, è una stima dichiarata.
   - *Fasi*: lavorazione, verifica, validato, chiuso, proposte dal nome dello stato (qualunque numero abbia davanti) e correggibili a mano. «Aperto» = lavorazione + verifica. Uno stato sconosciuto resta in lavorazione: un bug non sparisce mai.
   - *Andamento*: entrati, usciti e aperti a fine passo; periodo a scelta (8 settimane, 3, 6, 12 mesi, o due date) e passo settimana o mese. Un bug conta finché ha un tag del perimetro e non è validato o chiuso.
   - *Dove si fermano*: mediane apertura → verifica → validazione → chiusura; lo stato di «passaggio a chi verifica» si sceglie nelle impostazioni.
   - *Giorni nello stato*: contati fino alla data dell'esportazione, non a oggi. Avviso oltre 24 ore, più forte oltre 3 giorni.
   - *Decisioni del PM* (nota su un elemento, requisito giudicato chiaro, segnale tolto): dati con la data in `_octo/.impostazioni/dashboard.json`; nel tracker non si scrive nulla.
   - *Verifica*: sullo stesso snapshot reale i numeri di oggi e le mediane coincidono con la dashboard v0; l'andamento settimanale differisce di un bug in tre settimane perché v0 contava come aperti alcuni stati di chiusura con il nome vecchio.
   - *Restano*: leggere anche gli elementi scritti dai connettori di Octo; costruire la cronologia da sé quando il file non c'è. Un periodo ha al massimo 520 passi.
2. **Riconciliazione delle ore**: ore del gestionale contro ore del tracker, per persona e periodo, con le esclusioni attese e la quadratura finale.
   **Fatto** (demo 08). Scheda «Ore», calcolata dal codice senza Claude. Decisioni prese:
   - *Fonti*: due esportazioni tenute nella cartella del progetto, lette soltanto. Timesheet: i file JSON del sistema aziendale (`{ rows: [{ employee, timesheetdate, projectid, duration, approvalstatus }] }`), un file o una cartella con tutti i mesi. Ore del tracker: il CSV dello strumento con cui si segnano (colonne persona, data, ore o secondi, trovate per nome in italiano o inglese). In alternativa all'esportazione a mano, «Leggi le ore da Jira» le legge dal tracker (vedi sotto).
   - *Confronto*: per persona, su un mese o su due date; solo ore approvate; i codici di progetto fuori da quelli indicati restano fuori e vengono detti.
   - *Persone*: lo stesso nome scritto in ordine o forma diversa («Rossi Mario», «mario.rossi») è riconosciuto da solo; gli altri si uniscono a mano. Chi non segna sul tracker, o non ha timesheet qui, si marca «atteso» con un clic.
   - *Controlli*: quadratura (ore approvate = ore nel confronto + ore dopo l'ultimo giorno completo) mostrata prima della tabella; una riga tenuta in due file conta una volta sola; ore uguali per persona e giorno su due codici sono segnalate come possibili doppioni.
   - *Verifica*: sui timesheet reali le ore approvate di due mesi su tre coincidono con i riepiloghi v0; nel terzo Octo conta il doppio e lo segnala come possibile doppione (ore spostate di codice, con il file vecchio rimasto nella cartella). Il confronto con le ore del tracker non è stato provato su dati reali: nella cartella non c'è un'esportazione.
   - *Ore lette da Jira* (decisione dell'utente del 14/11/2026, che rovescia la scelta precedente di non leggerle mai): su richiesta del PM, con il token di sola lettura già usato per le issue e per i soli progetti indicati in «Fonti». Octo cerca le issue con ore nei mesi interi del periodo, legge le registrazioni di ciascuna pagina per pagina e scrive un file per mese in `_octo/ore/jira/`; da lì parte il confronto. Di ogni registrazione tiene persona, giorno, ore e issue: né email né commenti. La lettura periodica delle issue continua a non chiedere le ore. Al massimo 12 mesi per volta.
   - *Restano*: la data di fine contratto delle persone (anagrafica); provare la lettura sul Jira vero.
3. **Excel e PowerPoint su modello**: prima il previsionale mensile per l'amministrazione (lo compilano tutti i PM con lo stesso modello), poi il modulo di avanzamento per posizione d'ordine e il deck dello stato di avanzamento.
   - *Previsionale mensile: fatto* (demo 09). Scheda «Previsionale»: Octo legge il file Excel dell'amministrazione, trova le colonne dalle intestazioni (qualunque mese nominino) e le righe dal codice di progetto, e scrive una copia compilata in `_octo/previsionale/<mese>/`. L'originale non viene toccato; della copia cambiano solo le celle da compilare, e larghezze, colori, formati e altri fogli restano quelli del modello.
   - *Che cosa calcola*: costi interni e ricavi dalle ore approvate dei timesheet del mese (gli stessi della scheda «Ore») per costo e tariffa al giorno di ogni persona; costi esterni dalle giornate che il PM dichiara; per un progetto a corpo l'avanzamento è costi del mese su costi a budget e i ricavi sono l'ordinato per l'avanzamento; margine del mese e a fine progetto sono formule del foglio. Il PM può fissare i ricavi, l'importo da fatturare e una nota. Le cifre sono scritte come formule (giorni × costo) con il loro valore, così il file si legge anche senza ricalcolo.
   - *Dati mancanti*: una persona senza costo al giorno resta fuori dal calcolo, una senza tariffa conta solo a costo, il margine a fine progetto resta vuoto senza i costi totali previsti. Ogni mancanza è elencata; niente è stimato.
   - *Riservatezza*: costi e tariffe al giorno stanno nelle impostazioni nascoste di Octo del progetto; il file compilato è un Excel dentro la cartella di Octo, che non viene convertito in testo per Claude.
   - *Verificato* sui modelli veri di due mesi: colonne e righe riconosciute, file compilato aperto e ricalcolato senza errori. Il confronto delle cifre con v0 non è fatto: servono costi e tariffe inseriti dal PM.
   - *Restano*: leggere costi e tariffe da una griglia Excel; le giornate degli esterni dalla posta e gli importi da fatturare dai moduli di avanzamento; le colonne di backlog per anno che alcuni mesi il modello aggiunge; il confronto con i valori già dichiarati all'amministrazione.
   - *Modulo di avanzamento per posizione d'ordine: fatto* (demo 10). Scheda «Avanzamento»: il PM scrive le posizioni dell'ordine con i loro importi e una richiesta per fattura; Octo calcola per ogni richiesta la percentuale precedente, attuale e di periodo di ogni posizione e la scrive sul modulo Excel del cliente, in `_octo/avanzamento/`. Il modulo vuoto non viene toccato.
   - *Come calcola*: l'importo chiesto riempie le posizioni una dopo l'altra, sempre dal totale chiesto fin lì e mai sommando passi arrotondati; una richiesta può nominare le posizioni su cui va; la richiesta che raggiunge il totale dell'ordine chiude tutte le posizioni al 100%. Un importo che supera l'ordine, o quello che resta sulle posizioni nominate, ferma il calcolo e viene detto. Lo scarto in euro che l'arrotondamento lascia è mostrato.
   - *Il modulo è del cliente, la mappa è del progetto*: quale cella prende che cosa («cella = testo», con i nomi `{n}`, `{ordine}`, `{posizioni}`, `{dal}`, `{al}`, `{al_precedente}`, `{nota}`) e dove sta la tabella delle posizioni sono impostazioni, non codice. Logo, celle unite, etichette e spazi riservati al cliente restano come sono.
   - *Verificato* sull'esempio di riferimento di v0 (stesse percentuali) e sul modulo vuoto vero: parti del file, logo e celle unite conservati. Non ancora usato per una richiesta reale.
   - *Restano*: leggere le posizioni dal PDF dell'ordine; il PDF del modulo e la firma (che resta un gesto del PM); i controlli incrociati con fatture e verbali di consegna; l'email di accompagnamento come tipo di deliverable.
   - *Presentazione dello stato di avanzamento: fatta* (demo 11). In «Deliverable» il PM sceglie una volta la presentazione da usare come modello (di solito quella del periodo scorso); da allora lo stato di avanzamento approvato esce anche come `.pptx`, oltre a testo e Word. Le slide non le scrive Claude: il codice impagina il testo approvato, una slide per sezione.
   - *Che cosa resta del modello*: la copertina, la slide finale se non è una slide di contenuto, master, layout, tema e immagini. Le slide in mezzo sono riscritte sulla prima slide del modello che ha un titolo e, se c'è, una tabella: stesso layout, stesso carattere del titolo, stesso posto e stesso stile della tabella. Le slide del periodo scorso, con le loro note, non restano nel file.
   - *Che cosa entra in una slide*: titolo, righe di testo ed elenchi, al più una tabella; una sezione troppo lunga continua sulla slide dopo con lo stesso titolo e il numero.
   - *Verificato* su un deck vero di sette slide con centinaia di layout: il risultato si apre e si converte in PDF con LibreOffice, con lo sfondo, il logo e le tabelle del modello. L'apertura in PowerPoint non è stata controllata.
   - *Restano*: la copertina senza titolo da riempire va aggiornata a mano; le slide «a cruscotto» fatte di forme e indicatori non si generano; il file pesa quanto il modello; gli altri tipi di deliverable non escono come slide.
4. **Sei tipi di testo nel catalogo**: scenari di test, voce di backlog, note di rilascio, analisi funzionale e backlog da riunione, elenco delle modifiche da applicare a mano al tracker, technical proposal (parte narrativa).
   - *Fatto* (demo 12). I sei tipi sono nel catalogo dei deliverable, con lo stesso percorso degli altri: domande al PM, bozza con fonti controllate, rilettura critica, modifiche a parole, approvazione in testo e Word.
   - *Che cosa fissa ogni tipo*: le sezioni, le regole del mestiere e i controlli prima di approvare. Analisi funzionale: solo ciò che è stato chiesto in riunione, contraddizioni riportate e non risolte. Voce di backlog: un bisogno solo, criteri di accettazione provabili, nessuna stima o priorità. Modifiche al tracker: una riga per campo, valore di oggi e valore nuovo, solo modifiche decise da qualcuno; le applica una persona a mano. Scenari di test: ogni scenario copre un requisito scritto, esiti attesi mai inventati. Note di rilascio: solo voci che risultano rilasciate, scritte per chi usa il sistema. Technical proposal: nessuna cifra, perimetro dalla fonte indicata dal PM e non dall'elenco del tracker.
   - *Da dove vengono le istruzioni*: dalla descrizione funzionale delle skill di v0 tenuta nel vault (struttura, regole e formati di ciascuna), senza ciò che è proprio di un cliente. Il testo delle skill di v0 sta nell'account e non si legge dal vault: le istruzioni vanno provate su casi reali. Rispetto a v0: la voce di backlog usa la forma imperativa come default e le altre solo su richiesta; l'analisi funzionale non dà stime né priorità; le modifiche al tracker non hanno ancora uno stato «applicata» e «verificata». Per ogni progetto il PM può aggiungere le proprie istruzioni a ciascun tipo.

**Entra anche**: l'allineamento fra due tracker (uno del cliente, uno interno), perché è frequente fra i PM; le regole di corrispondenza vanno in configurazione.
- *Fatto* (demo 13). Scheda «Allineamento»: le voci del tracker del cliente in uno sprint (dall'esportazione che legge anche il cruscotto, o da un altro file) confrontate con i ticket del tracker interno (quelli che la fonte Jira di Octo ha scritto nel progetto, o un'altra cartella). Octo non scrive in nessuno dei due tracker.
- *Come collega*: una voce e un ticket sono collegati se la voce porta fra i tag la chiave del ticket, altrimenti se il titolo del ticket nomina l'id della voce dopo un prefisso (`[AZDO 123]`, anche con più id). Mai per somiglianza: i titoli che si somigliano, fra voci senza ticket e ticket senza riferimento, sono solo proposti.
- *Che cosa dice*: ogni voce dello sprint sta in una sola di tre liste (ticket nello sprint, ticket altrove, senza ticket) e la quadratura è mostrata; in più le voci con più ticket, i ticket che nominano una voce che non c'è o che è fuori perimetro, i ticket dello sprint senza riferimento. Con i gruppi di stati equivalenti indicati dal PM, dice anche se gli stati dei due lati sono coerenti.
- *File di import*: i ticket mancanti in un CSV (titolo con l'id della voce, tipo tradotto, descrizione senza HTML, sprint) che il PM importa a mano.
- *Diverso da v0*: la somiglianza dei titoli è calcolata su coppie di lettere e parole in comune, non con lo stesso algoritmo, quindi le proposte possono differire; priorità e nome utente del tracker interno non entrano nel file di import; non c'è l'elenco delle persone per cui l'assenza di ticket è attesa. Non provato sui dati veri: serve che la fonte Jira abbia letto i ticket del progetto, con il campo dello sprint configurato.

**Regole trasversali da portare in codice**
- Filtro per il cliente: cifre seguite da unità di sforzo o di costo nei testi destinati al cliente, come controllo del codice su ogni deliverable per il cliente. **Fatto** (passo 4 della demo 06): nella revisione di ogni deliverable destinato al cliente il codice elenca le giornate di lavoro (gg, giornate, GU, MD, FTE…) e gli importi che trova, con le parole intorno. Non toglie nulla e non blocca l'approvazione: non sa se un importo è un prezzo già concordato. Scadenze in giorni o ore, date e percentuali non sono segnalate. Restano fuori le parole senza cifra (margine, tariffa) e il testo dentro le immagini.
- Calendario e squadra del progetto: periodi, sprint, persone con date di ingresso e uscita. **Fatto** (demo 14): in «Fonti», sezione «Persone e calendario». Il PM scrive le persone (ruolo, da che parte stanno, dal, al, come scrivere loro) e i periodi con le date; Octo li tiene nelle impostazioni del progetto e li scrive anche come testo in `_octo/progetto/persone-e-calendario.md`, che risposte e deliverable leggono e citano. Chi ha lasciato il progetto prima di un periodo, o ci è entrato dopo, non è segnalato nelle ore di quel periodo. Non legge file di configurazione che il progetto ha già: per un progetto esistente si riscrivono qui.
- Domande pronte in Chiedi: stato del periodo, blocchi e rischi, triage delle mail, dopo la riunione. **Fatto** (demo 14): quattro pulsanti sopra il riquadro della domanda; riempiono il testo e non inviano, così il PM lo corregge. Uguali per tutti i progetti.
- Stima: confidenza per voce, nuovo distinto dal residuo, vista per il cliente.
- Persone del progetto con le loro preferenze di lettura, usate dall'email. **Fatto** insieme a persone e calendario: la nota «come scrivergli» di ogni persona sta nel testo del progetto e le istruzioni dell'email dicono di seguirla.

**Restano fuori dal catalogo** (nessuna usata con regolarità; ognuna si aggiunge come tipo proprio): pre-mortem, red-team della strategia, prioritizzazione, roadmap per outcome, mappa degli stakeholder, controllo grammaticale, retrospettiva; e le tre per chi sviluppa (documentazione di rilascio, confronto fra documentato e implementato, query).

**Restano specifiche del progetto o del cliente**: il ciclo di vita dei documenti contrattuali con impaginazione sul precedente, budget e capacity finché dipendono da griglia e scheda di commessa.

**Debito da non portare**: periodo attivo cablato, percorsi assoluti, connettori dismessi, note ed esclusioni come costanti nel codice, profili e glossario dentro il prompt. Note, esclusioni, profili e glossario sono dati del progetto, con data e autore.
