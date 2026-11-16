import type { AgentProgress } from '@octo/application'
import type { CitationStatus } from '@octo/domain'
import type { ErrorCode } from '../shared/api.ts'

/** Every text the PM reads, in one place: a second language is a second file like this. */
const MINUTES_IN_HOUR = 60

/** How far ahead something is, in hours and minutes: «Fra 1 ora e 20 minuti». */
function hoursAhead(minutes: number): string {
  const whole = Math.floor(minutes / MINUTES_IN_HOUR)
  const rest = minutes % MINUTES_IN_HOUR
  const hours = whole === 1 ? '1 ora' : `${whole} ore`
  return rest === 0 ? `Fra ${hours}` : `Fra ${hours} e ${rest} minuti`
}

export const messages = {
  appName: 'Octo',
  projects: 'Progetti',
  project: 'Progetto',
  addProject: 'Aggiungi un progetto…',
  close: 'Chiudi',
  openSources: 'Apri «Impostazioni»',
  openSection: (name: string) => `Apri «${name}»`,
  todayTab: 'Oggi',
  brand: 'octo',
  theme: { label: 'Tema', light: 'Tema chiaro', dark: 'Tema scuro' },
  shell: { folder: 'Cartella del progetto', project: (name: string) => `Progetto ${name}` },
  wait: {
    opening: 'Apro…',
    assigning: 'Assegno…',
    asking: 'Chiedo…',
    writing: 'Scrivo…',
    changing: 'Modifico…',
    approving: 'Approvo…',
    reading: 'Leggo…',
    saving: 'Salvo…',
    retry: 'Riprova',
  },
  detail: {
    none: 'Scegli una voce dell’elenco per vederne il dettaglio.',
    position: (place: number, all: number) => `${place} / ${all}`,
  },
  session: {
    title: 'Entra in Octo',
    body: 'Octo si apre con il tuo utente aziendale. L’accesso avviene nel browser: qui non scrivi nessuna password.',
    signIn: 'Entra con l’utente aziendale',
    waiting: 'Ti aspetto nel browser: completa l’accesso e torna qui…',
    cancel: 'Annulla',
    checking: 'Controllo chi sei…',
    notConfigured:
      'Questo Octo non sa ancora dove farti entrare. Chi te l’ha dato deve aggiungere la configurazione dell’accesso aziendale.',
    signedInAs: (name: string) => `Sei ${name}`,
    signOut: 'Esci',
  },
  assignment: {
    notAssigned:
      'Questo progetto non risulta assegnato a te in NetSuite: non sei il project manager di nessuna delle sue commesse. NetSuite non le leggerà; il resto del progetto lo puoi seguire.',
  },
  overview: {
    open: 'Tutti i progetti',
    title: 'Tutti i progetti',
    intro:
      'Che cosa aspetta in ogni progetto, da ciò che Octo calcola. Qui Claude non viene mai interpellato.',
    loading: 'Guardo tutti i progetti…',
    nothing: 'Niente da segnalare.',
    failed: 'Non sono riuscito a guardare questo progetto.',
    openProject: (name: string) => `Apri «Oggi» di ${name}`,
    counts: (toDo: number, watch: number) =>
      `${toDo === 1 ? '1 cosa da fare' : `${toDo} cose da fare`} · ${watch} da tenere d’occhio`,
    alerts: (count: number) =>
      count === 1 ? '1 fonte da controllare' : `${count} fonti da controllare`,
    evaluated: (when: string) => `Valutazione di Claude del ${when}`,
    empty: 'Nessun progetto in elenco.',
  },
  today: {
    loading: 'Preparo la giornata…',
    filters: 'Filtra le cose da fare',
    filterAll: 'Tutte',
    groups: {
      mail: 'Posta',
      tracker: 'Tracker',
      numbers: 'Ore e numeri',
      work: 'Deliverable',
      calendar: 'Calendario',
      risks: 'Rischi',
      sources: 'Fonti',
    },
    list: 'Cose da fare',
    detailTitle: 'Dettaglio della segnalazione',
    noneInFilter: 'Nessuna voce con questo filtro.',
    dueShort: { month_end: 'Fine mese', sprint_end: 'Fine sprint', deadline: 'Scadenza' },
    computed: 'Calcolato da Octo',
    evidence: 'Fonte',
    judging: 'Valutazione in corso…',
    refreshing: 'Aggiorno le fonti: ciò che vedi è dell’ultima lettura.',
    decided: {
      done: (title: string) => `Segnata come fatta: ${title}`,
      later: (title: string) => `Rimandata: ${title}`,
      muted: (title: string) => `Messa da parte: ${title}`,
    },
    undo: 'Annulla',
    askAboutMail: 'Chiedi di questa mail',
    assignMeeting: 'Assegna a questo progetto',
    notThisProject: 'Non è di questo progetto',
    mailSeed: (who: string, subject: string) =>
      `Che cosa chiede ${who} nella mail «${subject}», entro quando, e che cosa serve per rispondere? Cita le fonti.`,
    showing: (shown: number, all: number) =>
      shown === all ? `${all} in elenco` : `${shown} di ${all} in elenco`,
    title: (day: string) => `Oggi · ${day}`,
    freshnessNever: 'mai letta',
    readNow: 'Leggi ora',
    reading: 'Leggo le fonti…',
    now: 'Adesso',
    nowHint:
      'Ciò che viene prima, scelto da una regola: una riunione vicina, una scadenza, ciò che avevi rimandato a oggi, una mail importante, ciò che è peggiorato.',
    nowList: 'Cose che vengono prima',
    nowWhy: {
      meetingSoon: (minutes: number) =>
        minutes === 1
          ? 'Fra 1 minuto'
          : minutes < 60
            ? `Fra ${minutes} minuti`
            : hoursAhead(minutes),
      due: {
        month_end: 'Si chiudono i numeri del mese',
        sprint_end: 'Lo sprint sta finendo',
        deadline: 'Scade entro domani',
      },
      later: 'L’avevi rimandata a oggi',
      importantMail: 'Mail di importanza alta',
      worse: 'È peggiorata',
    },
    toDo: 'Da fare oggi',
    nothingElse: 'Nient’altro da fare oggi.',
    toDoCount: (shown: number, all: number) => (shown === all ? `${all}` : `${shown} di ${all}`),
    watch: 'Da tenere d’occhio',
    watchWhat: 'Che cosa',
    watchDetail: 'Dettaglio',
    watchActions: 'Azioni',
    mutedNone: 'Nessuno: mostro ogni tipo di segnalazione.',
    nothing: 'Oggi Octo non ha nulla da segnalarti.',
    nothingToDo: 'Niente da fare oggi.',
    more: (count: number) => (count === 1 ? 'Mostra l’altra' : `Mostra le altre ${count}`),
    fewer: 'Mostra solo le prime',
    hidden: (count: number) =>
      count === 1 ? '1 segnalazione messa da parte.' : `${count} segnalazioni messe da parte.`,
    done: 'Fatto',
    later: 'Rimanda',
    mute: 'Non mi interessa',
    noAnswerNeeded: 'Non serve risposta',
    notMine: 'Non tocca a me',
    notMineHint: 'La conversazione passa fra quelle da seguire, anche per le prossime mail.',
    mine: 'Tocca a me',
    mineHint: 'La mail torna fra quelle a cui rispondere.',
    laterTomorrow: 'A domani',
    laterMonday: 'A lunedì',
    laterWeek: 'Fra una settimana',
    laterCancel: 'Annulla',
    laterTitle: 'Fino a quando la rimando?',
    because: {
      month_end: 'Perché oggi: si chiudono i numeri del mese.',
      sprint_end: 'Perché oggi: lo sprint sta finendo.',
      deadline: 'Perché oggi: la mail chiede una risposta entro domani.',
    },
    returned: {
      later: 'L’avevi rimandata a oggi.',
      still: (since: string) => `Segnata come fatta il ${since}, ma è ancora aperta.`,
      worse: (was: number, now: number) =>
        `È peggiorata da quando l’hai messa da parte: era ${was}, ora ${now}.`,
    },
    muteOffer: (kind: string) =>
      `Hai messo da parte più volte segnalazioni di tipo «${kind}». Vuoi che non te le mostri più?`,
    muteKind: 'Non mostrarle più',
    mutedTitle: 'Tipi di segnalazione che non mostro',
    unmute: 'Mostra di nuovo',
    settings: 'Impostazioni di «Oggi»',
    addresses: 'I tuoi altri indirizzi di posta',
    addressesHint:
      'Octo sa chi sei dall’accesso. Se ricevi posta anche ad altri indirizzi, scrivili qui, uno per riga: servono a capire quali mail aspettano te.',
    addressesKnown: (addresses: string) => `Indirizzi che considero tuoi: ${addresses}.`,
    addressesNone:
      'Non conosco nessun tuo indirizzo di posta: non posso dire quali mail aspettano te.',
    saveAddresses: 'Salva gli indirizzi',
    judgement: {
      title: 'Valutazione di Claude',
      when: (when: string, model: string | null) =>
        model
          ? `Valutazione di Claude del ${when} (${model})`
          : `Valutazione di Claude del ${when}`,
      never: 'Claude non ha ancora valutato le mail di questo progetto.',
      running: 'Claude sta valutando le mail…',
      update: 'Aggiorna la valutazione',
      all: 'Valuta di nuovo tutte',
      stop: 'Ferma',
      none: 'senza valutazione',
      importance: { alta: 'importanza alta', media: 'importanza media', bassa: 'importanza bassa' },
      verified: 'fonte controllata',
      unverified: 'frase non trovata nella mail',
      deadline: (day: string) => `chiede una risposta entro il ${day}`,
      risksToo:
        'Con la valutazione delle mail, una volta a settimana, Claude propone anche i rischi del progetto: li trovi nel registro dei rischi.',
      explain:
        'Che una mail aspetti lo calcola Octo. Se sei l’unico destinatario tocca a te; per le altre Claude legge a chi è rivolta la richiesta e quanto pesa: è un giudizio, con la frase su cui si fonda. Ciò che non tocca a te sta in «Da tenere d’occhio», una riga per conversazione.',
    },
    kinds: {
      source: 'Fonti',
      tracker_old: 'Tracker del cliente',
      mail_reply: 'Mail a cui rispondere',
      mail_follow: 'Mail da seguire',
      mail_waiting: 'In attesa di altri',
      hours: 'Ore',
      forecast: 'Previsionale',
      month_due: 'Scadenze del mese',
      bugs_stuck: 'Bug fermi',
      requirements: 'Requisiti poco chiari',
      alignment: 'Allineamento',
      draft: 'Deliverable in bozza',
      calendar: 'Calendario',
      meeting: 'Riunioni',
      meeting_unassigned: 'Riunioni da assegnare',
      risk: 'Rischi',
      risk_candidates: 'Rischi proposti',
    },
    open: {
      sources: 'Apri «Impostazioni»',
      hours: 'Apri «Ore»',
      forecast: 'Apri «Previsionale»',
      dashboard: 'Apri «Cruscotto»',
      alignment: 'Apri «Allineamento»',
      deliverables: 'Apri «Deliverable»',
      risks: 'Apri il registro dei rischi',
      mail: 'Apri la mail',
    },
  },
  risks: {
    title: 'Registro dei rischi',
    intro:
      'I rischi del progetto che hai accettato. Octo li scrive in un testo del progetto, che risposte e deliverable possono citare.',
    back: 'Torna a «Oggi»',
    loading: 'Apro il registro…',
    open: 'Rischi aperti',
    closed: 'Rischi chiusi',
    none: 'Nessun rischio nel registro.',
    since: (day: string) => `nel registro dal ${day}`,
    close: 'Chiudi il rischio',
    reopen: 'Riapri',
    note: 'Nota',
    saveNote: 'Salva la nota',
    add: 'Aggiungi un rischio',
    addLabel: 'Un rischio che vuoi tenere d’occhio',
    candidates: 'Proposti da Claude',
    candidatesHint:
      'Claude li propone leggendo il progetto: entrano nel registro solo se li accetti.',
    proposed: (when: string, model: string | null) =>
      model ? `Proposti il ${when} (${model})` : `Proposti il ${when}`,
    neverProposed: 'Claude non ha ancora cercato rischi in questo progetto.',
    noCandidates: 'Nessun rischio proposto in attesa.',
    propose: 'Chiedi a Claude di cercare rischi',
    proposing: 'Claude sta cercando rischi nel progetto…',
    accept: 'Accetta',
    dismiss: 'Scarta',
    source: 'Fonte',
    verified: 'fonte controllata',
    unverified: 'frase non trovata nel file',
    titleLabel: (title: string) => `Titolo del rischio «${title}»`,
  },
  nav: {
    sections: 'Sezioni del progetto',
    daily: 'Ogni giorno',
    work: 'Lavoro',
    monthly: 'Ogni mese',
    sprint: 'Ogni sprint',
    project: 'Progetto',
  },
  choosePath: 'Scegli…',
  commaList: 'Più valori si separano con la virgola.',
  monthBefore: 'Mese precedente',
  monthAfter: 'Mese successivo',
  sourceLink: 'Collega',
  sourceEdit: 'Modifica',
  settingsParts: {
    title: 'Parti delle impostazioni del progetto',
    links: 'Collegamenti',
    team: 'Persone e calendario',
    today: 'Pagina «Oggi»',
    deliverables: 'Carta intestata',
    advanced: 'Avanzate',
  },
  advanced: 'Avanzate',
  feedSteps: {
    access: '1 · Accesso',
    scope: '2 · Che cosa leggere',
  },
  feedHelpTitle: {
    ado: 'Come ottengo il token?',
    jira: 'Come ottengo il token?',
    confluence: 'Come ottengo il token?',
    dwsi: 'Dove trovo utente e password?',
  },
  feedHelp: {
    ado: {
      steps: [
        'In Azure DevOps apri le impostazioni utente (l’icona in alto a destra) e scegli «Personal access tokens».',
        'Premi «New Token», dagli un nome e una scadenza.',
        'In «Scopes» scegli «Custom defined» e spunta solo «Work Items: Read» e «Project and Team: Read».',
        'Premi «Create» e copia subito il token: si vede una volta sola.',
      ],
      note: 'Un token che può anche scrivere viene rifiutato da Octo.',
    },
    jira: {
      steps: [
        'Apri id.atlassian.com/manage-profile/security/api-tokens con il tuo utente Jira.',
        'Premi «Crea token API» e dagli un nome, per esempio «Octo».',
        'Copia subito il token e incollalo qui: si vede una volta sola.',
      ],
      note: 'Il token vede ciò che vedi tu; Octo lo usa solo per leggere.',
    },
    confluence: {
      steps: [
        'Confluence usa lo stesso account di Jira: se hai già un token per Jira, va bene lo stesso.',
        'Altrimenti apri id.atlassian.com/manage-profile/security/api-tokens e premi «Crea token API».',
        'Copia subito il token e incollalo qui: si vede una volta sola.',
      ],
      note: 'Octo legge solo le pagine degli spazi che indichi, mai un sito intero.',
    },
    dwsi: {
      steps: [
        'Chiedi a chi amministra l’archivio dei dati aziendali (dove finiscono i dati di NetSuite) un utente di sola lettura.',
        'Fatti dare anche il nome del server e del database.',
      ],
      note: 'Un utente che può anche scrivere viene rifiutato da Octo.',
    },
  },
  feedOffConfirm: (name: string) =>
    `Scollegare ${name}? Octo smette di leggerlo e dimentica la credenziale. Ciò che ha già letto resta nella cartella del progetto.`,
  guideLinked: (linked: number, all: number) =>
    linked === 0
      ? 'Niente è ancora collegato: comincia da ciò che usi di più, di solito la posta.'
      : `${linked} su ${all} collegati. Ciò che non ti serve puoi lasciarlo com’è.`,
  saved: 'Salvato.',
  notSaved: 'Non ho salvato: correggi ciò che è segnalato sotto i campi.',
  amountWrong: 'Non è un numero che capisco: scrivi solo cifre, per esempio 12.500,50.',
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
  askChats: {
    title: 'Conversazioni',
    fresh: 'Nuova chat',
    freshHint:
      'Chat nuova: fai una domanda. Le domande successive di questa chat tengono conto delle precedenti; le fonti sono ricontrollate a ogni risposta.',
    none: 'Nessuna chat ancora.',
    legacy: 'Domande precedenti',
    filter: 'Cerca fra le chat',
    nothingFound: 'Nessuna chat corrisponde.',
    about: (when: string, questions: number) =>
      `${when} · ${questions === 1 ? '1 domanda' : `${questions} domande`}`,
  },
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
    count === 1 ? '1 citazione riscontrata nel file' : `${count} citazioni riscontrate nei file`,
  noSources: 'Nessuna fonte citata',
  toCheck: (count: number) =>
    count === 1 ? '1 punto da controllare' : `${count} punti da controllare`,
  markerWithoutSource: (marker: number) => `Il richiamo [${marker}] non ha una fonte.`,
  sourcesTab: 'Impostazioni',
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
    ado: 'Le voci del tracker del progetto (bug, storie, attività), una per file, lette con il tuo token personale di sola lettura.',
    jira: 'I ticket dei progetti indicati, uno per file, letti con la tua email e un token di sola lettura.',
    confluence:
      'Le pagine degli spazi indicati, una per file, con il loro testo: lette con la stessa email e lo stesso tipo di token di Jira. Allegati e commenti non vengono letti.',
    dwsi: 'Ore, ordini, fatture e ricavi delle commesse indicate, letti dall’archivio dei dati aziendali con il tuo utente di sola lettura. La connessione resta su questo computer.',
  },
  feedSecret: {
    ado: 'Personal Access Token',
    jira: 'API token',
    confluence: 'API token',
    dwsi: 'Password',
  },
  feedSecretKept: 'Già salvata su questo computer: lascia vuoto per tenerla.',
  feedSecretHint:
    'Resta su questo computer, cifrata dal sistema. Non finisce nella cartella del progetto.',
  feedSave: 'Prova e salva',
  feedFieldMissing: 'Manca: va compilato per collegare il sistema.',
  feedMissingFields: 'Non ho provato il collegamento: compila i campi segnalati.',
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
    email: 'La tua email su Atlassian',
    spaces: 'Spazi (chiave o nome, uno per riga)',
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
    people: 'Persone',
    peopleHint:
      'Solo il nome è obbligatorio. L’allocazione è la parte del suo tempo che la persona dà al progetto, in percentuale: vuota se non la sai. Le date si lasciano vuote se la persona c’è dall’inizio o c’è ancora. In «Come scrivergli» va ciò che un’email deve rispettare, per esempio «dare del lei, prima la richiesta».',
    periods: 'Calendario: periodi e sprint',
    columns: {
      name: 'Nome',
      role: 'Ruolo',
      side: 'Parte',
      allocation: 'Allocazione %',
      from: 'Dal',
      to: 'Al',
      note: 'Come scrivergli',
      period: 'Periodo',
    },
    personN: (n: number) => `persona ${n}`,
    periodN: (n: number) => `periodo ${n}`,
    cell: (row: string, column: string) => `${column}, ${row}`,
    remove: (row: string) => `Togli ${row}`,
    addPerson: 'Aggiungi una persona',
    addPeriod: 'Aggiungi un periodo',
    personWrong: (n: number) => `Persona ${n}: manca il nome.`,
    allocationWrong: (n: number) =>
      `Persona ${n}: l’allocazione è una percentuale, più di 0 e al massimo 100.`,
    periodWrong: (n: number) => `Periodo ${n}: servono il nome e le due date.`,
    save: 'Salva persone e calendario',
    saved: (people: number, periods: number) =>
      `Salvati: ${people === 1 ? '1 persona' : `${people} persone`} e ${periods === 1 ? '1 periodo' : `${periods} periodi`}.`,
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
    credentials:
      'Rimetti le credenziali di Jira e Azure DevOps in «Impostazioni»: non sono nella copia.',
  },
  models: {
    title: 'Quale Claude lavora',
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
    groupColumns: {
      name: 'Che cosa vogliono dire',
      item: 'Stati del cliente (separati da virgola)',
      ticket: 'Stati dei ticket (separati da virgola)',
    },
    groupCell: (column: string, row: number) => `${column}, riga ${row}`,
    addGroup: 'Aggiungi un gruppo',
    removeGroup: (row: number) => `Togli la riga ${row}`,
    groupWrong: (n: number) =>
      `Gruppo ${n}: servono un nome e almeno uno stato per ciascuno dei due tracker.`,
    saveNeeds: 'Per salvare indica lo sprint.',
    intro:
      'Confronto le voci del tracker del cliente in uno sprint con i ticket del tuo tracker. Una voce e un ticket sono collegati quando la voce porta fra i tag la chiave del ticket, oppure il titolo del ticket nomina l’id della voce, per esempio «[AZDO 123]». Leggo l’esportazione usata dal cruscotto e i ticket che Octo ha già letto: non scrivo in nessuno dei due tracker.',
    settings: 'Che cosa confronto',
    sprint: 'Sprint, come lo chiamano i due tracker',
    period: 'Periodo di pianificazione delle voci del cliente',
    periodAny: 'Qualunque',
    sprintNow: 'Sprint a confronto',
    nothingIn: (lists: string) => `Niente da segnalare in: ${lists}.`,
    sprintChoose: 'Scegli lo sprint…',
    tags: 'Tag delle voci che sono della tua squadra (nessuno: tutte)',
    exportPath:
      'Esportazione del tracker del cliente: file nel progetto (vuoto: quella del cruscotto)',
    ticketFolder: 'Cartella dei ticket nel progetto (vuoto: quella della fonte Jira)',
    referencePrefixes:
      'Che cosa precede l’id della voce nel titolo del ticket (separati da virgola), per esempio AZDO',
    stateGroups: 'Stati che vogliono dire la stessa cosa',
    stateGroupsHint:
      'Per esempio «in corso»: dal cliente «In Progress, Active», nei ticket «In corso». Senza gruppi collego le voci ma non giudico gli stati.',
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
    invoices: {
      title: 'Che cosa risulta su NetSuite',
      billedTotal: 'Fatturato su NetSuite',
      salesOrders: 'Ordini di vendita di NetSuite',
      linkHint: (order: string) =>
        `NetSuite non conosce il numero d’ordine del cliente${order === '' ? '' : ` (${order})`}: dimmi quali suoi ordini di vendita sono quest’ordine. Da lì leggo le fatture emesse.`,
      suggested: (orders: string) =>
        `Propongo ${orders}: ha fatture con gli stessi importi delle posizioni.`,
      link: 'Collega',
      change: (orders: string) => `Ordine di vendita: ${orders} · Cambia`,
      columnPosition: 'Posizione',
      columnAmount: 'Importo',
      columnState: 'Su NetSuite',
      billed: 'Fatturata',
      notBilled: 'Non fatturata',
      invoice: (id: string, day: string, status: string) =>
        [`fattura ${id}`, day === '' ? '' : `del ${day}`, status].filter(Boolean).join(' · '),
      fulfilled: 'Ordine evaso: tutto il valore dell’ordine è fatturato.',
      unregistered: (count: number, ids: string) =>
        count === 1
          ? `La fattura ${ids} non è fra le richieste di Octo.`
          : `${count} fatture non sono fra le richieste di Octo: ${ids}.`,
      register: 'Registra come richieste già fatte',
      unmatched: (invoices: string) =>
        `Fatture sull’ordine che non hanno l’importo di una posizione: ${invoices}.`,
      how: 'Una posizione risulta fatturata quando sull’ordine di vendita c’è una fattura del suo stesso importo. Le note di credito senza ordine di vendita non sono contate.',
    },
    loading: 'Preparo l’avanzamento…',
    intro:
      'Qui prepari il modulo con cui chiedi al cliente di riconoscere una quota dell’ordine: una richiesta per fattura. Octo calcola le percentuali di ogni posizione dagli importi che scrivi e compila una copia del modulo: quello vuoto non lo tocca.',
    setup: {
      title: 'Impostazioni dell’ordine e del modulo',
      open: 'Impostazioni',
      firstTime:
        'Per cominciare servono tre cose, che si scrivono una volta sola: il modulo del cliente, dove va ogni dato e l’ordine.',
      done: 'fatto',
      todo: 'da fare',
      moduleTitle: '1 · Il modulo del cliente',
      moduleHint:
        'Il file Excel vuoto che il cliente chiede di compilare. Deve stare nella cartella del progetto.',
      modelPath: 'Modulo vuoto',
      modelNone:
        'Non trovo file Excel che sembrino il modulo: scrivi dove sta, a partire dalla cartella del progetto.',
      cellsTitle: '2 · Che cosa va in ogni cella',
      cellsHint:
        'Una riga per ogni cella da riempire. Il nome della cella lo leggi aprendo il modulo in Excel (per esempio D2). Nel testo puoi inserire i dati della richiesta con i pulsanti qui sotto; tutto il resto è scritto com’è.',
      cell: 'Cella',
      cellN: (n: number) => `Cella della riga ${n}`,
      cellText: 'Che cosa scrivere',
      cellTextN: (n: number) => `Che cosa scrivere nella riga ${n}`,
      addCell: 'Aggiungi una cella',
      removeCell: (n: number) => `Togli la riga ${n}`,
      cellWrong: (n: number) =>
        `Riga ${n}: una cella si scrive con lettere e numero, per esempio D2.`,
      insert: 'Inserisci nella riga selezionata:',
      placeholders: [
        { token: '{n}', label: 'Numero della richiesta' },
        { token: '{ordine}', label: 'Ordine' },
        { token: '{posizioni}', label: 'Posizioni' },
        { token: '{dal}', label: 'Dal' },
        { token: '{al}', label: 'Al' },
        { token: '{al_precedente}', label: 'Al della richiesta precedente' },
        { token: '{nota}', label: 'Fattura di riferimento' },
      ],
      tableTitle: 'La tabella delle posizioni nel modulo',
      tableHint:
        'Dove comincia la tabella, quante righe ha e in quali colonne vanno la posizione e le tre percentuali.',
      firstRow: 'Prima riga',
      rows: 'Numero di righe',
      position: 'Colonna della posizione',
      previous: 'Colonna «precedente»',
      current: 'Colonna «attuale»',
      period: 'Colonna «di periodo»',
      tableWrong:
        'La tabella va indicata per intero: due numeri interi e quattro colonne scritte con le lettere di Excel (A, B, …).',
      orderTitle: '3 · L’ordine',
      order: 'Numero dell’ordine, come lo scrive il modulo',
      total: 'Totale dell’ordine (per controllo)',
      positionsTitle: 'Posizioni dell’ordine',
      code: 'Posizione',
      codeN: (n: number) => `Codice della posizione ${n}`,
      amount: 'Importo',
      amountN: (n: number) => `Importo della posizione ${n}`,
      addPosition: 'Aggiungi una posizione',
      removePosition: (n: number) => `Togli la posizione ${n}`,
      positionWrong: (n: number) =>
        `Posizione ${n}: servono un codice e un importo scritto in cifre, per esempio 12.500,50.`,
      sum: (sum: string) => `Le posizioni sommano ${sum}.`,
      sumDiffers: (sum: string, declared: string) =>
        `Le posizioni sommano ${sum}, il totale scritto è ${declared}: controlla gli importi.`,
      save: 'Salva',
      close: 'Chiudi',
    },
    orderTotal: 'Totale dell’ordine',
    asked: 'Chiesto finora',
    left: 'Resta da chiedere',
    orderName: (order: string) => (order === '' ? 'Ordine' : `Ordine ${order}`),
    newRequest: 'Nuova richiesta',
    request: {
      titleNew: (n: number) => `Nuova richiesta (la numero ${n})`,
      titleEdit: (n: number) => `Correggi la richiesta ${n}`,
      amount: 'Importo della richiesta',
      allLeft: (amount: string) => `Tutto ciò che resta: ${amount}`,
      note: 'Fattura di riferimento',
      positionsLegend: 'Su quali posizioni',
      inOrder: 'In ordine, dalla prima non ancora chiusa',
      chosen: 'Solo su quelle che scelgo',
      positionLeft: (code: string, left: string) => `${code} (restano ${left})`,
      preview: 'Come cambiano le posizioni',
      previewNone: 'Scrivi l’importo per vedere come cambiano le posizioni.',
      laterRecomputed:
        'Le richieste successive vengono ricalcolate: ricompila anche i loro moduli.',
      saveAndCompile: 'Salva e compila il modulo',
      saveOnly: 'Salva senza compilare',
    },
    requestN: (n: number) => `Richiesta ${n}`,
    correctN: (n: number) => `Correggi la richiesta ${n}`,
    correct: 'Correggi',
    removeN: (n: number) => `Togli la richiesta ${n}`,
    remove: 'Togli',
    removeConfirm: (n: number) =>
      `Togliere la richiesta ${n}? Un modulo già compilato resta nella cartella.`,
    from: 'Dal',
    to: 'Al',
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
    noRequests: 'Nessuna richiesta ancora: premi «Nuova richiesta».',
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
      note_missing: (n: number) => `Richiesta ${n}: manca la fattura di riferimento.`,
    },
    compile: (n: number) => `Compila il modulo della richiesta ${n}`,
    compiled: (path: string) => `Modulo compilato in ${path}. Quello vuoto non è stato toccato.`,
    open: 'Apri il file',
  },
  forecastTab: 'Previsionale',
  forecast: {
    loading: 'Preparo il previsionale…',
    columns: {
      person: 'Persona',
      name: 'Nome',
      code: 'Commessa',
      codeOrAll: 'Commessa (vuota: tutte)',
      rate: 'Tariffa al giorno',
      cost: 'Costo al giorno',
      hours: 'Ore',
    },
    cell: (column: string, row: number) => `${column}, riga ${row}`,
    removeRow: (row: number) => `Togli la riga ${row}`,
    add: { rate: 'Aggiungi una tariffa', external: 'Aggiungi un esterno' },
    wrong: {
      rate: (n: number) => `Tariffa ${n}: servono la persona e una tariffa scritta in cifre.`,
      external: (n: number) =>
        `Esterno ${n}: servono nome, commessa, costo e tariffa scritti in cifre.`,
      hours: (n: number) => `Riga ${n}: servono il nome e le ore scritte in cifre.`,
    },
    saveNeeds: 'Per salvare indica il file del modello.',
    monthData: 'Dati del mese',
    moreData: 'Altri dati',
    forCode: (label: string, code: string) => `${label}, ${code}`,
    daysWithUnit: (days: string) => `${days} gg`,
    remedy: {
      save: 'Salva',
      of: (person: string, code: string) => `${person} su ${code}`,
      openCode: (code: string) => `Scrivi i costi di ${code}`,
    },
    setupTitle: 'Il modello dell’amministrazione',
    setupIntro:
      'Compilo il previsionale mensile sul file Excel che l’amministrazione manda: una riga per codice di progetto. I costi interni vengono dal costo che NetSuite scrive su ogni riga di timesheet approvata; i ricavi dalle stesse ore e dalle tariffe al giorno che indichi qui. Scrivo una copia: il file originale non lo tocco.',
    modelPath: 'Modello: file Excel dell’amministrazione',
    hoursPerDay: 'Ore in una giornata',
    rates: 'Tariffe al giorno',
    ratesHint:
      'Le persone e il costo delle loro ore arrivano dai timesheet di NetSuite: qui scrivi solo a quanto vendi una giornata. Senza commessa la tariffa vale ovunque; quella scritta per una commessa vince. Chi ha ore e nessuna tariffa compare fra i dati che mancano.',
    externalRates: 'Esterni senza timesheet',
    externalRatesHint:
      'Una riga per persona e commessa. Le ore le scrivi ogni mese, nei dati del mese della commessa. Tariffe e costi restano in una cartella di Octo che non entra nelle risposte né nei deliverable.',
    save: 'Salva',
    settings: 'Impostazioni del previsionale',
    month: 'Mese',
    columnCode: 'Codice',
    columnInternal: 'Costi interni',
    columnExternal: 'Costi esterni',
    columnRevenue: 'Ricavi',
    columnQuantity: 'Giorni o %',
    columnMarginMonth: 'Margine mese',
    columnMarginEnd: 'Margine finale',
    columnToInvoice: 'Da fatturare',
    howComputed: 'Come è calcolato:',
    columnOwnRevenue: 'Ricavi corretti',
    columnOwnNote: 'Tua nota',
    groupComputed: 'Calcolato da Octo',
    groupOwn: 'Da te, per questo mese',
    inputsHint:
      'A sinistra ciò che Octo calcola (sotto ogni riga, come lo ha calcolato), a destra ciò che puoi aggiungere tu: tutto facoltativo. «Ricavi corretti» sostituisce i ricavi calcolati; vuoto, valgono quelli calcolati. «Da fatturare» e «Tua nota» finiscono nel modello così come li scrivi.',
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
    externals: 'Ore degli esterni nel mese',
    toInvoice: 'Da fatturare nel mese',
    revenue: 'Ricavi decisi da te',
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
    aliasColumns: { worklog: 'Nome sul tracker', timesheet: 'Nome nel timesheet' },
    aliasCell: (column: string, row: number) => `${column}, riga ${row}`,
    addAlias: 'Aggiungi una persona',
    removeAlias: (row: number) => `Togli la riga ${row}`,
    aliasWrong: (n: number) => `Riga ${n}: servono tutti e due i nomi.`,
    saveNeeds: 'Per salvare indica dove sono i timesheet e le ore del tracker.',
    firstTime:
      'Per confrontare le ore servono due letture del mese scelto: i timesheet e le ore segnate sul tracker. Octo le fa da solo.',
    steps: { timesheets: '1 · Timesheet da NetSuite', tracker: '2 · Ore da Jira' },
    haveExports: 'Ho già le esportazioni nella cartella',
    refreshTitle: 'Leggi di nuovo le ore',
    refreshHint: 'Leggono i mesi interi del periodo scelto.',
    include: 'Conta anche questo codice',
    netsuiteUnlinked:
      'NetSuite non è collegato a questo progetto: collegalo in «Impostazioni», poi torna qui a leggere i timesheet.',
    jiraUnlinked:
      'Jira non è collegato a questo progetto: collegalo in «Impostazioni», poi torna qui a leggere le ore.',
    setupTitle: 'Da dove leggo le ore',
    setupIntro:
      'Confronto le ore approvate dei timesheet con le ore segnate sul tracker, persona per persona. Le leggo io da NetSuite e da Jira con i pulsanti qui sotto, oppure indichi due esportazioni che hai già nella cartella del progetto. Non scrivo in nessun sistema.',
    timesheetPath: 'Timesheet: cartella o file delle esportazioni',
    worklogPath: 'Ore del tracker: cartella o file delle esportazioni',
    worklogHint:
      'Va bene l’esportazione dello strumento con cui si segnano le ore sul tracker: servono le colonne persona, data e ore.',
    projects: 'Codici di progetto dei timesheet che sono di questo progetto (nessuno: tutti)',
    threshold: 'Scostamento oltre il quale una persona è da guardare (%)',
    cutoff: 'Ultimo giorno completo (i giorni dopo restano fuori dal confronto; vuoto: nessuno)',
    noWorklogExpected: 'Persone che non segnano ore sul tracker',
    noTimesheetExpected: 'Persone senza timesheet qui, per esempio esterni',
    aliases: 'Stessa persona, nomi diversi',
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
    timesheetsTitle: 'Timesheet da NetSuite',
    timesheetsIntro:
      'Leggo le ore dei timesheet delle commesse indicate in «Impostazioni», con il tuo utente di sola lettura, per i mesi interi del periodo. Le tengo in un file del progetto per mese e da lì le confronto. Il costo di ogni riga serve al previsionale: lo tengo a parte, in una cartella che non entra nelle risposte né nei deliverable.',
    readTimesheets: 'Leggi i timesheet da NetSuite',
    readingTimesheets: 'Leggo i timesheet da NetSuite…',
    timesheetsRead: (entries: number, months: string, when: string) =>
      `Lette ${entries} righe di timesheet (${months}) alle ${when}`,
    trackerTitle: 'Ore da Jira',
    trackerIntro:
      'Leggo le ore segnate sui ticket dei progetti Jira indicati in «Impostazioni», con il tuo token di sola lettura, per i mesi interi del periodo. Le tengo in un file del progetto e da lì le confronto. Di ogni registrazione tengo solo persona, giorno, ore e ticket.',
    readTracker: 'Leggi le ore da Jira',
    readingTracker: 'Leggo le ore da Jira…',
    trackerRead: (entries: number, months: string, when: string) =>
      `Lette ${entries} registrazioni di ore (${months}) alle ${when}`,
  },
  dashboardTab: 'Cruscotto',
  dashboard: {
    loading: 'Leggo l’esportazione del tracker…',
    qualityTitle: 'Qualità: i bug del perimetro',
    filterLabel: 'Scegli quali bug elencare',
    relation: (open: number, stuck: number, validated: number, days: number) =>
      `Aperti: ${open}, in lavorazione o in verifica; ${stuck} di questi sono fermi da oltre ${days} giorni. I ${validated} validati non sono più aperti: aspettano il rilascio.`,
    ofWhich: 'di cui',
    bugList: 'Bug',
    bugDetail: 'Dettaglio del bug',
    noneInFilter: 'Nessun bug con questo filtro.',
    lastComment: (by: string, when: string) => `Ultimo commento · ${by} · ${when}`,
    noteOf: (when: string) => `Nota tua · ${when}`,
    noComment: 'Nessun commento sul tracker e nessuna nota tua.',
    inState: (days: number | null) =>
      days === null ? 'tempo nello stato non noto' : `${days} gg nello stato`,
    severity: 'Gravità',
    environment: 'Ambiente',
    created: 'Aperto il',
    askAbout: 'Chiedi di questo bug',
    askSeed: (id: string, title: string, state: string, days: number | null) =>
      `Bug ${id} «${title}», nello stato «${state}»${days === null ? '' : ` da ${days} giorni`}: che cosa lo blocca, chi deve muoversi e qual è il prossimo passo? Cita le fonti.`,
    haveExport: 'Ho già un file di esportazione',
    trendNumbers: 'Mostra i numeri',
    adoUnlinked:
      'Azure DevOps non è collegato a questo progetto: collegalo in «Impostazioni», poi torna qui a leggere.',
    saveNeeds: 'Per salvare indica il file dell’esportazione.',
    setupTitle: 'Da dove leggo bug e requisiti',
    setupIntro:
      'Il cruscotto si calcola da un’esportazione del tracker tenuta nella cartella del progetto: la leggo io da Azure DevOps qui sotto, oppure indichi un file che hai già. Non scrivo mai nel tracker.',
    trackerTitle: 'Leggi da Azure DevOps',
    trackerIntro:
      'Leggo adesso le voci del progetto e delle aree indicati in «Impostazioni», con il tuo token personale di sola lettura, e per i bug anche i cambi di stato e i commenti. Li tengo in un file del progetto e il cruscotto si calcola da lì. Può volerci qualche minuto.',
    readTracker: 'Leggi da Azure DevOps',
    readingTracker: 'Sto leggendo Azure DevOps…',
    trackerRead: (items: number, withHistory: number, when: string) =>
      `Lette ${items} voci, ${withHistory} con la cronologia, alle ${when}`,
    exportPath: 'File dell’esportazione',
    historyPath: 'File della cronologia (facoltativo)',
    historyHint: 'Con la cronologia l’andamento segue i cambi di stato veri; senza, è una stima.',
    noCandidates: 'Nessuna esportazione trovata nella cartella: scrivi il percorso a mano.',
    choose: 'Scegli…',
    none: 'Nessuno',
    tags: 'Solo gli elementi con questi tag (nessuno: tutti)',
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
  kindTemplate: {
    title: 'Modello di questo tipo',
    none: 'Nessun modello: il testo segue le istruzioni del tipo ed esce sulla carta intestata del progetto, se c’è.',
    choose: 'Scegli un modello (.docx o .pptx)',
    remove: 'Togli',
    removeFormat: (format: string) => `Togli il modello ${format}`,
    format: { docx: 'Word', pptx: 'PowerPoint' },
    does: {
      docx: 'la bozza ha le sezioni del documento, e il file Word esce sulla sua carta.',
      pptx: 'la bozza segue le slide della presentazione, e l’approvato esce anche in PowerPoint.',
    },
    hint: 'Il modello vale solo per questo tipo di deliverable, in questo progetto. Octo ne tiene una copia nel progetto: l’originale non viene toccato.',
    newKindHint:
      'Un tipo può avere un modello Word o PowerPoint: lo scegli con «Salva e scegli un modello».',
    saveAndChoose: 'Salva e scegli un modello',
  },
  deliverableSettings: {
    title: 'Deliverable',
    intro:
      'Qui sta ciò che vale per tutti i deliverable del progetto. Il modello di un tipo si sceglie nel tipo, in «Deliverable».',
  },
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
  deckModelLegacyHint:
    'Scelto prima che i modelli fossero per tipo: vale per i tipi con presentazione che non hanno un modello loro. Puoi toglierlo e sceglierne uno nel tipo.',
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
    'Questo testo va al cliente. Octo ha trovato giornate di lavoro o importi: controlla che siano già concordati con il cliente e non dati interni. Non tolgo nulla da solo.',
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
    'Collega ciò che alimenta la memoria di questo progetto, una riga per volta. Ogni collegamento è facoltativo: puoi tornarci quando vuoi.',
  guideFill: 'Riempi la memoria ora',
  guideFilling: 'Sto leggendo tutte le fonti collegate…',
  guideStep: (label: string, written: number, unchanged: number) =>
    `${label}: ${written} nuovi o aggiornati, ${unchanged} invariati.`,
  guideStepFailed: (label: string) => `${label}: non riuscito.`,
  guideSources: {
    mail: 'Posta',
    meetings: 'Riunioni (Verbale)',
    ado: 'Azure DevOps',
    jira: 'Jira',
    confluence: 'Confluence',
    dwsi: 'NetSuite',
    documents: 'Documenti',
  },
  guideAsk: 'Fatto. Ora puoi fare domande in «Chiedi».',
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
  feedChoicesSpaces: 'Cerca gli spazi',
  feedChoicesSpacesTitle: 'Spazi che vedi (clic per aggiungere):',
  feedChoicesNoSpaces: 'Nessuno spazio visibile con questa credenziale.',
  feedChoicesCodes: 'Cerca le tue commesse',
  feedChoicesCodesTitle: 'Commesse di cui sei project manager (clic per aggiungere):',
  feedChoicesNoCodes:
    'In NetSuite non risulti project manager di nessuna commessa con questo indirizzo.',
  meetingsTitle: 'Riunioni (Verbale)',
  meetingsIntro:
    'Octo legge la cartella in cui Verbale esporta le riunioni e porta nel progetto quelle concluse: trascrizione, appunti e riepilogo, senza audio né immagini. Una riunione entra da sola se un invito già in memoria cade alla stessa ora, o se il titolo o gli appunti nominano il progetto; le altre aspettano nella pagina «Oggi», dove le assegni tu.',
  meetingsRoot: 'Cartella in cui Verbale esporta',
  meetingsRootFound:
    'È la cartella che Verbale usa su questo computer: salvala, o scegline un’altra.',
  meetingsRootMissing: 'Non riesco a ricavare la cartella da Verbale: sceglila tu.',
  meetingsSince: 'Dal giorno',
  meetingsSinceHint:
    'Le riunioni registrate prima non vengono considerate. Lascia vuoto per prenderle tutte: quelle che Octo non sa attribuire compaiono in «Oggi».',
  meetingsTarget: (folder: string) =>
    `Le riunioni vengono scritte in ${folder}, una cartella per riunione; ciò che viene saltato è annotato in _lettura.md.`,
  meetingsSave: 'Salva',
  meetingsSaved: 'Salvato.',
  meetingsSync: 'Leggi ora',
  meetingsSyncing: 'Sto leggendo le riunioni…',
  meetingsNever: 'Mai lette.',
  meetingsNotConfigured: 'Le riunioni di questo progetto non sono ancora collegate.',
  meetingsLastRun: (at: string, written: number, unchanged: number) =>
    `Ultima lettura ${at}: ${written} nuove o aggiornate, ${unchanged} invariate.`,
  meetingField: {
    imported: 'Riunioni importate da Verbale',
    other: 'Un’altra riunione (la indico qui sotto)',
  },
  documentsTitle: 'Documenti',
  documentsIntro:
    'Octo rende leggibile il testo di Word, Excel, PowerPoint e PDF della cartella, così nelle risposte può cercarlo e citarlo. Gli originali non vengono toccati.',
  documentsConvert: 'Converti ora',
  documentsConverting: 'Sto leggendo i documenti…',
  documentsNever: 'Mai convertiti.',
  documentsLastRun: (at: string, written: number, unchanged: number) =>
    `Ultima conversione ${at}: ${written} aggiornati, ${unchanged} già pronti.`,
  knownList: {
    chosen: (label: string) => `Scelti: ${label}`,
    noneChosen: 'Nessuno scelto.',
    remove: (value: string) => `Togli ${value}`,
    searchIn: (label: string) => `Cerca: ${label}`,
    search: (values: number) => `Cerca fra ${values} valori`,
    nothingFound: 'Nessun valore corrisponde.',
  },
  rows: {
    count: (rows: number) => (rows === 1 ? '1 riga' : `${rows} righe`),
  },
  table: {
    filter: 'Filtra',
    filterOf: (label: string) => `Filtra: ${label}`,
    shown: (shown: number, all: number) => `${shown} di ${all}`,
    none: 'Nessuna riga corrisponde.',
    sortBy: (label: string) => `Ordina per ${label}`,
  },
  ownPeopleOnly: {
    label: 'Solo le voci assegnate alle nostre persone',
    hint: 'Le nostre persone sono quelle segnate «fornitore» in Impostazioni › Persone e calendario. Il nome può essere scritto in qualsiasi ordine («Rossi Mario» è «Mario Rossi»). Le voci non assegnate e quelle di chi non è in elenco restano fuori; se l’elenco non ha nessun «fornitore», non filtro nulla.',
  },
  diskAccess: {
    open: 'Apri «Accesso completo al disco»',
    hint: 'Poi chiudi e riapri Octo.',
    afterUpdate: (version: string) =>
      `Octo è ora alla versione ${version}. macOS toglie l’accesso completo al disco a un’app che cambia: se Octo legge la tua posta di Mail, rimettilo (togli Octo dall’elenco con «−», aggiungilo con «+») e riapri Octo.`,
    done: 'Fatto',
  },
  update: {
    available: (version: string) => `È disponibile Octo ${version}.`,
    hint: 'L’aggiornamento scarica la versione nuova, la verifica e riavvia Octo: progetti e impostazioni restano dove sono.',
    install: 'Aggiorna e riavvia',
    installing: 'Aggiorno…',
    preparing: 'Preparo lo scaricamento…',
    downloading: (percent: number) => `Scarico la versione nuova: ${percent}%.`,
    restarting: 'Scaricata e verificata: Octo si chiude e riparte fra un momento.',
    later: 'Più tardi',
  },
  agentMissingTitle: 'Claude non è installato su questo computer',
  agentMissingBody:
    'Octo usa Claude Code con il tuo account. Installalo, accedi una volta dal terminale con «claude» e riapri Octo.',
  agentRetry: 'Riprova',
  agentReady: (version: string) => `Claude ${version}`,
  citation: {
    panel: 'Fonte citata',
    marker: (n: number) => `Fonte ${n}`,
    markerMissing: (n: number) => `Richiamo ${n} senza fonte`,
    none: 'Scegli un richiamo nella risposta per vedere qui la fonte, senza perdere il testo.',
    noSources: 'Questa risposta non cita fonti: prendila come non verificata.',
    orphan: (n: number) =>
      `Il richiamo [${n}] non ha una fonte: ciò che gli sta accanto non è appoggiato a nessun file.`,
    found: 'Frase riscontrata nel file',
    foundNote:
      'Il controllo dice che la frase è nel file. Non dice che la conclusione tratta sia giusta: quella resta da leggere.',
    notFoundNote:
      'Questa citazione non regge il controllo: verifica sull’originale prima di usarla.',
    open: 'Apri l’originale',
    opening: 'Apro la fonte…',
    openFailed: 'Non sono riuscito ad aprire il file.',
    path: 'Percorso completo',
    previous: 'Fonte precedente',
    next: 'Fonte successiva',
    close: 'Chiudi la fonte',
    undated: 'data non nota',
    sameFile: (markers: string) => `Lo stesso file è citato anche ai richiami ${markers}.`,
    provenance: {
      mail: 'Posta',
      tracker: 'Tracker',
      feed: (name: string) => name,
      text: 'Documento',
      file: 'File del progetto',
    },
  },
  missingTitle: 'Da confermare: non trovato nelle fonti',
  missingCount: (count: number) =>
    count === 1 ? '1 informazione mancante' : `${count} informazioni mancanti`,
  askDraft: 'Prepara un deliverable da questa risposta',
  handoff: {
    title: 'Contesto dalla risposta',
    from: (question: string) => `Dalla domanda: «${question}»`,
    sources: (count: number) =>
      count === 0
        ? 'Nessuna fonte citata.'
        : count === 1
          ? '1 fonte citata.'
          : `${count} fonti citate.`,
    choose:
      'Scegli il tipo di deliverable: il contesto entra nel primo campo di testo, e lo puoi correggere.',
    drop: 'Togli il contesto',
    filled: 'Compilato dal contesto della risposta: controllalo prima di scrivere.',
    labels: {
      question: 'Domanda',
      answer: 'Risposta di Octo',
      sources: 'Fonti citate',
      missing: 'Da confermare',
    },
  },
  review: {
    panel: 'Rilettura',
    draft: 'Bozza',
    seen: 'Segna come rivisto',
    seenDone: 'Rivisto',
    left: (count: number) =>
      count === 0
        ? 'Tutti i rilievi rivisti'
        : count === 1
          ? '1 rilievo da rivedere'
          : `${count} rilievi da rivedere`,
    reset: 'La bozza è cambiata: i rilievi sono da rivedere di nuovo.',
    exported: 'Approvato: i file sono pronti qui sopra.',
  },
} as const

const citationStatus: Record<CitationStatus, string> = {
  verified: 'Frase riscontrata nel file',
  quote_not_found: 'La frase non è nel file',
  quote_too_short: 'Frase troppo breve per valere come prova',
  file_not_found: 'File non trovato',
  file_too_large: 'File troppo grande per il controllo',
  outside_project: 'File fuori dal progetto',
}

const errors: Record<ErrorCode, string> = {
  empty_question: 'Scrivi una domanda.',
  project_not_found: 'Questo progetto non è più in elenco.',
  path_outside_project:
    'Quello che hai scelto è fuori dalla cartella del progetto. Octo legge solo lì dentro: copia il file nella cartella e scegli la copia.',
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
    'Non riesco a leggere la posta di Mail. In Impostazioni di Sistema › Privacy e sicurezza › Accesso completo al disco, abilita Octo e riaprilo. Dopo un aggiornamento di Octo il permesso va rimesso: togli Octo dall’elenco con «−» e aggiungilo di nuovo con «+».',
  mail_reader_missing: 'Su questo sistema la lettura della posta non è ancora disponibile.',
  meetings_root_unreadable:
    'Non riesco ad aprire la cartella in cui Verbale esporta. Controlla in «Impostazioni» che sia quella giusta e che esista su questo computer.',
  meeting_not_found: 'Questa riunione non è più da assegnare: forse è già in un progetto.',
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
  not_signed_in: 'Per continuare devi entrare con il tuo utente aziendale.',
  sign_in_not_configured:
    'Octo non sa dove farti entrare: manca la configurazione dell’accesso aziendale. Chiedila a chi ti ha dato Octo.',
  sign_in_failed:
    'Non sono riuscito a farti entrare. Controlla la rete e riprova: senza accesso Octo non si apre.',
  sign_in_refused: 'L’accesso è riuscito, ma non con un utente dell’organizzazione di questo Octo.',
  sign_in_cancelled: 'Accesso interrotto. Riprova quando vuoi.',
  today_decision_invalid: 'Non ho capito che cosa fare di questa segnalazione.',
  risk_invalid: 'Questo rischio non c’è più nel registro.',
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
  hours_timesheet_missing: 'Non trovo esportazioni di timesheet nel posto indicato.',
  hours_worklog_missing: 'Non trovo esportazioni delle ore del tracker nel posto indicato.',
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
    'Indica il file di esportazione del tracker del cliente, qui o in «Cruscotto».',
  alignment_tickets_missing:
    'Non trovo ticket da confrontare: configura Jira in «Impostazioni» e leggi i ticket, oppure indica la cartella dove sono.',
  alignment_settings_invalid:
    'Le impostazioni dell’allineamento non sono valide: la cartella dei ticket deve stare nel progetto.',
  progress_model_not_set: 'Indica il file Excel del modulo vuoto.',
  progress_model_missing: 'Non trovo il file del modulo nel posto indicato.',
  progress_model_invalid:
    'Non riesco a scrivere nel modulo: non è un file Excel leggibile, o una cella indicata sta su una riga che il modulo non ha.',
  progress_settings_invalid:
    'Le impostazioni dell’avanzamento non sono valide: il modulo deve stare nella cartella del progetto.',
  progress_not_computable:
    'Non posso compilare il modulo. O c’è un problema segnalato qui sopra da correggere, o l’ordine ha più posizioni delle righe che hai indicato per la tabella del modulo: in quel caso aumenta il «numero di righe».',
  progress_request_missing: 'Questa richiesta non c’è più.',
  forecast_timesheet_not_set: 'Indica prima, in «Ore», dove sono i timesheet.',
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
  update_check_failed:
    'Non riesco a controllare se c’è una versione nuova di Octo. Riprovo più tardi.',
  update_unavailable: 'Non c’è una versione più nuova per questo computer.',
  update_download_failed:
    'Non riesco a scaricare la versione nuova: controlla la connessione e riprova.',
  update_checksum_missing:
    'La versione nuova non dichiara la sua impronta: non la installo, perché non posso verificarla.',
  update_signature_missing:
    'La versione nuova non porta la firma di chi pubblica Octo: non la installo.',
  update_signature_invalid:
    'La firma della versione nuova non è quella di chi pubblica Octo: non la installo. Non riprovare: avvisa chi ti ha dato Octo.',
  update_checksum_mismatch:
    'Il file scaricato non è quello pubblicato: non lo installo. Riprova; se succede ancora, scarica Octo a mano.',
  update_not_installable:
    'Non posso sostituire Octo dov’è ora. Spostalo nella cartella Applicazioni (non aprirlo dal disco di installazione) e riprova.',
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
