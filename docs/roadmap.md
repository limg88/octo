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
| F1 | codice chiuso il 14/11/2026, demo `demo/01-app-e-chiedi`; criterio di uscita da verificare su DEEM e sul PC Windows del pilota |

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
