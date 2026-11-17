# Octo

App desktop per i Project Manager, su Windows e Mac. Un progetto è una cartella del computer: Octo la legge con Claude, sul seat del PM, e risponde alle domande citando i file. Ogni citazione viene poi controllata dal codice, una per una.

Octo nasce dalla revisione delle versioni precedenti (Suite su Claude Code, octobrief, octobrief-next, octobrief-new): le decisioni e la roadmap sono in [docs/roadmap.md](docs/roadmap.md).

> Il repository non contiene dati di clienti. I dati delle demo sono sintetici.

## Avvio rapido
Requisiti: Node 24, pnpm 12, Claude Code installato e con l'accesso fatto (`claude` dal terminale, una volta).

```bash
pnpm install
pnpm dev          # compila e apre l'app
```

## Struttura
```
packages/
  domain/          regole pure: risposta, citazioni e loro controllo, progetto
  application/     casi d'uso e porte: fare una domanda, gestire i progetti, alimentare la memoria
  connectors/      connettori di sola lettura per Azure DevOps, Jira e NetSuite/DWSI (da octobrief-new)
  infrastructure/  adattatori: Claude Code da riga di comando, archivio di Mail, estrazione del testo da Office e PDF, file del progetto, stato dell'app in JSON
apps/
  desktop/         app Electron: processo principale (composition root), preload, interfaccia React
demo/              una demo per ogni fetta (run.sh + COPIONE.md)
e2e/               controllo della finestra vera con Playwright
```
Le dipendenze puntano solo verso l'interno: `domain` ← `application` ← `infrastructure` ← `apps`. La regola è verificata da `pnpm lint`.

## Come Octo usa Claude
- Avvia Claude Code del PM nella cartella del progetto, con i soli strumenti di lettura.
- Claude è in modalità ristretta: non legge fuori dalla cartella, non usa connettori, non carica impostazioni o plugin del computer.
- La domanda passa sullo standard input; la risposta torna in un formato fisso (testo, citazioni, cose non trovate).
- Octo apre ogni file citato e cerca la frase: ciò che non trova resta nella risposta, marcato «da controllare».

Variabili facoltative: `OCTO_CLAUDE_PATH` (percorso di Claude Code), `OCTO_DATA_DIR` (cartella dello stato dell'app), `OCTO_MAIL_ROOT` (un'altra cartella di Mail, per le demo), `OCTO_VERBALE_DIR` (un'altra cartella dei dati di Verbale, per le demo). Solo per demo e test: `OCTO_DEV_ADO_URL`, `OCTO_DEV_JIRA_URL` (sistemi finti) `OCTO_DEMO_PLAIN_SECRETS=1` (credenziali senza il Portachiavi) e `OCTO_COMPUTER_NAME` (il nome con cui questo computer si presenta agli altri che condividono una cartella).

## Come Octo alimenta la memoria
Tutto ciò che Octo scrive in un progetto sta sotto `_octo/`: la cartella si esclude da git da sola e resta visibile alla ricerca di Claude. Octo non scrive mai nelle cartelle del PM. Ciò che è di una sola persona (credenziali, cronologia delle domande, pagina «Oggi») sta invece con l'app, sul suo computer: vedi «Cartella condivisa».

- **Posta** (Mac): legge l'archivio di Mail sul computer e scrive nel progetto le mail che lo riguardano, una per file. Le regole si impostano nella scheda «Fonti» e stanno in `_octo/.impostazioni/sources.json` nella cartella del progetto.
- **Riunioni (Verbale)**: legge la cartella in cui l'app Verbale esporta le riunioni (proposta da Octo quando Verbale la dice, altrimenti scelta dal PM) e scrive in `_octo/riunioni/<data>_<titolo>_<id8>/` i soli testi (`transcript.md` con le sue ancore, `notes.md`, `report.md`, `markers.json`) più un `_meta.md` con data, durata, partecipanti e origine. Niente audio né immagini; in Verbale non scrive mai.
  - «Dal giorno» dice da quando: un progetto appena collegato parte da oggi, perché ciò che Verbale ha registrato prima raramente è suo. Vuoto, entra tutto. Una riunione già importata resta aggiornata anche se è precedente.
  - Entrano solo le esportazioni concluse: `meeting.json` presente, `state` uguale a `complete`, `schemaVersion` nota. Le altre sono annotate in `_octo/riunioni/_lettura.md`. Quando accanto a `meeting.json` c'è `summary.json` (Verbale recente), Octo legge quello, che è piccolo; se manca o non si legge, il manifest completo.
  - Il progetto si decide così, fra quelli che leggono la stessa cartella: l'invito in memoria all'evento che Verbale nomina (`calendarEventUID`), quando lo nomina, in qualunque giorno cada; poi un invito che si sovrappone all'orario; poi le parole chiave del progetto (il suo nome e quelle della posta) nel titolo o negli appunti; altrimenti la riunione non entra da nessuna parte e compare in «Oggi» con «Assegna a questo progetto». Se due progetti potrebbero prenderla, non la prende nessuno.
  - Una riunione riesportata (correzioni, riepilogo nuovo) viene riscritta nella stessa cartella: il riferimento è il suo identificativo. Dopo aver letto i documenti Octo rilegge la revisione dell'esportazione (`exportRevision`, `exportedAt`): se nel frattempo è cambiata non scrive nulla, lo annota e riprova alla lettura successiva.
  - La cartella proposta è quella che Verbale dichiara in `~/Library/Application Support/Verbale/export.json`; con un Verbale più vecchio, quella nominata dalle sue sessioni. I partecipanti sono quelli elencati da Verbale (`participants`, con l'indirizzo se c'è) o, in mancanza, i nomi dati alle voci.
  - Limite: Verbale oggi non conosce l'evento di calendario, quindi `calendarEventUID` non arriva. Di una riunione ricorrente la posta dà solo la prima data: le successive passano dalle parole chiave o dall'assegnazione a mano. Stato delle richieste a Verbale in [docs/verbale-richieste.md](docs/verbale-richieste.md).
- **Documenti**: scrive in `_octo/testo/` il testo di Word, Excel, PowerPoint e PDF della cartella, con lo stesso percorso dell'originale, così Claude può cercarlo e citarlo. Riconverte solo ciò che cambia.
- **Azure DevOps, Jira, NetSuite (DWSI)**: legge work item, issue e viste del warehouse con la credenziale di sola lettura del PM e ne scrive un file per elemento, più una nota (`_lettura.md`) sull'età dei dati. La credenziale resta sul computer, cifrata dal sistema.
- Tutte le fonti partono su richiesta e ogni 15 minuti ad app aperta.
- **Avvio guidato**: in cima alla scheda «Fonti» un pannello dice che cosa è collegato e che cosa no, e un pulsante riempie la memoria da tutto ciò che è collegato. Octo propone parole chiave, date e cartelle; mostra un'anteprima della posta; elenca progetti e aree dei tracker da scegliere con un clic.

## Deliverable
Nella scheda «Deliverable» il PM sceglie dal catalogo (email al cliente, stato di avanzamento, verbale, stima), compila pochi campi e riceve una bozza:
- scritta da Claude dal progetto, in sola lettura;
- con ogni fonte controllata dal codice;
- riletta in un'esecuzione separata, come farebbe chi la riceve.

Nel verbale il campo «Quale riunione» elenca le riunioni importate da Verbale: scelta una, la sua trascrizione è la fonte principale; un'altra riunione si indica a parole.

Il PM chiede modifiche a parole e approva: Octo scrive Markdown e Word in `_octo/deliverable/approvati/` e registra minuti di scrittura, minuti di revisione e giri nel registro del progetto. Nella stima i totali li calcola il codice. Il PM può aggiungere al catalogo del progetto tipi suoi, descritti a parole. Se il PM ha scelto una carta intestata (un documento Word), il file esce su quella.

## Comandi
| Comando | Cosa fa |
|---|---|
| `pnpm dev` | compila e apre l'app |
| `pnpm typecheck` | TypeScript strict su tutto il monorepo |
| `pnpm lint` | Biome e regole di architettura |
| `pnpm db:setup` | avvia il Postgres di prova per i test del warehouse (Docker) |
| `pnpm test` | test unitari e di integrazione |
| `pnpm test:coverage` | test con soglia di coverage all'80% |
| `pnpm e2e` | compila e segue la demo 01 nella finestra vera, con il modello finto |
| `pnpm e2e:condivisa` | compila e segue la demo 42 in due finestre vere sulla stessa cartella |
| `pnpm dist` | crea l'installatore per il sistema su cui gira |

## Cartella condivisa
Due o più persone possono lavorare sullo stesso progetto tenendo la cartella allineata con OneDrive o SharePoint (o un altro servizio che sincronizza le cartelle). Non serve git.

La regola: **nella cartella sta ciò che è del progetto; con l'app, su ogni computer, ciò che è della persona.**

| Nella cartella (di tutti) | Con l'app (di ciascuno) |
|---|---|
| File del progetto e tutto `_octo/`: posta, riunioni, fonti, testi estratti, cruscotto, ore e costi, deliverable, registri | Credenziali delle fonti |
| Che cosa si legge di ogni sistema: organizzazione, progetti, aree, spazi, codici, parole chiave | Con quale account lo si legge (email di Jira e Confluence, utente di NetSuite) e dov'è la cartella di Verbale |
| Stato delle letture (`_octo/.stato/`): ultima lettura riuscita e di chi, da dove riparte la prossima, che cosa ha scritto ogni feed | Cronologia delle domande, decisioni e giudizi della pagina «Oggi», l'ultimo tentativo fallito |

Come si comportano le letture:
- **Una fonte la legge un computer alla volta.** Chi legge lo scrive nella cartella; un altro Octo aspetta, e riprende da solo se quella lettura si ferma senza dire nulla (10 minuti).
- **Chi arriva dopo prosegue**, dal punto a cui è arrivato l'altro: niente viene riletto da zero né cancellato, anche se l'account è un altro.
- **La lettura periodica non raddoppia**: ciò che un altro computer ha letto da meno di 15 minuti non viene riletto. «Leggi ora» legge comunque.
- **Ogni computer legge solo ciò che può**: i sistemi di cui ha la credenziale, la posta se ha un programma di posta che Octo legge, le riunioni se ha la cartella di Verbale. Il resto lo trova già scritto da chi può, e la pagina «Impostazioni» dice da chi («Letta da Giovanni · MacBook»).
- Le copie in conflitto che il servizio lascia nelle cartelle dei feed, quando due computer scrivono insieme, vengono tolte alla lettura successiva.

Per mettere in condivisione un progetto che hai già:
1. Aggiorna Octo e aprilo una volta: porta nella cartella lo stato delle letture che teneva sul computer, e toglie dalla cartella la tua cronologia e la tua pagina «Oggi». Poi chiudilo.
2. Sposta la cartella del progetto dentro la raccolta sincronizzata e scegli «Mantieni sempre su questo dispositivo»: la ricerca di Claude lavora sui file veri, non sui segnaposto.
3. Riapri Octo, «Gestisci i progetti…», «Cambia cartella…» e indica la nuova posizione. Il progetto resta lo stesso, con credenziali e letture.
4. Chi si aggiunge sincronizza la raccolta («Mantieni sempre su questo dispositivo»), installa Octo e aggiunge la cartella. Lavora subito su ciò che è già stato letto; per leggere anche dal suo computer inserisce le sue credenziali.

Prima di aggiungere la cartella, sul computer di chi si aggiunge:
- **Claude Code** installato e con l'accesso fatto (`claude` dal terminale, una volta). Su Windows serve l'installazione nativa: in PowerShell `Get-Command claude` deve indicare un file `claude.exe`. Se indica `claude.cmd` (installazione con npm) Octo non lo avvia: installa la versione nativa, oppure metti in `OCTO_CLAUDE_PATH` il percorso di un `claude.exe`.
- **Accesso aziendale**: al primo avvio Octo chiede i due identificativi dell'accesso (organizzazione e applicazione). Non sono segreti: chi usa già Octo li legge nel file `accesso.json` della cartella dei dati di Octo (su Mac `~/Library/Application Support/Octo/accesso.json`, su Windows `%APPDATA%\Octo\accesso.json`) e li passa al collega.
- L'installatore non è firmato: Windows (SmartScreen) e macOS chiedono conferma al primo avvio.

Limiti:
- **NetSuite** si legge solo per i codici di cui chi è entrato è project manager: gli altri vedono ore, costi e previsionale letti da quella persona.
- **Registri e impostazioni del progetto** (open point, rischi, persone, cruscotto, ore) sono file unici: se due persone li cambiano nello stesso minuto, vince l'ultima.
- **«Scollega» una fonte** la scollega per tutti: è del progetto.
- Il turno è scritto nella cartella sincronizzata, quindi arriva con il ritardo del servizio: due letture insieme restano possibili, e sono innocue perché scrivono lo stesso contenuto.
- **Su Windows i percorsi oltre 260 caratteri** possono non sincronizzarsi: tieni la raccolta in un percorso corto.
- Non verificato con un OneDrive vero né su Windows: lo coprono i test e la demo 42, su un solo computer.

## Installatori
`pnpm dist` produce in `apps/desktop/release/` un `.dmg` e uno `.zip` su Mac e un `.exe` su Windows. Su GitHub il flusso «Installatori» li crea a ogni tag `v*` o su richiesta. Non sono firmati: al primo avvio il sistema chiede conferma.

## Aggiornamenti
Un Octo installato controlla all'avvio e ogni sei ore l'ultima release di `limg88/octo`: se è più nuova lo dice in cima alla pagina, e con «Aggiorna e riavvia» scarica il file per il suo sistema, lo verifica, si sostituisce e riparte. Lanciato dai sorgenti non cerca aggiornamenti.

Installa solo una release **firmata da chi pubblica Octo**: la lista `SHA256SUMS` deve avere accanto `SHA256SUMS.sig`, fatta con una chiave Ed25519 la cui metà pubblica è dentro l'app (`apps/desktop/release-keys.json`). La chiave privata sta solo sul computer di chi pubblica, mai nel repository né su GitHub: chi prendesse il controllo del repository non potrebbe far installare una versione sua. Non serve un Developer ID di Apple: è un'altra firma, che riguarda macOS e non Octo.

Una volta sola:
```bash
pnpm release:keys            # la chiave «primaria», in ~/.octo-release, con una passphrase
pnpm release:keys riserva    # una seconda, da tenere scollegata: se perdi la prima, firmi con questa
git add apps/desktop/release-keys.json && git commit -m "chore: the keys Octo's releases are signed with"
```
Copia le due chiavi private fuori dal computer. Senza nessuna delle due gli Octo installati non si aggiornano più: va reinstallata a mano una versione con chiavi nuove. Un Octo costruito senza chiavi in `release-keys.json` non propone aggiornamenti.

A ogni versione:
```bash
git tag v0.2.0 && git push origin v0.2.0   # GitHub costruisce i file e prepara la release in bozza
pnpm release:sign v0.2.0                   # sul tuo computer: firma la lista e pubblica la release
```
Finché non firmi, la versione resta una bozza e nessun Octo la vede. Serve la GitHub CLI (`gh`) con l'accesso fatto.

Chi ha una versione senza questa funzione deve installare la nuova a mano una volta.

## Demo
Vedi [demo/README.md](demo/README.md).
