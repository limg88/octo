import type { AgentProgress } from '@octo/application'
import type { CitationStatus } from '@octo/domain'
import type { ErrorCode } from '../shared/api.ts'

/** Every text the PM reads, in one place: a second language is a second file like this. */
export const messages = {
  appName: 'Octo',
  projects: 'Progetti',
  project: 'Progetto',
  addProject: 'Aggiungi un progetto…',
  close: 'Chiudi',
  cancel: 'Annulla',
  addDialog: {
    title: 'Aggiungi un progetto',
    existingTitle: 'Ho già una cartella',
    existingHint:
      'Scegli la cartella del progetto su questo computer. Octo la legge così com’è: non sposta e non cancella nulla.',
    existingChoose: 'Scegli la cartella…',
    newTitle: 'Parto da zero',
  },
  manage: {
    open: 'Gestisci i progetti…',
    title: 'I tuoi progetti',
    none: 'Nessun progetto in elenco.',
    remove: 'Togli da Octo',
    removeOf: (name: string) => `Togli ${name} da Octo`,
    confirmTitle: (name: string) => `Togliere «${name}» da Octo?`,
    confirmBody:
      'La cartella e tutto ciò che contiene restano dove sono. Anche le credenziali e il punto a cui sono arrivate le letture restano su questo computer: se aggiungi di nuovo la stessa cartella, il progetto torna com’era.',
    confirm: 'Togli',
    removed: (name: string) => `«${name}» non è più in elenco. La cartella è rimasta dov’è.`,
    undo: 'Rimettilo in elenco',
  },
  noProjectTitle: 'Nessun progetto',
  noProjectBody:
    'Un progetto è una cartella del tuo computer. Aggiungine una per fare domande su ciò che contiene.',
  projectShortcut: 'Con ⌘ o Ctrl e un numero passi al progetto in quella posizione.',
  ask: 'Chiedi',
  askPlaceholder: 'Chiedi qualcosa su questo progetto…',
  askSubmit: 'Chiedi',
  askCancel: 'Ferma',
  askEmpty: 'Fai la prima domanda: la risposta arriva con le fonti, controllate una per una.',
  working: 'Sto cercando nella memoria del progetto…',
  sources: 'Fonti',
  missing: 'Non trovato',
  openSource: 'Apri il file',
  modified: 'file del',
  allVerified: (count: number) =>
    count === 1 ? '1 fonte controllata' : `${count} fonti controllate`,
  noSources: 'Nessuna fonte citata',
  toCheck: (count: number) =>
    count === 1 ? '1 punto da controllare' : `${count} punti da controllare`,
  markerWithoutSource: (marker: number) => `Il richiamo [${marker}] non ha una fonte.`,
  sourcesTab: 'Fonti',
  mailTitle: 'Posta',
  mailIntro:
    'Octo legge la posta che Mail tiene su questo computer e scrive nel progetto le mail che lo riguardano, una per file. Non invia e non modifica nulla.',
  mailKeywords: 'Parole chiave, indirizzi o @dominio (uno per riga)',
  mailKeywordsHint: 'Una mail entra se ne contiene almeno una. Senza parole entrano tutte.',
  mailFolders: 'Cartelle di posta da leggere (una per riga)',
  mailFoldersHint: 'Vuoto: tutte, tranne bozze, cestino e posta indesiderata.',
  mailExclude: 'Mittenti da escludere (uno per riga)',
  mailSince: 'Dal giorno',
  mailTarget: 'Cartella nel progetto',
  mailKeepQuoted: 'Tieni anche i messaggi citati sotto ogni risposta',
  mailSave: 'Salva',
  mailSaved: 'Salvato. La prossima lettura riparte dal giorno indicato.',
  mailSync: 'Leggi ora',
  mailSyncing: 'Sto leggendo la posta…',
  mailNeverRead: 'Mai letta.',
  mailLastRun: (at: string, written: number, unchanged: number) =>
    `Ultima lettura ${at}: ${written} nuove, ${unchanged} già presenti.`,
  mailLastFailed: (at: string) => `Ultima lettura ${at} non riuscita.`,
  mailStale: 'La posta non viene letta da più di un giorno.',
  mailNotConfigured: 'La posta di questo progetto non è ancora configurata.',
  feedIntro: {
    ado: 'Work item del progetto, uno per file, letti con il tuo Personal Access Token di sola lettura (Work Items: Read, Project and Team: Read).',
    jira: 'Issue dei progetti indicati, una per file, lette con la tua email e un API token di sola lettura.',
    dwsi: 'Ore, ordini, fatture e ricavi delle commesse indicate, letti dal data warehouse con il tuo utente di sola lettura. La connessione resta su questo computer.',
  },
  feedSecret: { ado: 'Personal Access Token', jira: 'API token', dwsi: 'Password' },
  feedSecretKept: 'Già salvata su questo computer: lascia vuoto per tenerla.',
  feedSecretHint:
    'Resta su questo computer, cifrata dal sistema. Non finisce nella cartella del progetto.',
  feedSave: 'Prova e salva',
  feedSaved: 'Collegamento riuscito e salvato.',
  feedSync: 'Leggi ora',
  feedSyncing: 'Sto leggendo…',
  feedOff: 'Scollega',
  feedNotConfigured: 'Non collegato.',
  feedNeverRead: 'Mai letto.',
  feedLastRun: (at: string, written: number, unchanged: number) =>
    `Ultima lettura ${at}: ${written} aggiornati, ${unchanged} invariati.`,
  feedStale: 'Non viene letto da più di un giorno.',
  feedFields: {
    organization: 'Organizzazione',
    project: 'Progetto',
    areas: 'Aree (una per riga; vuoto: tutto il progetto)',
    site: 'Sito (es. contoso.atlassian.net)',
    email: 'La tua email su Jira',
    projects: 'Progetti (chiave o nome, uno per riga)',
    host: 'Server (nome, non indirizzo)',
    port: 'Porta',
    database: 'Database',
    user: 'Utente',
    ownerEmail: 'La tua email aziendale',
    projectCodes: 'Codici commessa (PRJ e sei cifre, uno per riga)',
    tls: 'Sicurezza della connessione',
    since: 'Dal giorno',
    targetFolder: 'Cartella nel progetto',
  },
  feedTls: {
    verify_full: 'Cifrata e verificata',
    unverified: 'Cifrata, certificato non verificato',
    plaintext: 'Non cifrata (solo rete interna)',
  },
  team: {
    title: 'Persone e calendario',
    intro:
      'Chi lavora al progetto e chi ne legge i risultati, e le date dei periodi. Octo li scrive anche come testo del progetto: risposte e deliverable li leggono e li citano. Chi non era sul progetto in un periodo non viene segnalato per le ore che mancano.',
    people: 'Persone: una riga ciascuna, «nome; ruolo; nostra o cliente; dal; al; come scrivergli»',
    peopleHint:
      'Solo il nome è obbligatorio. Le date sono giorno/mese/anno; vuote se la persona c’è dall’inizio o c’è ancora. Esempio: «Carla Bianchi; referente; cliente; ; ; dare del lei, prima la richiesta».',
    periods: 'Calendario: una riga per periodo o sprint, «nome; dal; al»',
    save: 'Salva persone e calendario',
    saved: (people: number, periods: number) => `Salvate ${people} persone e ${periods} periodi.`,
    sides: { supplier: 'nostra', client: 'cliente' },
  },
  backup: {
    title: 'Se cambi computer',
    save: 'Copia di sicurezza',
    restore: 'Ripristina',
    hint: 'La copia tiene l’elenco dei progetti e il punto a cui sono arrivate le letture. Le cartelle dei progetti vanno copiate a parte; le credenziali si rimettono.',
    saved: (file: string, projects: number) =>
      `Copia scritta in ${file}: ${projects === 1 ? '1 progetto' : `${projects} progetti`}. Le credenziali non ci sono: sul nuovo computer vanno rimesse.`,
    restored: (names: string[]) => `Ripristinati: ${names.join(', ')}.`,
    alreadyHere: (names: string[]) => `Già in elenco, lasciati come sono: ${names.join(', ')}.`,
    skipped: (names: string[]) =>
      `Non ripristinati perché la cartella non è su questo computer: ${names.join(', ')}. Copia la cartella e ripeti il ripristino.`,
    nothing: 'La copia non contiene progetti.',
    credentials: 'Rimetti le credenziali di Jira e Azure DevOps in «Fonti»: non sono nella copia.',
  },
  models: {
    title: 'Modelli',
    intro:
      'Quale modello di Claude risponde alle domande, scrive i deliverable e li rilegge in questo progetto. «Predefinito» è quello che Claude Code usa su questo computer: su un altro può essere diverso. Accanto a ogni risposta e a ogni deliverable resta scritto il modello che ha lavorato davvero.',
    task: {
      ask: 'Risposte in «Chiedi»',
      write: 'Scrittura dei deliverable',
      review: 'Rilettura critica dei deliverable',
    },
    byDefault: 'Predefinito di Claude Code',
    choice: { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' },
    save: 'Salva i modelli',
    saved: 'Modelli salvati: valgono dalla prossima domanda e dal prossimo deliverable.',
    used: (model: string) => `modello ${model}`,
    wroteAndReviewed: (write: string, review: string | null) =>
      review === null || review === write
        ? `modello ${write}`
        : `scritto da ${write}, riletto da ${review}`,
  },
  newProjectName: 'Nome del nuovo progetto',
  newProjectCreate: 'Scegli dove crearla…',
  newProjectHint:
    'Creo una cartella con questo nome, con un posto per contratti, documenti, riunioni e tracker.',
  askReady: [
    {
      label: 'Stato del periodo',
      question:
        'Qual è lo stato del periodo in corso? Che cosa è stato completato, che cosa è in corso e che cosa è in ritardo rispetto al piano, con le date dei dati che usi.',
    },
    {
      label: 'Blocchi e rischi',
      question:
        'Quali sono oggi i blocchi e i rischi aperti del progetto? Per ciascuno: da quando, chi ne è responsabile e che cosa serve per chiuderlo.',
    },
    {
      label: 'Posta da smaltire',
      question:
        'Quali mail degli ultimi sette giorni aspettano una mia risposta o una mia decisione? In ordine di urgenza, con mittente, data e che cosa mi viene chiesto.',
    },
    {
      label: 'Dopo la riunione',
      question:
        'Dall’ultima riunione del progetto: quali decisioni sono state prese, quali azioni sono state assegnate, a chi e per quando, e che cosa è rimasto aperto?',
    },
  ],
  askReadyTitle: 'Domande pronte',
  alignmentTab: 'Allineamento',
  alignment: {
    loading: 'Confronto i due tracker…',
    intro:
      'Confronto le voci del tracker del cliente in uno sprint con i ticket del tuo tracker. Una voce e un ticket sono collegati quando la voce porta fra i tag la chiave del ticket, oppure il titolo del ticket nomina l’id della voce, per esempio «[AZDO 123]». Leggo l’esportazione usata dal cruscotto e i ticket che Octo ha già letto: non scrivo in nessuno dei due tracker.',
    settings: 'Che cosa confronto',
    sprint: 'Sprint, come lo chiamano i due tracker',
    period: 'Periodo di pianificazione delle voci del cliente (vuoto: qualunque)',
    tags: 'Tag delle voci che sono della tua squadra (separati da virgola; vuoto: tutte)',
    exportPath:
      'Esportazione del tracker del cliente: file nel progetto (vuoto: quella del cruscotto)',
    ticketFolder: 'Cartella dei ticket nel progetto (vuoto: quella della fonte Jira)',
    referencePrefixes:
      'Che cosa precede l’id della voce nel titolo del ticket (separati da virgola), per esempio AZDO',
    stateGroups:
      'Stati che vogliono dire la stessa cosa: una riga per gruppo, «nome: stati del cliente = stati dei ticket»',
    stateGroupsHint:
      'Per esempio «in corso: In Progress, Active = In corso». Senza gruppi collego le voci ma non giudico gli stati.',
    save: 'Salva',
    summary: (total: number, linked: number, needsUpdate: number, missing: number) =>
      `${total} voci del cliente nello sprint: ${linked} con il ticket nello sprint, ${needsUpdate} con il ticket altrove, ${missing} senza ticket.`,
    adds: 'Quadratura: ogni voce è in una sola delle tre liste.',
    doesNotAdd: 'Le tre liste non sommano al totale: non usare questi numeri e segnalalo.',
    data: (exported: string, tickets: number) =>
      `Tracker del cliente letto il ${exported}; ${tickets} ticket letti dal tuo tracker.`,
    noDate: 'data non dichiarata',
    linkedTitle: 'Collegate',
    needsUpdateTitle: 'Ticket da spostare nello sprint',
    missingTitle: 'Senza ticket',
    duplicatesTitle: 'Voci con più di un ticket',
    orphansTitle: 'Ticket che nominano una voce che non c’è',
    suggestionsTitle: 'Forse sono la stessa cosa',
    suggestionsIntro:
      'Titoli che si somigliano fra voci senza ticket e ticket senza riferimento. Non li collego da solo: se è così, aggiungi l’id della voce al titolo del ticket.',
    unreferencedTitle: 'Ticket dello sprint senza riferimento a una voce',
    columnItem: 'Voce',
    columnTitle: 'Titolo',
    columnTicket: 'Ticket',
    columnStates: 'Stato cliente → stato ticket',
    columnCoherent: 'Stati',
    columnTicketSprint: 'Sprint del ticket',
    columnType: 'Tipo',
    columnState: 'Stato',
    columnIds: 'Voci nominate',
    columnReason: 'Perché',
    columnScore: 'Somiglianza',
    coherent: { yes: 'Coerenti', no: 'Diversi', unknown: '—' },
    noSprint: 'nessuno',
    reason: {
      unknown: 'Il tracker del cliente non ha questa voce',
      out_of_scope: 'La voce esiste, ma fuori dallo sprint o dai tag indicati',
    },
    confidence: { high: 'alta', medium: 'media' },
    none: 'Nessuna.',
    exportMissing: 'Scrivi il file di import dei ticket mancanti',
    exported: (rows: number, path: string) =>
      `Scritto ${path} con ${rows} ticket da creare. L’import lo fai tu dal tuo tracker.`,
    open: 'Apri il file',
  },
  progressTab: 'Avanzamento',
  progress: {
    loading: 'Preparo l’avanzamento…',
    intro:
      'Compilo il modulo con cui si chiede al cliente di riconoscere una quota dell’ordine: una richiesta per fattura. Le percentuali per posizione vengono dagli importi dell’ordine e delle richieste che scrivi qui: nessuna cifra è presa altrove. Scrivo una copia del modulo: quello vuoto non lo tocco.',
    orderTitle: 'Ordine e richieste',
    order: 'Ordine, come lo nomina il modulo',
    total: 'Totale dichiarato dall’ordine (per controllo)',
    positions: 'Posizioni dell’ordine: una riga per posizione, «codice; importo»',
    requestsTitle: 'Richieste, in ordine di tempo',
    requestN: (n: number) => `Richiesta ${n}`,
    from: 'Dal',
    to: 'Al',
    amount: 'Importo della richiesta',
    requestPositions:
      'Solo su queste posizioni (separate da virgola; vuoto: a partire dalla prima)',
    note: 'Annotazione',
    addRequest: 'Aggiungi una richiesta',
    removeRequest: (n: number) => `Togli la richiesta ${n}`,
    save: 'Salva',
    formTitle: 'Il modulo del cliente',
    modelPath: 'Modulo vuoto: file Excel nella cartella del progetto',
    fields: 'Che cosa va in ogni cella: una riga per cella, «cella = testo»',
    fieldsHint:
      'Nel testo puoi usare {n} (numero della richiesta), {ordine}, {posizioni}, {dal}, {al}, {al_precedente}, {nota}. Tutto il resto è scritto com’è.',
    table:
      'Tabella delle posizioni: «prima riga; numero di righe; colonna posizione; precedente; attuale; di periodo»',
    columnPosition: 'Posizione',
    columnAmount: 'Importo',
    columnPrevious: 'Precedente',
    columnCurrent: 'Attuale',
    columnPeriod: 'Di periodo',
    share: (value: number) =>
      `${(value * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
    money: (value: number) =>
      value.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: 'always',
      }),
    summary: (period: string, amount: string, cumulative: string, total: string) =>
      `${period}: ${amount}, in tutto ${cumulative} su ${total}`,
    period: (from: string, to: string) => `dal ${from || '…'} al ${to || '…'}`,
    closing: 'Raggiunge il totale dell’ordine: tutte le posizioni chiudono al 100%.',
    drift: (amount: string) =>
      `Le percentuali, arrotondate a due decimali, ricostruiscono ${amount} in più o in meno dell’importo chiesto: il modulo non ha importi, lo scarto non si può togliere.`,
    noRequests: 'Nessuna richiesta: aggiungine una.',
    problem: {
      no_positions: 'Scrivi le posizioni dell’ordine con i loro importi.',
      over_total: (n: number, excess: string) =>
        `La richiesta ${n} porta il totale chiesto ${excess} oltre il totale dell’ordine.`,
      unknown_positions: (n: number, codes: string) =>
        `La richiesta ${n} nomina posizioni che l’ordine non ha: ${codes}.`,
      over_positions: (n: number, excess: string) =>
        `La richiesta ${n} supera di ${excess} quello che resta sulle posizioni che nomina.`,
    },
    warning: {
      total_differs: (declared: string, positions: string) =>
        `Le posizioni sommano ${positions}, l’ordine dichiara ${declared}: controlla gli importi.`,
      dates_missing: (n: number) => `Richiesta ${n}: mancano le date.`,
      dates_not_chained: (n: number) =>
        `Richiesta ${n}: «Dal» non è l’«Al» della richiesta precedente.`,
      note_missing: (n: number) =>
        `Richiesta ${n}: manca l’annotazione (la fattura a cui si riferisce).`,
    },
    compile: (n: number) => `Compila il modulo della richiesta ${n}`,
    compiled: (path: string) => `Modulo compilato in ${path}. Quello vuoto non è stato toccato.`,
    open: 'Apri il file',
  },
  forecastTab: 'Previsionale',
  forecast: {
    loading: 'Preparo il previsionale…',
    setupTitle: 'Il modello dell’amministrazione',
    setupIntro:
      'Compilo il previsionale mensile sul file Excel che l’amministrazione manda: una riga per codice di progetto. I costi interni vengono dal costo che NetSuite scrive su ogni riga di timesheet approvata; i ricavi dalle stesse ore e dalle tariffe al giorno che indichi qui. Scrivo una copia: il file originale non lo tocco.',
    modelPath: 'Modello: file Excel nella cartella del progetto',
    hoursPerDay: 'Ore in una giornata',
    rates:
      'Tariffe al giorno: una riga per persona, «nome; tariffa», oppure «nome; commessa; tariffa» se vale solo su una commessa',
    ratesHint:
      'Le persone e il costo delle loro ore arrivano dai timesheet di NetSuite: qui scrivi solo a quanto vendi una giornata. La tariffa scritta per una commessa vince su quella generale della persona. Chi ha ore e nessuna tariffa compare fra i dati che mancano.',
    externalRates:
      'Esterni senza timesheet: una riga per persona e commessa, «nome; commessa; costo al giorno; tariffa al giorno»',
    externalRatesHint:
      'Le ore le scrivi ogni mese, nei dati del mese della commessa. Tariffe e costi restano in una cartella di Octo che non entra nelle risposte né nei deliverable.',
    save: 'Salva',
    settings: 'Impostazioni del previsionale',
    month: 'Mese',
    columnCode: 'Codice',
    columnInternal: 'Costi interni',
    columnExternal: 'Costi esterni',
    columnRevenue: 'Ricavi',
    columnQuantity: 'Giorni o %',
    columnMarginMonth: 'Margine del mese',
    columnMarginEnd: 'Margine a fine progetto',
    columnToInvoice: 'Da fatturare',
    columnNote: 'Note',
    noRows: 'Il modello non elenca codici di progetto.',
    money: (value: number) =>
      value.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: 'always',
      }),
    days: (value: number) => value.toLocaleString('it-IT', { maximumFractionDigits: 3 }),
    share: (value: number | null) =>
      value === null
        ? '—'
        : `${(value * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`,
    hours: (value: number) => value.toLocaleString('it-IT', { maximumFractionDigits: 1 }),
    gapsTitle: 'Dati che mancano',
    gapsIntro: 'Dove manca un dato lascio la cella vuota o fuori dal calcolo: non stimo nulla.',
    noGaps: 'Nessun dato mancante.',
    gap: {
      no_cost: (code: string, person: string, hours: string) =>
        `${code}: i timesheet non hanno il costo di ${hours} ore di ${person} (fuori dai costi). Rileggi i timesheet da NetSuite.`,
      no_rate: (code: string, person: string, hours: string) =>
        `${code}: manca la tariffa al giorno di ${person} (${hours} ore a costo, senza ricavo)`,
      no_external_rate: (code: string, person: string, hours: string) =>
        `${code}: mancano costo e tariffa dell’esterno ${person} su questa commessa (${hours} ore fuori dal calcolo)`,
      no_total_costs: (code: string) =>
        `${code}: mancano i costi totali previsti, il margine a fine progetto resta vuoto`,
      no_ordered: (code: string) =>
        `${code}: nel modello manca l’ordinato, i ricavi da avanzamento restano a zero`,
    },
    notApproved: (hours: string) =>
      `${hours} ore del mese non ancora approvate: restano fuori dal previsionale`,
    otherCodes: (codes: string) =>
      `Nei timesheet del mese ci sono ore su codici che il modello non elenca: ${codes}`,
    inputsTitle: (code: string) => `Dati del mese per ${code}`,
    externals: 'Ore degli esterni nel mese: una riga per persona, «nome; ore»',
    toInvoice: 'Importo da fatturare nel mese',
    revenue: 'Ricavi decisi da te (sostituiscono quelli calcolati)',
    budgetCosts: 'A corpo: costi totali a budget (l’avanzamento è costi del mese su questi)',
    totalCosts: 'Costi totali previsti del progetto (per il margine a fine progetto)',
    totalCostsBeforeMonth:
      'I costi totali si fermano al mese prima: aggiungi quelli di questo mese',
    note: 'Nota da aggiungere',
    saveInputs: 'Salva i dati del mese',
    compile: 'Compila il modello',
    compiling: 'Scrivo il file…',
    compiled: (path: string) => `Modello compilato in ${path}. L’originale non è stato toccato.`,
    open: 'Apri il file',
    internal: 'Documento interno: costi e margini non vanno al cliente.',
  },
  hoursTab: 'Ore',
  hours: {
    loading: 'Leggo le ore…',
    setupTitle: 'Da dove leggo le ore',
    setupIntro:
      'Confronto le ore approvate dei timesheet con le ore segnate sul tracker, persona per persona. Le leggo io da NetSuite e da Jira con i pulsanti qui sotto, oppure indichi due esportazioni che hai già nella cartella del progetto. Non scrivo in nessun sistema.',
    timesheetPath: 'Timesheet: file o cartella delle esportazioni (JSON)',
    worklogPath: 'Ore del tracker: file o cartella delle esportazioni (CSV)',
    worklogHint:
      'Va bene l’esportazione dello strumento con cui si segnano le ore sul tracker: servono le colonne persona, data e ore.',
    projects: 'Codici di progetto dei timesheet che sono di questo progetto (nessuno: tutti)',
    threshold: 'Scostamento oltre il quale una persona è da guardare (%)',
    cutoff: 'Ultimo giorno completo (i giorni dopo restano fuori dal confronto; vuoto: nessuno)',
    noWorklogExpected: 'Persone che non segnano ore sul tracker (separate da virgola)',
    noTimesheetExpected: 'Persone senza timesheet qui, per esempio esterni (separate da virgola)',
    aliases:
      'Stessa persona, nomi diversi: una riga per persona, «nome sul tracker = nome nel timesheet»',
    save: 'Salva',
    settings: 'Impostazioni delle ore',
    month: 'Mese',
    from: 'Dal',
    to: 'Al',
    columnPerson: 'Persona',
    columnTimesheet: 'Timesheet (h)',
    columnWorklog: 'Tracker (h)',
    columnDelta: 'Scostamento',
    columnStatus: 'Stato',
    total: 'Totale',
    noRows: 'Nessuna ora nel periodo.',
    pct: (value: number | null) => (value === null ? '—' : `${value.toLocaleString('it-IT')}%`),
    amount: (value: number) => value.toLocaleString('it-IT', { maximumFractionDigits: 2 }),
    status: {
      ok: 'Torna',
      outlier: 'Da guardare',
      no_worklog: 'Nessuna ora sul tracker',
      no_timesheet: 'Nessun timesheet',
      expected: 'Atteso',
    },
    markExpected: 'È atteso',
    markExpectedHint: 'Da ora la mancanza di ore di questa persona non è più segnalata.',
    tieOutOk: (hours: string) => `Quadratura: ${hours} ore approvate, tutte nel confronto`,
    tieOutFailed: (approved: string, accounted: string) =>
      `Quadratura fallita: ${approved} ore approvate, ${accounted} nel confronto. Non usare questi numeri.`,
    sources: (timesheets: number, worklogs: number) =>
      `Letti ${timesheets} file di timesheet e ${worklogs} di ore del tracker`,
    lastDays: (timesheet: string, worklog: string) =>
      `Ultimo giorno con ore: timesheet ${timesheet}, tracker ${worklog}`,
    noDay: 'nessuno',
    excludedTitle: 'Rimasto fuori dal confronto',
    notApproved: (hours: string) => `${hours} ore di timesheet non ancora approvate`,
    partial: (timesheet: string, worklog: string) =>
      `Dopo l’ultimo giorno completo: ${timesheet} ore di timesheet e ${worklog} del tracker`,
    otherProject: (project: string, hours: string) =>
      `${hours} ore sul codice ${project || 'senza codice'}, che non è fra quelli del progetto`,
    unreadable: (path: string) => `Non è un’esportazione che so leggere: ${path}`,
    nothingExcluded: 'Niente.',
    possibleDuplicate: (hours: string, first: string, second: string) =>
      `Possibili ore contate due volte: ${hours} ore uguali per persona e giorno sui codici ${first} e ${second}. Succede quando le ore sono state spostate da un codice all’altro e nella cartella resta un’esportazione vecchia: controlla e togli il file o il codice superato.`,
    codesFound: 'Codici trovati nel periodo',
    timesheetsTitle: 'Timesheet da NetSuite',
    timesheetsIntro:
      'Leggo le ore dei timesheet delle commesse indicate in «Fonti», con il tuo utente di sola lettura, per i mesi interi del periodo. Le tengo in un file del progetto per mese e da lì le confronto. Il costo di ogni riga serve al previsionale: lo tengo a parte, in una cartella che non entra nelle risposte né nei deliverable.',
    readTimesheets: 'Leggi i timesheet da NetSuite',
    readingTimesheets: 'Leggo i timesheet da NetSuite…',
    timesheetsRead: (entries: number, months: string, when: string) =>
      `Lette ${entries} righe di timesheet (${months}) alle ${when}`,
    trackerTitle: 'Ore da Jira',
    trackerIntro:
      'Leggo le ore segnate sulle issue dei progetti Jira indicati in «Fonti», con il tuo token di sola lettura, per i mesi interi del periodo. Le tengo in un file del progetto e da lì le confronto. Di ogni registrazione tengo solo persona, giorno, ore e issue.',
    readTracker: 'Leggi le ore da Jira',
    readingTracker: 'Leggo le ore da Jira…',
    trackerRead: (entries: number, months: string, when: string) =>
      `Lette ${entries} registrazioni di ore (${months}) alle ${when}`,
  },
  dashboardTab: 'Cruscotto',
  dashboard: {
    loading: 'Leggo l’esportazione del tracker…',
    setupTitle: 'Da dove leggo bug e requisiti',
    setupIntro:
      'Il cruscotto si calcola da un’esportazione del tracker tenuta nella cartella del progetto: la leggo io da Azure DevOps qui sotto, oppure indichi un file che hai già. Non scrivo mai nel tracker.',
    trackerTitle: 'Leggi da Azure DevOps',
    trackerIntro:
      'Leggo adesso i work item del progetto e delle aree indicati in «Fonti», con il tuo Personal Access Token di sola lettura, e per i bug anche i cambi di stato e i commenti. Li tengo in un file del progetto e il cruscotto si calcola da lì. Può volerci qualche minuto.',
    readTracker: 'Leggi da Azure DevOps',
    readingTracker: 'Sto leggendo Azure DevOps…',
    trackerRead: (items: number, withHistory: number, when: string) =>
      `Letti ${items} work item, ${withHistory} con la cronologia, alle ${when}`,
    exportPath: 'File dell’esportazione',
    historyPath: 'File della cronologia (facoltativo)',
    historyHint: 'Con la cronologia l’andamento segue i cambi di stato veri; senza, è una stima.',
    noCandidates: 'Nessuna esportazione trovata nella cartella: scrivi il percorso a mano.',
    choose: 'Scegli…',
    none: 'Nessuno',
    tags: 'Solo gli elementi con questi tag (separati da virgola; vuoto: tutti)',
    stuckDays: 'Giorni nello stesso stato dopo i quali un bug è «fermo»',
    periods: 'Periodi di pianificazione da controllare per i requisiti (nessuno: tutti)',
    handover:
      'Stati in cui la correzione passa a chi la verifica (nessuno: tutta la fase di verifica)',
    phasesTitle: 'Come leggo gli stati dei bug',
    phasesHint: 'La fase è proposta dal nome dello stato: correggila dove non torna.',
    save: 'Salva',
    settings: 'Impostazioni del cruscotto',
    exportedAt: (when: string) => `Tracker letto il ${when}`,
    exportedUnknown: 'L’esportazione non dice quando è stata fatta',
    age: {
      fresh: 'Dati aggiornati',
      warning: 'Dati di oltre 24 ore',
      stale: 'Dati di oltre 3 giorni: aggiorna l’esportazione prima di usarli',
      unknown: 'Età dei dati non nota',
    },
    rangeTitle: 'Periodo',
    presets: { w8: '8 settimane', m3: '3 mesi', m6: '6 mesi', y1: '12 mesi', custom: 'Scelgo io' },
    from: 'Dal',
    to: 'Al',
    granularity: 'Passo',
    week: 'Settimana',
    month: 'Mese',
    open: 'Bug aperti',
    work: 'In lavorazione',
    verify: 'In verifica',
    validated: 'Validati, in attesa di rilascio',
    closed: 'Chiusi',
    stuck: (days: number) => `Fermi da oltre ${days} giorni`,
    total: (count: number) => `su ${count} bug nel perimetro`,
    trendTitle: 'Andamento',
    trendApproximate:
      'Senza cronologia: entrati alla data di creazione, chiusi alla data dell’ultimo cambio di stato.',
    stepFrom: 'Dal',
    entered: 'Entrati',
    closedInStep: 'Usciti',
    openAtEnd: 'Aperti a fine periodo',
    flowTitle: 'Dove si fermano i bug',
    flowIntro: 'Mediana in giorni, sui bug passati in verifica nel periodo.',
    toVerify: 'Dall’apertura alla verifica',
    toValidated: 'Dalla verifica alla validazione',
    toClosed: 'Dalla validazione alla chiusura',
    days: (value: number | null) => (value === null ? '—' : `${value} gg`),
    sample: (count: number) => `${count} bug`,
    openTitle: 'Bug aperti',
    noOpen: 'Nessun bug aperto nel perimetro.',
    columnId: 'Id',
    columnTitle: 'Titolo',
    columnState: 'Stato',
    columnAssignee: 'Assegnato a',
    columnDays: 'Giorni nello stato',
    columnNote: 'Nota o ultimo commento',
    columnPeriod: 'Periodo',
    columnSignals: 'Segnali',
    unassigned: 'Non assegnato',
    stuckBadge: 'Fermo',
    yourNote: 'Nota tua',
    addNote: 'Scrivi una nota',
    noteLabel: (id: string) => `Nota su ${id}`,
    saveNote: 'Salva la nota',
    cancel: 'Annulla',
    requirementsTitle: 'Requisiti poco chiari',
    noRequirements: 'Nessun requisito con segnali nel perimetro.',
    markClear: 'È chiaro',
    markClearHint: 'Toglie il requisito dall’elenco; la decisione resta scritta con la data.',
    removeSignal: (signal: string) => `Togli ${signal}`,
    signals: {
      S1: 'Non ancora raffinato',
      S2: 'Criteri di accettazione assenti',
      S3: 'Descrizione minima',
      S4: 'Sospeso o bloccato',
      S5: 'Punti da chiarire nel testo',
    } as Record<string, string>,
    phase: {
      work: 'Lavorazione',
      verify: 'Verifica',
      validated: 'Validato',
      closed: 'Chiuso',
    },
  },
  deliverablesTab: 'Deliverable',
  deliverableNew: 'Nuovo deliverable',
  ownKindNew: 'Crea un tipo tuo',
  ownKindBadge: 'Tuo',
  ownKindIntro:
    'Descrivi a parole un deliverable che prepari spesso: Octo lo aggiunge al catalogo di questo progetto e lo scrive con gli stessi controlli degli altri.',
  ownKindTitle: 'Come si chiama',
  ownKindSummary: 'A che cosa serve (una riga)',
  ownKindAudience: 'Chi lo legge',
  ownKindQuestions:
    'Che cosa chiederti prima di scriverlo (una domanda per riga; * in fondo se è obbligatoria)',
  ownKindInstructions: 'Come va scritto',
  ownKindInstructionsHint:
    'Struttura, tono, che cosa non deve mai mancare, che cosa non va mai detto. Puoi incollare qui le istruzioni che usi già.',
  ownKindChecklist: 'Che cosa controllare prima di approvare (una voce per riga)',
  ownKindSave: 'Salva nel catalogo',
  ownKindEdit: 'Modifica',
  ownKindRemove: 'Elimina',
  letterheadTitle: 'Carta intestata',
  letterheadNone: 'Nessuna: i file Word escono su pagina bianca.',
  letterheadSet: 'Impostata: i file Word escono sulla tua carta intestata.',
  letterheadHint:
    'Scegli un documento Word con intestazione e piè di pagina. Octo ne tiene una copia nel progetto e ci scrive dentro solo il testo.',
  letterheadChoose: 'Scegli un documento Word',
  letterheadRemove: 'Togli',
  deckModelTitle: 'Modello delle presentazioni',
  deckModelNone: 'Nessuno: lo stato di avanzamento esce solo come testo e Word.',
  deckModelSet: 'Impostato: lo stato di avanzamento approvato esce anche come presentazione.',
  deckModelHint:
    'Scegli una presentazione già fatta per questo cliente, per esempio quella del periodo scorso. Octo ne tiene una copia nel progetto e ne segue la scaletta: le stesse slide, con testi e tabelle aggiornati al periodo che chiedi. Dove il progetto non ha dati la slide viene tolta o la cella resta vuota, e te lo dice: non resta mai un numero del periodo scorso.',
  deckModelChoose: 'Scegli una presentazione',
  deliverableRegister: 'Registro',
  deliverableRegisterIntro:
    'Che cosa è costato ogni deliverable: minuti di scrittura, minuti di revisione e giri. Una pausa oltre 20 minuti non conta come revisione.',
  deliverableRegisterEmpty: 'Ancora nessun deliverable.',
  deliverableRegisterHead: [
    'Data',
    'Tipo',
    'Oggetto',
    'Stato',
    'Scrittura (min)',
    'Revisione (min)',
    'Giri',
  ],
  deliverableRegisterTotals: (count: number, draft: number, review: number, rounds: number) =>
    `Approvati: ${count} · scrittura ${draft} min · revisione ${review} min · ${rounds} giri.`,
  deliverableNone: 'Nessun deliverable ancora. Scegline uno dal catalogo.',
  deliverableChoose: 'Che cosa vuoi preparare?',
  deliverableFor: { client: 'Per il cliente', internal: 'Interno' },
  deliverableWrite: 'Scrivi la bozza',
  deliverableWriting:
    'Sto scrivendo la bozza: leggo il progetto, controllo le fonti, la rileggo come farebbe chi la riceve…',
  deliverableStatus: {
    writing: 'In scrittura',
    review: 'Da rivedere',
    approved: 'Approvato',
    failed: 'Non riuscito',
  },
  deliverableProjectInstructions: 'Istruzioni di questo progetto per questo deliverable',
  deliverableProjectInstructionsHint:
    'Valgono per tutte le prossime volte: per esempio a chi dare del lei, che cosa non dire mai, come chiudere.',
  deliverableInstructionsSave: 'Salva le istruzioni',
  deliverableInstructionsSaved: 'Istruzioni salvate.',
  deliverableClientFilter: 'Cifre da controllare prima che esca',
  deliverableClientFilterIntro:
    'Questo testo va al cliente. Il codice ha trovato giornate di lavoro o importi: controlla che siano già concordati con il cliente e non dati interni. Non tolgo nulla da solo.',
  deliverableClientFilterKind: { effort: 'Giornate', money: 'Importo' },
  deliverableRedTeam: 'Rilettura critica',
  deliverableRedTeamOk: 'Può uscire: nessun punto contestabile trovato.',
  deliverableRedTeamFix: 'Da correggere prima di farlo uscire.',
  deliverableHolds: 'Che cosa regge',
  deliverableSeverity: { grave: 'Grave', media: 'Media', lieve: 'Lieve' },
  deliverableChecklist: 'Da controllare prima di approvare',
  deliverableChange: 'Che cosa vuoi cambiare?',
  deliverableChangeSubmit: 'Chiedi modifica',
  deliverableApprove: 'Approva',
  deliverableFiles: 'File pronti',
  deliverableFailed: 'La scrittura non è riuscita.',
  deliverableLastChangeFailed: 'L’ultima modifica non è riuscita: la bozza è rimasta com’era.',
  deliverableCost: (draft: number, review: number, rounds: number) =>
    `Scrittura ${draft} min · Revisione ${review} min · ${rounds === 1 ? '1 giro' : `${rounds} giri`}`,
  deliverableSourcesNote:
    'I numeri fra parentesi rimandano alle fonti: spariscono dal file approvato.',
  guideTitle: 'Avvio del progetto',
  guideIntro:
    'Collega ciò che alimenta la memoria di questo progetto. Ogni passo è facoltativo: puoi tornarci quando vuoi.',
  guideDone: 'fatto',
  guideTodo: 'da fare',
  guideSteps: {
    mail: 'Posta: quali mail riguardano il progetto',
    ado: 'Azure DevOps: work item del progetto',
    jira: 'Jira: issue del progetto',
    dwsi: 'NetSuite: ore, ordini e fatture delle commesse',
    documents: 'Documenti della cartella resi leggibili (automatico)',
  },
  guideFill: 'Riempi la memoria ora',
  guideFilling: 'Sto leggendo tutte le fonti collegate…',
  guideStep: (label: string, written: number, unchanged: number) =>
    `${label}: ${written} nuovi o aggiornati, ${unchanged} invariati.`,
  guideStepFailed: (label: string) => `${label}: non riuscito.`,
  guideSources: {
    mail: 'Posta',
    ado: 'Azure DevOps',
    jira: 'Jira',
    dwsi: 'NetSuite',
    documents: 'Documenti',
  },
  guideAsk: 'Fatto. Ora puoi fare domande nella scheda «Chiedi».',
  mailPreview: 'Anteprima',
  mailPreviewing: 'Sto cercando nella posta…',
  mailPreviewCount: (count: number) =>
    count === 1
      ? '1 mail entrerebbe con queste regole.'
      : `${count} mail entrerebbero con queste regole.`,
  mailPreviewNewest: 'Le più recenti:',
  feedChoices: 'Cerca progetti e aree',
  feedChoicesProjects: 'Progetti che vedi (clic per scegliere):',
  feedChoicesAreas: 'Aree del progetto (clic per aggiungere):',
  feedChoicesNone: 'Nessun progetto visibile con questa credenziale.',
  documentsTitle: 'Documenti',
  documentsIntro:
    'Octo scrive il testo di Word, Excel, PowerPoint e PDF della cartella in «_octo/testo», così Claude può cercarlo e citarlo. Gli originali non vengono toccati.',
  documentsConvert: 'Converti ora',
  documentsConverting: 'Sto leggendo i documenti…',
  documentsNever: 'Mai convertiti.',
  documentsLastRun: (at: string, written: number, unchanged: number) =>
    `Ultima conversione ${at}: ${written} aggiornati, ${unchanged} già pronti.`,
  agentMissingTitle: 'Claude non è installato su questo computer',
  agentMissingBody:
    'Octo usa Claude Code con il tuo account. Installalo, accedi una volta dal terminale con «claude» e riapri Octo.',
  agentReady: (version: string) => `Claude ${version}`,
} as const

const citationStatus: Record<CitationStatus, string> = {
  verified: 'Controllata',
  quote_not_found: 'La frase non è nel file',
  quote_too_short: 'Frase troppo breve per valere come prova',
  file_not_found: 'File non trovato',
  file_too_large: 'File troppo grande per il controllo',
  outside_project: 'File fuori dal progetto',
}

const errors: Record<ErrorCode, string> = {
  empty_question: 'Scrivi una domanda.',
  project_not_found: 'Questo progetto non è più in elenco.',
  project_already_added: 'Questa cartella è già fra i tuoi progetti.',
  folder_not_readable: 'Non riesco a leggere questa cartella.',
  agent_not_installed: 'Claude non è installato su questo computer.',
  agent_not_signed_in:
    'Claude non ha un accesso attivo: apri il terminale, scrivi «claude» e accedi.',
  agent_failed: 'Claude non ha risposto. Riprova fra poco.',
  agent_limit_reached:
    'Hai raggiunto il limite d’uso del tuo account Claude. Riprova quando il limite si azzera.',
  agent_output_invalid: 'La risposta di Claude non era leggibile. Riprova.',
  agent_cancelled: 'Domanda fermata.',
  source_not_configured: 'Questa fonte non è ancora configurata.',
  source_config_invalid: 'Controlla il giorno di inizio e la cartella: uno dei due non è valido.',
  source_busy: 'Una lettura è già in corso.',
  mail_archive_unreadable:
    'Non riesco a leggere la posta di Mail. In Impostazioni di Sistema › Privacy e sicurezza › Accesso completo al disco, abilita Octo e riaprilo.',
  mail_reader_missing: 'Su questo sistema la lettura della posta non è ancora disponibile.',
  secret_missing: 'Serve la credenziale: su questo computer non ce n’è una salvata.',
  secret_store_unavailable:
    'Questo computer non offre un archivio sicuro per le credenziali: non posso salvarla.',
  feed_credential_refused:
    'Il sistema ha rifiutato la credenziale: è sbagliata, scaduta o senza i permessi di lettura.',
  feed_write_access_refused:
    'Questa credenziale può anche scrivere o vede più del necessario. Octo accetta solo credenziali di sola lettura.',
  feed_connection_not_secure: 'La connessione al sistema non è sicura come dichiarato: rifiutata.',
  feed_unreachable: 'Il sistema non risponde. Controlla rete e VPN e riprova.',
  feed_not_found:
    'Non trovo ciò che hai indicato: controlla nomi di organizzazione, progetto, aree o codici.',
  feed_failed:
    'La lettura non è riuscita. Riprova; se si ripete, il sistema ha risposto in modo inatteso.',
  secret_value_invalid: 'La credenziale non è valida: controlla di averla copiata per intero.',
  private_host_invalid: 'Il nome del server non è valido: serve un nome, non un indirizzo.',
  private_host_unknown: 'Questo server non è fra quelli ammessi.',
  private_host_duplicate: 'Questo server è già in elenco.',
  private_hosts_too_many: 'Troppi server in elenco.',
  private_host_ca_invalid: 'Il certificato dell’autorità non è leggibile.',
  private_host_ca_too_long: 'Il certificato dell’autorità è troppo lungo.',
  private_host_ca_not_verified: 'Il certificato del server non è stato verificato.',
  deliverable_input_missing: 'Manca un campo obbligatorio.',
  deliverable_kind_unknown: 'Questo tipo di deliverable non esiste più.',
  deliverable_kind_invalid: 'Servono un titolo e le istruzioni; le domande sono al massimo otto.',
  deliverable_not_found: 'Questo deliverable non c’è più.',
  deliverable_not_ready: 'Questo deliverable non è in revisione.',
  deliverable_busy: 'Sto già scrivendo questo deliverable.',
  request_empty: 'Scrivi che cosa vuoi cambiare.',
  tracker_export_not_set: 'Scegli il file dell’esportazione del tracker.',
  tracker_export_missing: 'Il file dell’esportazione non c’è più nella cartella del progetto.',
  tracker_export_unreadable: 'Questo file non è un’esportazione del tracker che so leggere.',
  dashboard_range_invalid: 'Il periodo non è valido o è troppo lungo per il passo scelto.',
  hours_sources_not_set: 'Indica dove sono i timesheet e le ore del tracker.',
  hours_timesheet_missing: 'Non trovo esportazioni di timesheet (file .json) nel posto indicato.',
  hours_worklog_missing:
    'Non trovo esportazioni delle ore del tracker (file .csv) nel posto indicato.',
  hours_period_invalid: 'Il periodo non è valido.',
  forecast_model_not_set: 'Indica il file Excel del modello.',
  forecast_model_missing: 'Non trovo il file del modello nel posto indicato.',
  forecast_model_invalid:
    'Il file non è il modello del previsionale: non trovo le intestazioni attese (codice di progetto, ordinato, previsione costi e ricavi, marginalità, importo da fatturare, note).',
  forecast_month_invalid: 'Il mese non è valido.',
  forecast_settings_invalid:
    'Le impostazioni del previsionale non sono valide: il modello deve stare nella cartella del progetto.',
  alignment_sprint_not_set: 'Indica lo sprint da confrontare.',
  alignment_items_missing:
    'Indica il file di esportazione del tracker del cliente, qui o nella scheda «Cruscotto».',
  alignment_tickets_missing:
    'Non trovo ticket da confrontare: configura Jira in «Fonti» e leggi i ticket, oppure indica la cartella dove sono.',
  alignment_settings_invalid:
    'Le impostazioni dell’allineamento non sono valide: la cartella dei ticket deve stare nel progetto.',
  progress_model_not_set: 'Indica il file Excel del modulo vuoto.',
  progress_model_missing: 'Non trovo il file del modulo nel posto indicato.',
  progress_model_invalid:
    'Non riesco a scrivere nel modulo: non è un file Excel leggibile, o una cella indicata sta su una riga che il modulo non ha.',
  progress_settings_invalid:
    'Le impostazioni dell’avanzamento non sono valide: il modulo deve stare nella cartella del progetto.',
  progress_not_computable:
    'Le percentuali non si possono calcolare, o le posizioni sono più delle righe della tabella del modulo: correggi i dati segnalati.',
  progress_request_missing: 'Questa richiesta non c’è più.',
  forecast_timesheet_not_set: 'Indica prima, nella scheda «Ore», dove sono i timesheet.',
  hours_settings_invalid:
    'Le impostazioni delle ore non sono valide: i percorsi devono stare dentro la cartella del progetto.',
  dashboard_settings_invalid: 'Le impostazioni del cruscotto sono rovinate: salvale di nuovo.',
  team_invalid: 'Le persone e il calendario del progetto non sono leggibili.',
  project_name_invalid:
    'Questo nome non può essere il nome di una cartella: togli i caratteri speciali e non iniziare con un punto.',
  backup_invalid: 'Questo file non è una copia di sicurezza di Octo, o è rovinato.',
  backup_not_written: 'Non riesco a scrivere la copia lì: scegli un altro posto.',
  project_folder_exists:
    'Lì c’è già una cartella con questo nome: scegli un altro nome o un altro posto.',
  deck_model_invalid:
    'Questo file non è una presentazione che posso usare come modello: serve almeno una slide, dopo la copertina, con un titolo.',
  letterhead_invalid: 'Questo file non è un documento Word che posso usare come carta intestata.',
  unexpected: 'Qualcosa non ha funzionato. Riprova.',
}

const progress: Record<AgentProgress['kind'], string> = {
  reading: 'Leggo',
  searching: 'Cerco',
  listing: 'Guardo i file',
  writing: 'Scrivo la risposta',
}

export const citationStatusText = (status: CitationStatus): string => citationStatus[status]
export const errorText = (code: ErrorCode): string => errors[code]
export const progressText = (step: AgentProgress): string =>
  step.target ? `${progress[step.kind]} ${step.target}` : progress[step.kind]

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' })
const TIME_FORMAT = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' })

export const dateText = (iso: string): string => DATE_FORMAT.format(new Date(iso))
export const dateTimeText = (iso: string): string => TIME_FORMAT.format(new Date(iso))
