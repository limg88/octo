# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- Oggi Octo è un'app desktop Electron (Windows e Mac) con interfaccia React. Tablet e telefono sono un obiettivo confermato; se saranno web o app native non è deciso: vedi «Capabilities and Constraints». -->

## Users

- **Project Manager di una società di consulenza.** È l'utente principale. Lavora da solo, sul suo computer, più volte al giorno e spesso fra una riunione e l'altra. Legge molto e scrive poco. Segue uno o più progetti per clienti diversi.
- **Altri ruoli oltre ai PM.** Confermato che ci saranno; quali ruoli, con quali compiti e che cosa possono vedere non è ancora deciso (vedi le decisioni aperte).
- Più persone possono condividere la cartella di un progetto: ciò che è di una sola persona (credenziali, cronologia delle domande, pagina «Oggi») resta sul suo computer.

## Product Purpose

Octo fa leggere a Claude la cartella di un progetto e ne restituisce al PM ciò che gli serve per governarlo: che cosa fare oggi, la risposta a una domanda, i testi da mandare, lo stato di bug e sprint, i conti della commessa.

Esiste perché il PM deve potersi fidare di ciò che legge. Il successo è che di ogni frase e di ogni cifra si veda da dove viene, e che il tempo fra «mi serve saperlo» e «lo so, con la fonte» sia breve.

## Positioning

- **Ogni citazione è controllata dal codice.** Claude risponde citando i file; Octo apre ogni file citato e cerca la frase. Ciò che non trova resta nella risposta, marcato «da controllare».
- **Octo calcola, Claude valuta.** Totali, confronti e scostamenti li calcola il codice; a Claude restano la scrittura e il giudizio. Le due cose sono sempre distinte e dichiarate a chi legge.
- **Un progetto è una cartella del computer.** Niente archivio centrale: Octo legge con le credenziali del PM, in sola lettura, e scrive soltanto sotto `_octo/`.

## Operating Context

- Le sezioni, raggruppate per frequenza d'uso: **Oggi** (ogni giorno); **Chiedi**, **Deliverable**, **Cruscotto** (lavoro); **Commessa** (ogni mese); **Impostazioni** (progetto).
- Le fonti che alimentano un progetto: posta (archivio di Mail, su Mac), riunioni esportate dall'app Verbale, documenti Word, Excel, PowerPoint e PDF della cartella, Azure DevOps, Jira, Confluence, NetSuite. Le fonti si leggono su richiesta e ogni 15 minuti ad app aperta.
- Claude lavora attraverso Claude Code installato sul computer del PM, in modalità ristretta: non legge fuori dalla cartella, non usa connettori, non carica impostazioni o plugin del computer.
- I deliverable (email al cliente, stato di avanzamento, verbale, stima e i tipi aggiunti dal PM) sono scritti da Claude, riletti in un'esecuzione separata, modificati a parole e approvati dal PM. Gli approvati escono in Markdown e Word, sulla carta intestata se il PM ne ha scelta una.
- **Commessa** è un documento interno: costi e margini non vanno al cliente.

## Capabilities and Constraints

**Vincoli confermati**

- Sola lettura verso le fonti. Unica scrittura fuori dal progetto: la creazione dei ticket mancanti sul Jira interno dopo «Allineamento dello sprint», uno per uno, dopo una conferma esplicita.
- Octo non scrive mai nelle cartelle del PM: tutto ciò che scrive sta sotto `_octo/`.
- Le credenziali restano sul computer, cifrate dal sistema.
- Il repository non contiene dati di clienti; i dati delle demo sono sintetici (progetto di prova «Aurora»).
- Finestra di riferimento 1280×860; minima 900×600, che deve restare usabile.
- Architettura a strati con le dipendenze verso l'interno (`domain` ← `application` ← `infrastructure` ← `apps`), verificata da `pnpm lint`.

**Terminologia**

L'interfaccia è in italiano e ogni cosa ha un nome solo, quello di `docs/glossario.md` («sezione», non «tab»; «fonte», non «connettore»; «leggere», non «sincronizzare»). Un'etichetta nuova o cambiata va registrata lì.

**Decisioni aperte**

- **Tablet e telefono.** Sono un obiettivo confermato, ma oggi il progetto è una cartella del computer e Claude lavora da Claude Code installato in locale. Come i dati e Claude arrivano su un dispositivo che non ha la cartella non è deciso, e l'impegno «dati sul computer» va conciliato con questo obiettivo. Non è deciso nemmeno se saranno web o app native.
- **Altri ruoli.** Quali sono, che cosa fanno in Octo e che cosa possono vedere; in particolare se vedono «Commessa».

## Brand Commitments

- Nome: **Octo**. Marchio: il polpo con la scritta «octo» (`Logo.tsx`).
- Voce: italiano, in prima persona quando Octo spiega che cosa fa («Leggo le ore…», «non stimo nulla»); frasi brevi; nessun termine tecnico in interfaccia.
- Ogni stato ha un testo, non solo un colore o un'icona.

## Evidence on Hand

- `README.md`: che cosa fa Octo, come usa Claude, come alimenta la memoria, i comandi.
- `docs/roadmap.md` e gli altri documenti in `docs/`: decisioni, revisioni, esiti delle prove.
- `docs/glossario.md`: le parole dell'interfaccia.
- `docs/claude-design/`: brief della revisione dell'interfaccia, scheda dello stile di oggi (`stile.md`), 18 schermate nei due temi (`schermate/`), elenco di consegna (`esito.md`), tavole esportate (`tavole/`).
- `demo/`: una demo per ogni incremento, con copione.
- **Assenze, da non inventare:** nessuna testimonianza, nessun cliente nominabile, nessun dato d'uso, nessun prezzo. Mancano schermate di stati vuoti e d'errore, dei dialoghi dei progetti, dell'ingresso e della finestra minima.

## Product Principles

1. **La fonte prima della frase.** Ciò che non ha una fonte verificata si dichiara «da controllare»; non si nasconde e non si abbellisce.
2. **Chi calcola e chi valuta si vedono.** Mai una cifra di Claude presentata come calcolo, mai un giudizio presentato come dato.
3. **Il risultato prima delle impostazioni.** Nella prima schermata sta ciò che il PM è venuto a leggere o l'azione che fa più spesso.
4. **Un posto solo per ogni cosa.** Se due schermate dicono la stessa cosa, si uniscono.
5. **Octo non tocca ciò che non è suo.** Legge, non scrive; quando scrive lo fa in un posto solo e dopo una conferma.

## Accessibility & Inclusion

- Tema chiaro e scuro, entrambi sempre supportati.
- Contrasto del testo almeno 4,5:1; contrasto del bordo dei campi in cui si scrive almeno 3:1.
- Movimento minimo, spento con `prefers-reduced-motion`.
- Il colore non è mai l'unico portatore di un significato: ogni stato ha un testo.
