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
| **F4. Deliverable, parte 1** | mail, SAL economico, SAL di progetto; istruzioni modificabili a parole; controllo interno/cliente; approvazione | i tre deliverable di DEEM del ciclo escono dall'app |
| **F5. Deliverable, parte 2** | stime, dashboard bug e requisiti, technical proposal | la Suite v0 non serve più per DEEM; il pilota produce un deliverable reale |

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

## Scelte prese durante F1
- **Claude in modalità ristretta** (`--restricted --strict-mcp-config`), con i soli strumenti Read, Grep e Glob:
  - non legge fuori dalla cartella del progetto;
  - non usa connettori;
  - non carica impostazioni, hook o plugin del computer né della cartella. Una cartella condivisa non può quindi far eseguire codice.
- **Le regole del progetto vincolano la risposta**: in modalità ristretta Claude ignora il `CLAUDE.md` della cartella, quindi Octo lo legge e lo passa nel prompt come regole del PM (per esempio: niente numeri da uno snapshot più vecchio di 72 ore). Le parti su strumenti e skill non disponibili vengono ignorate; l'esecuzione resta di sola lettura qualunque cosa dicano.
- **File grandi e export JSON** (trovato sulla prima prova con DEEM, 14/11): un file citato fino a 200 MB viene aperto; oltre è marcato «troppo grande», non «non trovato». Una frase vale anche se il file scrive i caratteri come `\uXXXX`.
- **Modello**: quello predefinito di Claude Code del PM, come in v0. Una domanda banale costa poco in quota, ma il primo avvio carica un contesto ampio.
- **Variabili di un'altra sessione Claude** (`ANTHROPIC_*`, `CLAUDE*`) tolte dall'ambiente del processo: vale sempre l'accesso del PM.
- **La domanda viaggia sullo standard input**: nessun problema di virgolette su Windows.
- **Citazioni**: una frase vale come prova se è lunga almeno 12 caratteri e si trova nel file, ignorando a capo e spazi ripetuti. Un file citato si apre solo se il suo percorso reale sta nella cartella del progetto.
- **Stato dell'app** (elenco dei progetti, storico delle domande) in file JSON nella cartella dati dell'utente, mai nella cartella del progetto.
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
