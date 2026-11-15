# Identità e login: chi usa Octo

Data: 15/11/2026. Documento di progetto: nessun file dell'app è stato modificato. Nasce dal riepilogo giornaliero (`riepilogo-giornaliero.md`), che ha mostrato che Octo non sa chi lo usa.

**Decisioni del PM (15/11/2026).**
- Octo ha un **login con Entra ID**. Senza un login valido **non si apre**.
- All'IT si chiede **la sola identità**: nessun permesso su posta o calendario.
- Quali progetti sono assegnati al PM si legge da **NetSuite**.
- Un progetto non assegnato viene **proposto con un avviso**, non bloccato.
- Una commessa è assegnata **solo a chi ne è il project manager** in NetSuite. Aver scritto ore sulla commessa non basta.

**Che cosa comporta l'ultima decisione.** Oggi il connettore lega una commessa anche a chi ci ha scritto ore (`connectors/src/dwsi/views.ts:250`): quella parte della regola va tolta, con i suoi test. Il connettore non si limita ad avvisare: una commessa non legata non la legge. Quindi per i dati di NetSuite (ore, ordini, fatture) la regola è un blocco: chi sostituisce un collega, o segue una commessa di cui in NetSuite risulta un altro project manager, non li leggerà finché l'anagrafica non cambia. L'avviso senza blocco vale per il resto del progetto (posta, documenti, Jira, Confluence, Azure DevOps). Le fonti NetSuite già collegate da chi ha solo scritto ore smetteranno di leggere.

**Delega (deciso dal PM il 15/11/2026).** L'unica eccezione alla regola del project manager è una delega esplicita: il project manager di una commessa autorizza un altro PM ad accedervi.
- *Chi delega*: solo il project manager della commessa. Chi è delegato non può delegare a sua volta.
- *Che cosa concede*: tutto ciò che il project manager legge di quella commessa (ore, ordini, fatture, ricavi, costi delle righe di timesheet).
- *Quanto dura*: fino a revoca. Cade da sola se chi ha delegato smette di essere il project manager.
- *Quando si fa*: **con il server previsto dopo T0**, non prima. Una delega che si revoca ha bisogno di un posto che entrambi i computer leggano e di cui si fidino, e Octo oggi non ce l'ha.
- *Fino ad allora*: chi sostituisce un collega non legge i dati NetSuite di quella commessa, a meno che in NetSuite non cambi il project manager. Il resto del progetto (posta, documenti, Jira, Confluence, Azure DevOps) lo può seguire, con l'avviso.
- *Da decidere con il server*: dove il PM vede e toglie le deleghe che ha dato, se il delegato vede chi gliel'ha data, che cosa resta sul computer del delegato dopo una revoca (i file già letti sono già nella sua cartella).

## 1. Che cosa c'è oggi (verificato nel codice)

| Dove | Che cosa sa Octo di chi lo usa |
|---|---|
| NetSuite | Un campo scritto a mano, «La tua email aziendale» (`ownerEmail`: `domain/src/feeds.ts:47`, `FeedSection.tsx:62`). Il connettore lo usa già per legare le commesse al PM: fra i codici dichiarati ammette solo quelli di cui la persona con quell'indirizzo è project manager **o su cui ha scritto ore** (`connectors/src/dwsi/views.ts:244`), e ricontrolla a ogni lettura. Nessuno verifica che l'indirizzo sia di chi lo scrive. |
| Jira, Confluence | L'email e il token personale che il PM inserisce. È il sistema a mostrare solo ciò che quel token può vedere. |
| Azure DevOps | Il token personale. Come sopra. |
| Posta | Nulla: Octo non distingue «scritta a me» da «scritta da me». |
| Octo | Nessun login. L'elenco dei progetti e le credenziali stanno nella cartella dati dell'utente del sistema operativo. |

## 2. Che cosa cambia

1. **Login all'avvio.** Octo apre il browser del sistema sulla pagina di accesso dell'azienda; al ritorno conosce nome, indirizzo e identificativo della persona. Finché il login non riesce si vede solo la pagina di accesso.
2. **Un'identità sola per tutto.**
   - NetSuite: l'indirizzo passato al connettore è quello del login; il campo scritto a mano sparisce.
   - Posta: gli indirizzi del PM (indirizzo e nome utente del login) servono a «Mail a cui rispondere» del riepilogo. Altri indirizzi dello stesso PM (alias) si aggiungono a mano: con la sola identità Octo non li può leggere.
   - Jira e Confluence: l'email del modulo è proposta dal login, e resta modificabile (non è detto che coincida).
3. **Progetti assegnati, proposti.** Collegato l'archivio dei dati aziendali, Octo elenca le commesse di cui il PM è project manager e propone di farne un progetto o di aggiungerle a uno che c'è.
4. **Avviso sui progetti non assegnati.** Un progetto di Octo è «assegnato» se almeno una delle sue commesse è legata al PM in NetSuite. Altrimenti, in testata e in «Impostazioni»: «Questo progetto non risulta assegnato a te in NetSuite». Un progetto senza commesse dice «non posso verificarlo». In nessun caso Octo impedisce di lavorare.

**Che cosa il login non è.** Octo gira sul computer del PM, con i suoi file e i suoi token: il login dice chi è la persona, non protegge i dati da chi ha il computer. A limitare davvero ciò che si legge restano i sistemi di origine, con la credenziale personale, e per NetSuite il controllo del connettore. Una barriera vera richiede il server previsto dopo T0.

## 3. Scelte mie, da confermare alla prima occasione

- **«Login valido» vuol dire rinnovato all'avvio.** A ogni apertura Octo rinnova l'accesso in silenzio; se non ci riesce (rete assente, accesso revocato, computer rifiutato dalle regole dell'azienda) mostra la pagina di accesso. Conseguenza della tua scelta: **senza rete Octo non si apre**, nemmeno su ciò che è già sul computer.
- **Un solo tenant.** Entra solo chi appartiene all'organizzazione indicata nella configurazione.
- **I progetti sono di chi li ha aggiunti.** L'elenco dei progetti ricorda l'identificativo della persona; un'altra persona sullo stesso utente del computer parte da un elenco vuoto. I progetti già in elenco passano alla prima persona che fa il login.
- **Jira, Confluence e Azure DevOps non hanno un'assegnazione loro**: valgono per il progetto di Octo a cui sono collegati, che è assegnato o no per le sue commesse.
- **Demo e test**: un'identità finta data da una variabile d'ambiente, come già per le credenziali, e un sistema di accesso finto in `demo/lib/` per la demo del login.

## 4. Che cosa rovescia delle decisioni prese

| Decisione della roadmap | Che cosa cambia |
|---|---|
| «Nessun server, nessuna richiesta all'IT» | Serve una registrazione di Octo nel tenant: un'app pubblica, senza segreto, con il solo permesso di accesso e profilo. È una richiesta all'IT, piccola. |
| «NetSuite resta a mano: il connettore non elenca le altre commesse. È una protezione voluta» | Per proporre i progetti assegnati serve una lettura nuova: le commesse di cui il PM è project manager. Elenca solo le sue, non quelle degli altri; la protezione resta, ma la regola va riscritta. |
| Credenziale dell'archivio aziendale salvata per progetto | Per proporre le commesse prima che un progetto esista, il collegamento all'archivio diventa della persona, non del progetto. |

## 5. Architettura

**Si riusa così com'è**: l'archivio cifrato delle credenziali (`SecretVault`, per conservare l'accesso), il campo `owner` del contesto dei connettori (`connectors/src/port.ts:42`, già previsto con email e nome utente), la query che lega le commesse al PM, il ponte con richieste validate, il componente degli errori.

**Si estende**
- *Dominio* — `identity.ts`: la persona (identificativo, nome utente, email, nome, tenant) e le regole su quando un accesso vale; in `project.ts` il proprietario del progetto; una funzione «assegnato / non assegnato / non verificabile» dalle commesse legate.
- *Applicazione* — `session.ts` (entra, rinnova, esce; porta `IdentityProvider`); `projects.ts` filtra per proprietario; `feeds.ts` passa l'identità al posto di `ownerEmail`; caso d'uso nuovo per le commesse assegnate.
- *Connettori* — una lettura in più nell'archivio aziendale (commesse di cui la persona è project manager), fra quelle ammesse.
- *Infrastruttura* — `entra/`: accesso con il browser del sistema e ritorno su un indirizzo locale, controllo di chi ha emesso l'accesso e per quale tenant, rinnovo. La libreria di Microsoft per Node è la via ovvia: **versione e regola dei 14 giorni non verificate**.
- *Interfaccia* — pagina di accesso, nome della persona ed «Esci» nella colonna di sinistra, avviso di progetto non assegnato, elenco delle commesse proposte; `FeedSection.tsx` perde il campo dell'email.
- *Processo principale* — ogni richiesta del ponte è rifiutata senza una sessione (`main/ipc.ts`); la lettura periodica parte solo dopo il login.

**Dove stanno tenant e identificativo dell'app**: non sono segreti, ma sono dell'azienda. Li terrei fuori dal repository, in un file di configurazione messo accanto all'installatore.

## 6. Incrementi

Sforzo: piccolo = fino a un giorno; medio = due-quattro giorni; grande = una settimana o più. Stime mie.

| # | Incremento | Effetto per il PM | File toccati | Sforzo | Rischi | Demo |
|---|---|---|---|---|---|---|
| 0a | **Login** | Octo si apre con l'accesso dell'azienda e mostra chi sei; senza accesso non si apre | `domain/src/identity.ts`, `application/src/session.ts`, `ports.ts`, `infrastructure/src/entra/*`, `main.ts`, `ipc.ts`, `shared/api.ts`, `preload.ts`, `App.tsx`, pagina di accesso, `messages.ts` | medio | la registrazione dipende dall'IT; le regole dell'azienda possono rifiutare un computer non gestito, e allora Octo non si apre affatto (da provare sul PC del pilota); tutte le demo e l'e2e hanno bisogno dell'identità finta | `demo/23-login`: accesso su un sistema finto, uscita, rientro |
| 0b | **L'identità al posto dei campi a mano; commessa legata al solo project manager** | Niente più «la tua email» da scrivere; NetSuite e posta sanno chi sei; NetSuite legge solo le commesse di cui sei project manager | `feeds.ts` (dominio e applicazione), `connector-feed-reader.ts`, `connectors/src/dwsi/views.ts` e i suoi test, `FeedSection.tsx`, impostazioni della posta, `projects.ts` | piccolo–medio | le fonti NetSuite già salvate hanno l'indirizzo scritto a mano: se è diverso da quello del login le commesse possono risultare non legate; chi leggeva una commessa per le sole ore scritte smette di leggerla | nella stessa demo: NetSuite collegato senza scrivere l'indirizzo |
| 0c | **Progetti assegnati proposti, avviso sugli altri** | Vedi le tue commesse e ne fai un progetto con un clic; un progetto non tuo è segnalato | lettura nuova in `connectors/src/dwsi/`, collegamento all'archivio per persona, caso d'uso nuovo, `ProjectDialogs.tsx`, `ProjectSettings.tsx` | medio–grande | sposta la credenziale dell'archivio dal progetto alla persona; chi sostituisce un collega vede sempre l'avviso | `demo/24-progetti-assegnati`: richiede il database di prova |

**Rispetto al riepilogo giornaliero.** 0a e 0b vengono prima dell'incremento 3 («Mail a cui rispondere»), che così non chiede più gli indirizzi al PM. L'incremento 1 («Oggi» calcolato) non dipende dal login e può partire subito. I numeri delle demo del riepilogo slittano di conseguenza.

## 7. Non verificato

- Nulla è stato provato: né una registrazione vera, né le regole di accesso dell'azienda, né la libreria.
- Che l'indirizzo del login coincida con quello che NetSuite ha per la persona (la query confronta l'email dell'anagrafica dei dipendenti).
- Che l'utente di sola lettura dell'archivio possa essere lo stesso per tutti i progetti di un PM.
- Quanto dura un accesso senza rinnovo e come si comporta il rinnovo dopo una lunga chiusura.
