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
      'Questo Octo non sa ancora dove farti entrare. Scrivi qui i due identificativi dell’accesso aziendale: te li dà chi usa già Octo. Non sono segreti.',
    tenantId: 'Identificativo dell’organizzazione (tenant)',
    clientId: 'Identificativo dell’applicazione (client)',
    whereToFind:
      'Chi usa già Octo li trova nel file «accesso.json» della cartella dei dati di Octo, alle voci «tenantId» e «clientId».',
    configure: 'Salva',
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
    hoursPeople: 'Persone le cui ore non tornano',
    hoursPerson: 'Persona',
    hoursTimesheet: 'Timesheet',
    hoursTracker: 'Tracker',
    hoursNoTimesheet: 'nessuno',
    hoursNoWorklog: 'nessuna',
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
    aside: {
      title: (count: number) =>
        count === 1 ? '1 riunione da assegnare' : `${count} riunioni da assegnare`,
      hint: 'Non sono in «Oggi» né fra le riunioni del progetto. Una riunione è del progetto quando partecipa una persona della sua squadra; se partecipano altri e nessuno della squadra, non lo è finché non lo dici tu.',
      list: 'Riunioni da assegnare',
      recorded: 'registrata con Verbale',
      invited: 'dal calendario',
      outside: 'non partecipa nessuno della squadra',
      claude: { other: 'Claude: non è di questo progetto', unknown: 'Claude: non so dirlo' },
      elsewhere: (project: string) => `I partecipanti sono persone del progetto «${project}».`,
      mine: 'È di questo progetto',
      notMine: 'Non è di questo progetto',
    },
    mailSeed: (who: string, subject: string) =>
      `Che cosa chiede ${who} nella mail «${subject}», entro quando, e che cosa serve per rispondere? Cita le fonti.`,
    showing: (shown: number, all: number) =>
      shown === all ? `${all} in elenco` : `${shown} di ${all} in elenco`,
    title: (day: string) => `Oggi · ${day}`,
    freshnessNever: 'mai letta',
    freshnessOldest: (count: number, source: string, when: string) =>
      `${count} fonti lette · la meno recente è ${source}: ${when}`,
    readNow: 'Leggi ora',
    reading: 'Leggo le fonti…',
    points: {
      title: 'Il punto',
      list: 'Open point in coda',
      queued: (count: number) =>
        count === 0 ? 'nessun open point' : count === 1 ? '1 in coda' : `${count} in coda`,
      freshCount: (count: number, since: string) =>
        count === 1 ? `1 nuovo dal ${since}` : `${count} nuovi dal ${since}`,
      closedCount: (count: number, since: string) =>
        count === 1 ? `1 chiuso dal ${since}` : `${count} chiusi dal ${since}`,
      toConfirmCount: (count: number) => `${count} da confermare`,
      fold: 'Riduci',
      unfold: 'Espandi',
      none: 'Nessun open point in coda',
      others: (count: number) =>
        count === 1 ? '1 punto di un’altra persona' : `${count} punti di altre persone`,
      othersList: 'Open point di altre persone',
      mine: 'tuo',
      of: (owner: string) => `di ${owner}`,
      openFor: (workdays: number) =>
        workdays === 0
          ? 'aperto oggi'
          : workdays === 1
            ? 'aperto da 1 giorno lavorativo'
            : `aperto da ${workdays} giorni lavorativi`,
      dueBy: (day: string) => `entro il ${day}`,
      overdue: (day: string, days: number) =>
        days === 1
          ? `era entro il ${day}: scaduto da 1 giorno`
          : `era entro il ${day}: scaduto da ${days} giorni`,
      late: 'Scaduto',
      fresh: 'Nuovo',
      byClaude: 'da Claude',
      raiseAt: (hour: string, meeting: string) => `↳ se ne parla oggi alle ${hour}: ${meeting}`,
      lastSaid: (day: string, said: string) => `${day}: ${said}`,
      resolve: 'Risolto',
      edit: 'Modifica',
      source: 'Fonte',
      drop: 'Non è un open point',
      dropHint: 'Non è un open point: lo tolgo e non lo ripropongo.',
      reopen: 'Riapri',
      stays: 'Resta in coda',
      toConfirm: 'Open point da confermare',
      toConfirmPill: 'Da confermare',
      closedButton: (count: number, since: string) =>
        count === 1 ? `Chiuso dal ${since}: 1` : `Chiusi dal ${since}: ${count}`,
      closedList: 'Open point chiusi',
      closedOn: (day: string) => `chiuso il ${day}`,
      closedBy: {
        pm: 'da te',
        claude: 'da quanto detto in riunione',
        signal: 'da solo: il dato è cambiato',
      },
      more: (count: number) => (count === 1 ? 'Mostra l’altro' : `Mostra gli altri ${count}`),
      fewer: 'Mostra meno',
      addTitle: 'Nuovo open point',
      addHint: 'Nuovo open point: che cosa va chiuso',
      titleLabel: 'Che cosa va chiuso',
      ownerLabel: 'Di chi',
      ownerHint: 'di chi (vuoto: tuo)',
      dueLabel: 'Entro il',
      add: 'Aggiungi',
      save: 'Salva',
      cancel: 'Annulla',
      editTitle: (title: string) => `Modifica: ${title}`,
      notRecorded: (meeting: string, day: string) =>
        `«${meeting}» del ${day} non è stata registrata: lì è stato risolto, o resta in coda?`,
      unverified: (said: string, meeting: string | null) =>
        meeting
          ? `Claude lo legge chiuso in «${meeting}», ma la frase non è nel file: ${said}`
          : `Claude lo legge chiuso, ma la frase non è nel file: ${said}`,
      unread: (count: number) =>
        count === 1
          ? '1 riunione registrata da leggere'
          : `${count} riunioni registrate da leggere`,
      neverClosed: 'Claude non ha ancora letto le riunioni di questo progetto',
      closedAt: (when: string, model: string | null) =>
        model ? `Riunioni lette il ${when} (${model})` : `Riunioni lette il ${when}`,
      closeDay: 'Chiudi la giornata',
      closing: 'Leggo le riunioni…',
      fromSignal: 'Segna come open point',
      fromSignalHint:
        'Resta in coda finché non è chiuso; si chiude da solo quando questa segnalazione sparisce.',
    },
    week: {
      title: 'Criticità della settimana',
      hint: 'Calcolate da Octo: ciò che è da risolvere adesso e ciò che arriva entro la settimana. Dal venerdì comprende la settimana dopo.',
      until: (day: string) => `fino al ${day}`,
      ongoing: 'In corso',
      coming: 'In arrivo',
      noneOngoing: 'Niente da risolvere.',
      noneComing: 'Niente in arrivo.',
      now: 'adesso',
      thisWeek: 'in settimana',
      overdue: (days: number) => (days === 1 ? 'scaduto da 1 giorno' : `scaduto da ${days} giorni`),
      kinds: { point: 'Open point', risk: 'Rischio', sprint: 'Sprint' },
      risk: (severity: string) => `Rischio · gravità ${severity}`,
      sprintEnd: 'Fine dello sprint',
      openRisks: 'Apri il registro',
    },
    prep: {
      title: (meeting: string) => `Scheda di preparazione: ${meeting}`,
      nothing: 'niente da portare',
      count: (count: number) => (count === 1 ? '1 cosa da portare' : `${count} cose da portare`),
      empty: 'Niente da portare a questa riunione: nessun open point, nessuna mail che aspetta.',
      points: 'Open point da portare',
      last: 'L’ultima volta',
      lastWhen: (title: string, day: string) => `${title}, registrata il ${day}`,
      openLast: 'Apri il riepilogo',
      stillOpen: (title: string) => `Nato lì e ancora aperto: ${title}`,
      closedThere: (title: string) => `Chiuso lì: ${title}`,
      mails: 'Posta di chi partecipa',
      numbers: 'Numeri del tracker',
      bring: 'Da portare, secondo Claude',
      preparing: 'Claude sta preparando che cosa portare…',
      copy: 'Copia la scheda',
      copied: 'Copiata',
      notifyBody: (project: string, minutes: number, count: number) =>
        count === 0
          ? `${project} · fra ${minutes} minuti`
          : count === 1
            ? `${project} · fra ${minutes} minuti · 1 cosa da portare`
            : `${project} · fra ${minutes} minuti · ${count} cose da portare`,
    },
    agenda: {
      list: 'Riunioni di oggi, in ordine d’orario',
      repeats: 'ricorrente',
      over: 'finita',
      openInvite: 'Apri l’invito',
      card: 'Scheda',
      andOthers: (named: string, others: number) =>
        others === 1 ? `${named} e un’altra persona` : `${named} e altre ${others} persone`,
      next: (day: string, meetings: string) => `Prossimo giorno (${day}): ${meetings}`,
    },
    now: 'Adesso',
    nowHint:
      'Ciò che viene prima, scelto da una regola: una riunione vicina, una scadenza, ciò che avevi rimandato a oggi, una mail importante, ciò che è peggiorato.',
    nowList: 'Cose che vengono prima',
    nowSummary: 'Perché contano oggi, secondo Claude',
    marks: { new: 'Nuovo', worse: 'Peggiorato' },
    nextReading: (minutes: number) =>
      minutes <= 0
        ? 'Prossima lettura fra poco'
        : minutes === 1
          ? 'Prossima lettura fra 1 minuto'
          : `Prossima lettura fra ${minutes} minuti`,
    notifyBody: (project: string) => `${project} · entra in «Adesso»`,
    notifyTitle: 'Notifica del sistema',
    notifyLabel: 'Avvisami con una notifica del sistema quando una voce entra in «Adesso»',
    notifyHint:
      'Una notifica al più per ogni lettura delle fonti, e nessuna mentre stai guardando «Oggi» di questo progetto.',
    notifyRefused:
      'Il sistema non permette a Octo di mostrare notifiche: aprile da Impostazioni di Sistema → Notifiche → Octo.',
    countLabel: (count: number) => (count === 1 ? '1 cosa da fare' : `${count} cose da fare`),
    nowSource: 'Apri la fonte',
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
    watchOthers: (count: number) =>
      count === 1
        ? '1 conversazione che non tocca a te'
        : `${count} conversazioni che non toccano a te`,
    watchOthersList: 'Conversazioni che non toccano a te',
    mutedNone: 'Nessuno: mostro ogni tipo di segnalazione.',
    nothing: 'Oggi Octo non ha nulla da segnalarti.',
    nothingToDo: 'Niente da fare oggi.',
    more: (count: number) => (count === 1 ? 'Mostra l’altra' : `Mostra le altre ${count}`),
    fewer: 'Mostra solo le prime',
    hiddenButton: (count: number, byClaude = 0) =>
      byClaude === 0
        ? `Messe da parte: ${count}`
        : `Messe da parte: ${count} · da Claude: ${byClaude}`,
    hiddenTitle: 'Segnalazioni messe da parte',
    hiddenNone: 'Nessuna segnalazione messa da parte.',
    hiddenWhat: 'Che cosa',
    hiddenState: 'Stato',
    hiddenSince: 'Da quando',
    hiddenActions: 'Azioni',
    hiddenStates: {
      done: 'Fatto',
      later: (day: string | null) => (day ? `Rimandato al ${day}` : 'Rimandato'),
      muted: 'Messo da parte',
      claude: 'Claude: non chiede un’azione',
    },
    hiddenWhy: (reason: string, quote: string) => `${reason} «${quote}»`,
    restoreMailHint: 'La mail torna fra quelle a cui rispondere, e Claude non la toglie più.',
    restore: 'Ripristina',
    resolvedToday: (count: number, kinds: string) => `Risolti da soli oggi: ${count} (${kinds}).`,
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
    laterSprintEnd: (day: string) => `A fine sprint (${day})`,
    laterDate: 'A una data',
    laterDateConfirm: 'Rimanda a questa data',
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
    muteOffers:
      'Hai messo da parte più volte segnalazioni di questi tipi. Scegli quelli che non vuoi più vedere:',
    muteKindNamed: (kind: string) => `Non mostrare più: ${kind}`,
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
      details: 'Dettagli: che cosa valuta Claude e che cosa calcola Octo',
      running: 'Claude sta valutando le mail…',
      update: 'Aggiorna la valutazione',
      all: 'Valuta di nuovo tutte',
      stop: 'Ferma',
      none: 'senza valutazione',
      importance: { alta: 'importanza alta', media: 'importanza media', bassa: 'importanza bassa' },
      verified: 'fonte controllata',
      unverified: 'frase non trovata nella mail',
      deadline: (day: string) => `chiede una risposta entro il ${day}`,
      filterToo:
        'Una mail che secondo Claude non chiede nulla, con la frase trovata nella mail, sta fra le messe da parte con il motivo: «Ripristina» la riporta fra quelle a cui rispondere. Sotto «Adesso» Claude scrive perché quelle voci contano oggi: le sceglie Octo con una regola, Claude le spiega, e una frase senza fonte controllata non viene mostrata.',
      risksToo:
        'Con la valutazione delle mail, una volta a settimana, Claude propone anche i rischi del progetto: li trovi nel registro dei rischi.',
      explain:
        'Che una mail aspetti lo calcola Octo. Se sei l’unico destinatario tocca a te; per le altre Claude legge a chi è rivolta la richiesta e quanto pesa: è un giudizio, con la frase su cui si fonda. Ciò che non tocca a te sta in «Da tenere d’occhio», una riga per conversazione.',
    },
    kinds: {
      source: 'Fonti',
      tracker_old: 'Tracker',
      mail_reply: 'Mail a cui rispondere',
      mail_follow: 'Mail da seguire',
      mail_waiting: 'In attesa di altri',
      hours: 'Ore',
      forecast: 'Previsionale',
      month_due: 'Scadenze del mese',
      bugs_stuck: 'Bug fermi',
      requirements: 'Requisiti poco chiari',
      draft: 'Deliverable in bozza',
      calendar: 'Calendario',
      meeting: 'Riunioni',
      risk: 'Rischi',
      risk_candidates: 'Rischi proposti',
    },
    open: {
      sources: 'Apri «Impostazioni»',
      hours: 'Apri «Ore»',
      forecast: 'Apri «Previsionale»',
      dashboard: 'Apri «Cruscotto»',
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
    due: 'Entro il',
    severity: 'Gravità',
    noSeverity: 'non detta',
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
    source: 'Apri la fonte',
    verified: 'fonte controllata',
    unverified: 'frase non trovata nel file',
    titleLabel: (title: string) => `Titolo del rischio «${title}»`,
  },
  nav: {
    sections: 'Sezioni del progetto',
    daily: 'Ogni giorno',
    work: 'Lavoro',
    monthly: 'Ogni mese',
    project: 'Progetto',
    working: 'Claude sta lavorando qui',
  },
  choosePath: 'Scegli…',
  lineList: 'Un valore per riga.',
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
    relocate: 'Cambia cartella…',
    relocateOf: (name: string) => `Cambia la cartella di ${name}`,
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
    /** Which marker the source shown is of, and of which answer of the conversation. */
    chosen: (marker: number, answer: number, answers: number) =>
      `Richiamo scelto: [${marker}] della risposta ${answer} di ${answers}`,
    freshHint:
      'In questa chat Octo tiene conto delle tue domande precedenti e ricontrolla le fonti a ogni risposta.',
    none: 'Nessuna chat ancora.',
    welcome: (project: string) => `Che cosa vuoi sapere di ${project}?`,
    ages: { today: 'Oggi', yesterday: 'Ieri', week: 'Ultimi 7 giorni', before: 'Prima' },
    legacy: 'Domande precedenti',
    filter: 'Cerca fra le chat',
    nothingFound: 'Nessuna chat corrisponde.',
    about: (when: string, questions: number) =>
      `${when} · ${questions === 1 ? '1 domanda' : `${questions} domande`}`,
  },
  askPlaceholder: 'Chiedi qualcosa su questo progetto…',
  askSubmit: 'Chiedi',
  askCancel: 'Ferma',
  tickets: {
    open: 'Crea su Jira i ticket mancanti…',
    title: 'Ticket mancanti da creare su Jira',
    about: (site: string) =>
      `È l’unica cosa che Octo scrive fuori dal progetto: crea su ${site} i soli ticket spuntati, uno per uno, quando confermi. Non modifica e non cancella nulla. Il titolo porta l’id della voce del cliente, così il prossimo allineamento li collega.`,
    none: 'Nessun ticket mancante in questo allineamento.',
    project: 'Progetto Jira in cui crearli (chiave)',
    projectHint: 'Per esempio: AUR',
    create: (count: number) => (count === 1 ? 'Crea 1 ticket…' : `Crea ${count} ticket…`),
    confirm: (count: number, key: string, site: string) =>
      `Sto per creare ${count === 1 ? '1 ticket' : `${count} ticket`} nel progetto ${key} di ${site}. Da Octo non si annulla.`,
    yes: 'Conferma e crea',
    creating: 'Creo i ticket…',
    created: (key: string) => `Creato: ${key}`,
    refused: 'Jira lo ha rifiutato: controlla tipo, progetto e permessi',
  },
  scripted: {
    title: 'Deliverable del progetto, con script',
    intro:
      'Lo script e i suoi dati sono file del progetto. Claude li esegue dentro il recinto: legge il progetto, scrive solo in una cartella di lavoro. Nel progetto entra solo ciò che salvi o approvi.',
    install: 'Aggiungi al progetto',
    run: 'Esegui',
    running: 'Eseguo…',
    files: (names: string) => `Prodotti, nella cartella di lavoro: ${names}.`,
    keep: 'Salva nel progetto',
    kept: (folder: string) => `Salvati nel progetto, in ${folder}.`,
    correct: 'Correggi a parole',
    correctHint:
      'Scrivi che cosa cambiare: un dato («aggiungi la richiesta 3, dal 1 al 31 maggio, 12.000 euro, fattura 104») o una regola. Claude prova la modifica nella cartella di lavoro e ti dice che cosa ha cambiato.',
    correctLabel: (title: string) => `Che cosa cambiare in «${title}»`,
    tryCorrection: 'Prova la correzione',
    correcting: 'Correggo…',
    correctionTitle: 'Correzione proposta',
    changed: (files: string) => `File cambiati: ${files}.`,
    seeFile: (name: string) => `Vedi ${name} come diventerebbe`,
    nothingChanged: 'Nessun file è cambiato.',
    approve: 'Approva la correzione',
    approveHint: 'Nel progetto entra ciò che vedi qui sopra, e solo allora.',
    approved: 'Correzione approvata: da ora ogni esecuzione usa i file nuovi.',
  },
  attach: {
    button: 'Allega…',
    hint: 'Copia un file nella conversazione: chi risponde lo legge insieme al progetto.',
    list: 'File allegati a questa conversazione',
  },
  computed: {
    option: 'Con calcoli',
    help: 'Che cosa fa «Con calcoli»',
    steps: [
      'Senza: Claude legge i file del progetto e risponde citandoli. Non fa conti: una somma la riporta solo se un file la scrive.',
      'Con: Claude può anche calcolare sui file (somme, confronti, conteggi su un Excel o un CSV) e ti dà una tabella con le fonti e il file prodotto.',
      'Accendilo quando la domanda chiede un numero che nessun file scrive già. Vale per la prossima domanda soltanto.',
    ],
    note: 'Claude legge il progetto senza poterlo modificare e scrive solo in una cartella di lavoro di Octo, senza rete. Nel progetto entra solo ciò che scegli di tenere.',
    computedFrom: 'Calcolata da:',
    inFile: (file: string) => `Per intero nel file ${file}.`,
    sourceMissing: (path: string) => `${path}: non trovato nel progetto`,
    noSource: 'La tabella non dice da quali file è calcolata: non è verificabile.',
    unverified: 'Una fonte della tabella non è nel progetto: controlla le cifre prima di usarle.',
    fileMissing: (file: string) =>
      `La risposta nomina il file ${file}, che il calcolo non ha scritto.`,
    files: (names: string) => `File del calcolo, nella cartella di lavoro di Octo: ${names}.`,
    keep: 'Salva i file nel progetto',
    kept: (folder: string) => `File salvati nel progetto, in ${folder}.`,
  },
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
  credential: {
    source: 'Fonte',
    state: 'Stato',
    sharedTitle: 'Credenziale di chi condivide la cartella.',
    sharedNote:
      'Su questo computer non c’è la credenziale, o la fonte da qui non si legge: vale la lettura fatta da un altro computer, di cui lo stato dice chi e quando. Per leggerla anche da qui, premi «Modifica» e inserisci la tua.',
  },
  elsewhere: {
    who: (reader: { name: string; computer: string }) => `${reader.name} · ${reader.computer}`,
    read: (who: string) => `Letta da ${who}`,
    reading: (who: string) => `In lettura da ${who}`,
  },
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
  readSavedSource: 'Leggi con le impostazioni salvate',
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
    host: 'Server (nome DNS o indirizzo IPv4 privato)',
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
      'Chi lavora al progetto e chi ne legge i risultati, e le date dei periodi. Risposte e deliverable li leggono e li citano.',
    people: 'Persone',
    hints: {
      allocation: 'L’allocazione è la parte del suo tempo sul progetto: vuota se non la sai.',
      dates: 'Le date restano vuote se la persona c’è dall’inizio o c’è ancora.',
      note: 'Ciò che un’email deve rispettare, per esempio «prima la richiesta».',
      address:
        'Con «come nelle mail» chi scrive segue le mail che le hai già mandato, e dà del lei se non ce ne sono.',
    },
    blank: { allocation: 'non indicata', from: 'dall’inizio', to: 'c’è ancora' },
    unnamed: 'Senza nome',
    show: (person: string) => `Mostra ${person}`,
    nothingToSave: 'Nessuna modifica da salvare',
    addressAuto: 'come nelle mail',
    periods: 'Calendario: periodi e sprint',
    columns: {
      name: 'Nome',
      role: 'Ruolo',
      side: 'Parte',
      allocation: 'Allocazione %',
      capDays: 'Tetto (giorni)',
      from: 'Dal',
      to: 'Al',
      note: 'Come scrivergli',
      address: 'Tu / lei',
      period: 'Periodo',
    },
    personN: (n: number) => `persona ${n}`,
    periodN: (n: number) => `periodo ${n}`,
    cell: (row: string, column: string) => `${column}, ${row}`,
    remove: (row: string) => `Togli ${row}`,
    removeShort: 'Togli',
    addPerson: 'Aggiungi una persona',
    addPeriod: 'Aggiungi un periodo',
    personWrong: (n: number) => `Persona ${n}: manca il nome.`,
    capWrong: (n: number) =>
      `Persona ${n}: il tetto è un numero di giorni maggiore di zero, per esempio 8 o 1,5.`,
    allocationWrong: (n: number) =>
      `Persona ${n}: l’allocazione è una percentuale, più di 0 e al massimo 100.`,
    periodWrong: (n: number) => `Periodo ${n}: servono il nome e le due date.`,
    save: 'Salva persone e calendario',
    saved: (people: number, periods: number) =>
      `Salvati: ${people === 1 ? '1 persona' : `${people} persone`} e ${periods === 1 ? '1 periodo' : `${periods} periodi`}.`,
    sides: { supplier: 'nostra', consultant: 'consulente', client: 'cliente' },
  },
  backup: {
    title: 'Se cambi computer',
    save: 'Copia di sicurezza',
    restore: 'Ripristina',
    hint: 'La copia tiene l’elenco dei progetti, le tue domande e ciò che questo computer sa delle letture. Le cartelle dei progetti vanno copiate a parte; le credenziali si rimettono.',
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
      'Con “Predefinito” usi il modello di Claude Code su questo computer. Accanto alla risposta o al deliverable trovi il modello usato.',
    task: {
      ask: 'Risposte in «Chiedi»',
      write: 'Scrittura dei deliverable',
      review: 'Rilettura critica dei deliverable',
    },
    byDefault: 'Predefinito di Claude Code',
    choice: { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' },
    save: 'Salva i modelli',
    saved: 'Modelli salvati: valgono dalla prossima domanda e dal prossimo deliverable.',
    nothingToSave: 'Nessuna modifica da salvare',
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
  sheetTab: 'Commessa',
  sheet: {
    parts: {
      summary: 'Sintesi',
      billing: 'Fatturazione',
      hours: 'Ore',
      forecast: 'Previsionale',
    },
    partsLabel: 'Schede della commessa',
    billing: {
      title: 'Fatturazione',
      notRead:
        'Non ho letto NetSuite: fatture e ordini a fornitore non ci sono. Collega NetSuite in «Impostazioni».',
      client: 'Al cliente',
      clientTable: 'Fatture al cliente per ordine di vendita',
      salesOrder: 'Ordine di vendita',
      noSalesOrder: 'Senza ordine di vendita',
      noInvoices: 'NetSuite non ha fatture su questa commessa.',
      total: 'Totale',
      suppliers: 'Dai fornitori',
      suppliersTable: 'Ordini a fornitore',
      vendor: 'Fornitore',
      noVendor: 'Fornitore non indicato',
      order: 'Ordine',
      noOrder: 'Senza ordine',
      ordered: 'Ordinato',
      received: 'Ricevuto',
      receivedNote: '«Ricevuto» è il costo sulla commessa.',
      source: 'Fonte',
      fromSystem: 'NetSuite',
      invoiced: 'Fatturato',
      toInvoice: 'Da fatturare',
      noSuppliers: 'Nessun ordine a fornitore su questa commessa.',
    },
    summary: {
      title: 'La commessa dall’inizio a oggi',
      loading: 'Leggo la commessa…',
      readingOrders: 'Chiedo a NetSuite ordini e fatture della commessa…',
      readingMonth: (month: string, at: number, total: number) =>
        `Leggo da NetSuite i timesheet di ${month}: mese ${at} di ${total}…`,
      missed: (why: string) =>
        `La lettura dei timesheet si è fermata: ${why} I mesi già letti restano.`,
      resume: 'Riprendi la lettura',
      code: 'Commessa',
      through: (month: string) =>
        `Dall’inizio della commessa a ${month}. Per i mesi ancora da leggere in NetSuite, le ore del tracker sono una stima.`,
      band: 'Le cifre della commessa',
      entries: 'Ordine, ricavi e da regolare',
      entry: 'Voce',
      value: 'Valore',
      byOcto: 'Octo',
      bySystem: 'NetSuite',
      orderNote: (order: string) => `ordine ${order}`,
      ordersNote: (count: number) => `${count} ordini di vendita`,
      byForecast: 'Previsionale',
      notKnown: 'non nota',
      atEnd: (shareText: string) => `a finire ${shareText}`,
      variance: 'Scostamento da NetSuite',
      varianceToCheck: 'Da verificare',
      varianceNone: 'Nessuno',
      invoicedPlain: 'Fatturato',
      recognizedPlain: 'Ricavi riconosciuti',
      suppliersLine: 'Fornitori',
      suppliersSource: 'ricevuto, da NetSuite',
      wip: 'Lavoro non fatturato',
      wipNote: 'WIP',
      toBill: 'Fatture da emettere',
      toBillNote: 'FRD',
      withSuppliers: (hours: string, amount: string) => `${hours} ore · fornitori ${amount}`,
      doubleCount:
        'Ci sono sia esterni dichiarati a mano sia ricevimenti da fornitore: se sono le stesse persone il costo è contato due volte. Togli dal «Previsionale» gli esterni che hanno un ordine a fornitore.',
      ledger: {
        title: 'Costi secondo NetSuite',
        group: 'Gruppo di costo',
        cost: 'Costo',
        total: 'Totale',
        none: 'NetSuite non ha ancora costi su questa commessa.',
        compare: (computed: string) =>
          `Calcolati da Octo: ${computed}. Lo scostamento è nella fascia in alto.`,
        same: (computed: string) => `Calcolati da Octo: ${computed}. Coincidono con NetSuite.`,
      },
      rules: {
        title: 'Come sono calcolate le cifre',
        intro: 'Le regole sono quelle della scheda progetto dell’amministrazione.',
        items: [
          ['Ordinato', 'somma dell’importo delle righe degli ordini di vendita.'],
          ['Fatturato', 'somma dell’importo delle righe fattura, note di credito comprese.'],
          ['Da fatturare', 'ordinato meno fatturato (nella scheda: residuo).'],
          ['Ricavi riconosciuti', 'somma dei ricavi che NetSuite ha registrato mese per mese.'],
          [
            'Costi a oggi',
            'ore di timesheet approvate al costo orario di oggi di ogni persona, come lo dà NetSuite (se manca, quello del suo ultimo timesheet), più le persone senza timesheet, più quanto ricevuto dai fornitori.',
          ],
          ['Margine a oggi', '(ordinato − costi a oggi) / ordinato.'],
          [
            'Avanzamento',
            'quello che NetSuite scrive per il periodo; se non lo scrive, ricavi riconosciuti su ordinato; se mancano anche quelli, costi a oggi sui costi totali previsti, detto come stima. In Octo non si scrive: si corregge nella scheda progetto.',
          ],
          ['Lavoro non fatturato', 'costi a oggi meno fatturato (nella scheda: WIP).'],
          [
            'Fatture da emettere',
            'ricavi riconosciuti meno fatturato (nella scheda: FRD); negativo, fatturato in anticipo.',
          ],
        ],
      },
      ordered: 'Ordinato',
      invoiced: 'Fatturato (NetSuite)',
      toInvoice: 'Da fatturare',
      recognized: 'Ricavi riconosciuti (NetSuite)',
      ofOrdered: (shareText: string) => `${shareText} dell’ordinato`,
      costs: 'Costi a oggi',
      hoursWorked: (hours: string) => `${hours} ore`,
      people: 'Ore e costi per persona',
      person: 'Persona',
      hours: 'Ore',
      cost: 'Costo',
      source: 'Fonte',
      sources: {
        timesheet: 'timesheet',
        declared: 'senza timesheet, dichiarate',
        no_timesheet: 'senza timesheet, ore dal tracker',
        estimate: 'stima: ore dal tracker, non ancora in NetSuite',
      },
      estimateMark: 'stima',
      estimated: (hours: string, costs: string) =>
        `Di cui stimati dal tracker: ${hours} ore, ${costs}. Sono le ore dei mesi il cui timesheet non è ancora in NetSuite, al costo orario dell’ultimo timesheet di ogni persona: una stima, da sostituire con il timesheet quando arriva.`,
      total: 'Totale',
      noLines: 'Nessuna ora sulla commessa nei timesheet letti.',
      withoutCost: (people: string) =>
        `Ore senza costo, fuori dal totale dei costi: ${people}. Il margine è più alto del vero.`,
      marginToDate: 'Margine a oggi',
      budgetCosts: 'Costi a budget',
      progress: 'Avanzamento',
      noProgress: 'NetSuite non lo dice, e mancano ordinato e costi totali per stimarlo',
      progressSources: {
        system: (day: string) => `da NetSuite, al ${day}`,
        /** In the table the column beside already names the source. */
        systemInTable: (day: string) => `al ${day}`,
        recognized: 'da NetSuite: ricavi riconosciuti sull’ordinato',
        costs: 'stima di Octo: costi a oggi sui costi totali previsti',
      },
      progressMail: (shareText: string, source: string) => `Avanzamento: ${shareText} (${source})`,
      marginAtEnd: 'Margine a finire',
      noExpected: 'servono i costi a budget o i costi totali previsti',
      onCosts: (costs: string) => `su costi previsti di ${costs}`,
      /** The same, short enough for one row of the table. */
      onCostsInTable: (costs: string) => `costi previsti ${costs}`,
      proposed: (costs: string, people: string) =>
        `Proposta dai tetti delle persone: ${costs} (${people}).`,
      proposedPerson: (person: string, days: string) => `${person} ${days} gg`,
      proposedWithoutCost: (people: string) =>
        `Fuori dalla proposta, perché non so quanto costa una loro ora: ${people}.`,
      useProposed: 'Usa come costi a budget',
      proposedInUse: 'Sono i costi a budget in uso.',
      copy: 'Copia i dati per un report',
      copied: 'Copiato: incollalo nel report o nella mail.',
    },
  },
  forecastTab: 'Previsionale',
  forecast: {
    loading: 'Preparo il previsionale…',
    ratesTitle: 'Tariffe e costi che NetSuite non dice',
    saveRates: 'Salva tariffe e costi',
    tables: {
      rates: {
        title: 'Tariffe al giorno',
        hint: 'Le persone e il costo delle loro ore arrivano dai timesheet di NetSuite: qui scrivi solo a quanto vendi una giornata. Senza commessa la tariffa vale ovunque; quella scritta per una commessa vince.',
        add: 'Aggiungi una tariffa',
      },
      externals: {
        title: 'Esterni senza timesheet',
        hint: 'Una riga per persona e commessa. Le ore le scrivi ogni mese, nei dati del mese della commessa.',
        add: 'Aggiungi un esterno',
      },
      hourlyCosts: {
        title: 'Persone senza timesheet, a costo orario',
        hint: 'Chi registra le ore solo sul tracker: il nome come sul tracker e quanto costa una sua ora. Vale quando il progetto ha una sola commessa.',
        add: 'Aggiungi una persona',
      },
    },
    columnHourlyCost: 'Costo orario',
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
    add: {
      external: 'Aggiungi un esterno',
    },
    wrong: {
      rates: (n: number) => `Tariffa ${n}: servono la persona e una tariffa scritta in cifre.`,
      externals: (n: number) =>
        `Esterno ${n}: servono nome, commessa, costo e tariffa scritti in cifre.`,
      hourlyCosts: (n: number) =>
        `Persona ${n}: servono il nome e un costo orario maggiore di zero, scritto in cifre.`,
      hours: (n: number) => `Riga ${n}: servono il nome e le ore scritte in cifre.`,
      project: (code: string) =>
        `${code}: l’ordinato va scritto in cifre, i mesi del canone come numero intero e l’inizio come anno e mese (2026-09).`,
    },
    projects: 'Commesse del progetto',
    projectsHint:
      'Una riga per ogni codice NetSuite che in «Ore» hai indicato come di questo progetto. Il tipo dice come nascono i ricavi: a giornate (giorni per tariffa), a corpo (avanzamento sull’ordinato) o a canone (ordinato in rate mensili uguali). L’ordinato arriva da NetSuite e puoi correggerlo. L’inizio è il mese del primo ordine: per una commessa a corpo Octo legge i timesheet da lì in poi; correggilo se il lavoro è cominciato prima.',
    columnKind: 'Tipo',
    columnOrdered: 'Ordinato',
    columnFeeMonths: 'Mesi del canone',
    columnStartMonth: 'Mese di inizio (AAAA-MM)',
    startMonthFormat: 'AAAA-MM',
    kinds: { time_material: 'A giornate (T&M)', fixed_price: 'A corpo', fee: 'Canone' },
    readOrders: 'Leggi ordinato da NetSuite',
    readingOrders: 'Leggo gli ordini…',
    readOrdersHint:
      'Nome e ordinato di ogni commessa: la somma delle righe dei suoi ordini. Per una commessa nuova anche il tipo di vendita, dalla voce dell’ordine; poi resta quello che scegli tu.',
    notInModel: (codes: string) => `Il modello non ha una riga per: ${codes}.`,
    monthData: 'Dati del mese',
    moreData: 'Calcolo e dettagli',
    forCode: (label: string, code: string) => `${label}, ${code}`,
    remedy: {
      save: 'Salva',
      of: (person: string, code: string) => `${person} su ${code}`,
      openCode: (code: string) => `Scrivi i costi di ${code}`,
    },
    setupIntro:
      'Calcolo il previsionale mensile delle sole commesse di questo progetto: i costi interni dal costo che NetSuite scrive su ogni riga di timesheet approvata, i ricavi secondo il tipo della commessa e le tariffe scritte nel suo budget. Ricavi, importo da fatturare e nota li puoi sempre correggere mese per mese. Il file Excel dell’amministrazione è facoltativo: se lo indichi ne compilo una copia, solo sulle righe di queste commesse.',
    modelPath: 'Modello (facoltativo): file Excel dell’amministrazione',
    hoursPerDay: 'Ore in una giornata',
    rates: 'Tariffe al giorno',
    hourlyCosts: 'Persone senza timesheet, a costo orario',
    save: 'Salva',
    settings: 'Impostazioni del previsionale',
    month: 'Mese',
    columnCode: 'Codice',
    columnProject: 'Progetto',
    columnInternal: 'Costi interni',
    columnExternal: 'Costi esterni',
    columnRevenue: 'Ricavi',
    columnDays: 'Giorni',
    columnProgress: 'Avanzamento',
    totalRow: 'Totale del progetto',
    none: '—',
    incomplete: 'dati incompleti',
    incompleteHint:
      'A questa riga manca qualcosa: costi, ricavi o margini sono più bassi o più alti del vero. Che cosa manca è in «Dati che mancano», qui sotto.',
    columnMarginMonth: 'Margine mese',
    columnMarginEnd: 'Margine finale',
    columnToInvoice: 'Da fatturare',
    howComputed: 'Come è calcolato:',
    columnOwnRevenue: 'Ricavi corretti',
    columnOwnNote: 'Tua nota',
    groupComputed: 'Calcolato da Octo',
    inputsHint:
      'I campi sono facoltativi. Se scrivi i ricavi corretti, sostituiscono quelli calcolati. Nel modello Excel ritrovi anche Da fatturare e Tua nota.',
    noRows:
      'Nessuna commessa: indica in «Ore» i codici NetSuite di questo progetto e leggi i timesheet.',
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
        `${code}: manca l’ordinato, i ricavi restano a zero. Leggilo da NetSuite o scrivilo nelle impostazioni.`,
      no_budget_costs: (code: string) =>
        `${code}: a corpo senza costi totali a budget, avanzamento e ricavi restano a zero`,
      no_fee_months: (code: string) =>
        `${code}: canone senza numero di mesi, i ricavi restano a zero. Scrivilo nelle impostazioni.`,
      unread_months: (code: string, months: string) =>
        `${code}: i timesheet di ${months} non sono stati letti da NetSuite, costi e avanzamento sono incompleti`,
    },
    unreadMonths: (months: string) =>
      `Timesheet non letti da NetSuite: ${months}. Octo li legge da solo quando NetSuite è collegato; qui non c’è riuscito. I numeri di questa pagina non li contano.`,
    notApproved: (hours: string) =>
      `${hours} ore del mese non ancora approvate: restano fuori dal previsionale`,
    orphanCodes: (codes: string) =>
      `Per ${codes} hai scritto dati di questo mese (ore di esterni, ricavi, importi), ma non è fra le commesse del progetto: non sono contati. Se è una commessa del progetto, aggiungila ai codici in «Ore»; altrimenti puoi ignorare questa riga.`,
    proposedRate: (rate: string, code: string) => `Usa ${rate}, come su ${code}`,
    copyRates: (count: number, from: string, to: string) =>
      count === 1
        ? `Su ${to} usa per 1 persona la tariffa che ha su ${from}`
        : `Su ${to} usa per ${count} persone la tariffa che hanno su ${from}`,
    copyRatesHint:
      'La commessa è nuova e non ha tariffe: propongo quelle dell’ultima commessa su cui ogni persona ne ha una. Controllale: da una commessa all’altra possono cambiare.',
    otherCodes: (codes: string) =>
      `Nei timesheet del mese ci sono ore approvate su codici che non sono di questo progetto: ${codes}`,
    inputsTitle: (code: string) => `Dati del mese per ${code}`,
    externals: 'Ore degli esterni nel mese',
    toInvoice: 'Da fatturare nel mese',
    budgetCosts: 'Costi totali a budget',
    budgetCostsHint:
      'Solo per un progetto a corpo: quanto hai previsto di spendere in tutto. L’avanzamento è la parte di questa cifra già spesa fino al mese. Lo scrivi una volta: vale anche per i mesi successivi.',
    totalCosts: 'Costi totali previsti a fine progetto',
    totalCostsHint:
      'Quanto pensi che costerà il progetto quando sarà finito. Serve a calcolare il margine finale; senza, quella colonna resta vuota.',
    totalCostsBeforeMonth:
      'La cifra qui sopra arriva fino al mese scorso: aggiungi tu i costi di questo mese',
    missing: 'manca',
    ownTitle: (project: string, month: string) => `${project} — i tuoi dati di ${month}`,
    /** A project as it is named in a row: its name, then its code. */
    project: (name: string, code: string) => (name === '' ? code : `${name} · ${code}`),
    projectName: (name: string, code: string, kind: string) =>
      `${name === '' ? 'Nome non ancora letto da NetSuite' : name} · ${code} · ${kind}`,
    saveInputs: 'Salva i dati del mese',
    compile: 'Compila il modello Excel',
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
    notRead: {
      timesheets: (month: string) => `Non letti per ${month}`,
      tracker: (month: string) => `Non lette per ${month}`,
    },
    read: { timesheets: 'Letti', tracker: 'Lette' },
    shortNote: {
      timesheets: 'con il tuo utente di sola lettura, per i mesi interi del periodo',
      tracker:
        'con il tuo token di sola lettura: di ogni registrazione tengo persona, giorno, ore e ticket',
    },
    about: 'Che cosa legge e che cosa tiene',
    period: 'il periodo scelto',
    comparisonLater: 'Il confronto delle ore compare qui dopo le due letture.',
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
    cutoff: 'Confronta fino al',
    cutoffHint:
      'Le ore dei giorni successivi restano fuori dal confronto. Lascia vuoto per usare tutto il periodo scelto.',
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
      expected: 'Assenza prevista',
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
      `Possibili ore contate due volte: ${hours} ore uguali per persona e giorno sui codici ${first} e ${second}. Può essere una giornata divisa a metà fra due commesse, e allora va bene così. Oppure le ore sono state spostate da un codice all’altro e nella cartella resta un’esportazione vecchia: in quel caso togli il file o il codice superato.`,
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
    trackerNames: { ado: 'Azure DevOps', jira: 'Jira' },
    trackerUnlinked:
      'Né Azure DevOps né Jira sono collegati a questo progetto: collegane uno in «Impostazioni», poi torna qui a leggere.',
    saveNeeds: 'Per salvare indica il file dell’esportazione.',
    setupTitle: 'Da dove leggo bug e requisiti',
    setupIntro: (tracker: string) =>
      `Il cruscotto si calcola da un’esportazione del tracker tenuta nella cartella del progetto: la leggo io da ${tracker} qui sotto, oppure indichi un file che hai già. Non scrivo mai nel tracker.`,
    trackerTitle: (tracker: string) => `Leggi da ${tracker}`,
    trackerIntro: {
      ado: 'Leggo adesso le voci del progetto e delle aree indicati in «Impostazioni», con il tuo token personale di sola lettura, e per i bug anche i cambi di stato e i commenti. Li tengo in un file del progetto e il cruscotto si calcola da lì. Può volerci qualche minuto.',
      jira: 'Azure DevOps non è collegato a questo progetto: leggo da Jira le issue dei progetti indicati in «Impostazioni», con il tuo token personale di sola lettura, e per bug e storie anche i cambi di stato e i commenti. Le tengo in un file del progetto e il cruscotto si calcola da lì. Può volerci qualche minuto.',
    },
    readTracker: (tracker: string) => `Leggi da ${tracker}`,
    readingTracker: (tracker: string) => `Sto leggendo ${tracker}…`,
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
    periods:
      'Periodi di pianificazione da controllare per i requisiti (nessuno: il prossimo sprint)',
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
    timeUnknown: 'tempo non noto',
    noFigure: 'nessun dato',
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
    days: (value: number | null) =>
      value === null ? '—' : `${value.toLocaleString('it-IT', { maximumFractionDigits: 1 })} gg`,
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
    tabsLabel: 'Parti del cruscotto',
    tabs: { sprint: 'Sprint', bugs: 'Bug', trend: 'Andamento', activities: 'Attività' },
    hiddenTabs: (names: string) => `Senza dati in questo tracker, quindi non mostrate: ${names}.`,
    /** How a tracker calls what orders its items by importance. */
    severityNames: { ado: 'Gravità', jira: 'Priorità' },
    bugTypes: 'Tipi che conto come bug',
    storyTypes: 'Tipi che conto come storie',
    typesHint: (types: string) =>
      `Tipi letti dal tracker: ${types}. Una voce di un tipo non scelto non entra né fra i bug né fra le storie.`,
    activities: {
      title: 'Attività',
      intro:
        'Ogni voce del perimetro, di qualunque tipo, con le ore registrate sul tracker e l’ultimo commento. Le ore sono quelle lette in «Ore».',
      columnItem: 'Voce',
      columnTitle: 'Titolo',
      columnState: 'Stato',
      columnAssignee: 'Chi',
      columnHours: 'Ore',
      columnLast: 'Ultimo commento',
      noComment: '—',
      commentOf: (by: string, when: string) => `${by} · ${when}`,
      diary: (id: string, count: number) =>
        count === 1 ? `Diario di ${id}: 1 commento` : `Diario di ${id}: ${count} commenti`,
      open: (id: string) => `Apri il diario di ${id}`,
      close: (id: string) => `Chiudi il diario di ${id}`,
      total: 'Totale',
      people: 'Ore per persona',
      columnPerson: 'Persona',
      columnCap: 'Tetto',
      cap: (hours: string, days: string, share: string) =>
        `${hours} h (${days} gg) · usato ${share}`,
      noCap: '—',
      overCap: 'oltre il tetto',
      noHours:
        'Nessuna ora registrata sulle voci del perimetro: leggi le ore del tracker in «Ore».',
      otherHours: (hours: string) =>
        `${hours} ore sono su voci fuori dal perimetro o che il tracker non ha più: non sono contate qui.`,
    },
    refreshing: (tracker: string) => `I dati hanno più di un giorno: rileggo ${tracker}…`,
    undo: 'Annulla',
    decided: 'Fatto.',
    sinceStart: (delta: number) =>
      delta === 0
        ? 'come a inizio periodo'
        : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} da inizio periodo`,
    noHistoryDelta: 'Senza cronologia non confronto i numeri con l’inizio del periodo.',
    breakdownsLabel: 'Dove si concentrano',
    facets: { severity: 'Per gravità', environment: 'Per ambiente', assignee: 'Per persona' },
    facetNames: { severity: 'Gravità', environment: 'Ambiente', assignee: 'Persona' },
    notStated: 'Non indicato',
    ofWhichStuck: (count: number) =>
      count === 0 ? '' : `${count} ${count === 1 ? 'fermo' : 'fermi'}`,
    filterBy: (facet: string, value: string) => `Solo ${facet.toLowerCase()}: ${value}`,
    search: 'Cerca per id o titolo',
    order: 'Ordina per',
    orders: { days: 'Giorni nello stato', severity: 'Gravità', created: 'Data di apertura' },
    activeFilters: 'Filtri',
    removeFilter: (name: string) => `Togli il filtro ${name}`,
    clearFilters: 'Togli i filtri',
    shown: (shown: number, of: number) => `${shown} di ${of}`,
    openInTracker: (tracker: string) => `Apri su ${tracker}`,
    notLinked: 'Questa voce non ha un indirizzo sul tracker.',
    waitingTitle: (count: number) => `Da sollecitare: ${count}`,
    waitingIntro: (days: number) =>
      `Bug e storie non chiusi il cui ultimo commento chiede qualcosa e aspetta da almeno ${days} ${days === 1 ? 'giorno lavorativo' : 'giorni lavorativi'}. Li trova il codice; Octo non scrive nel tracker e non invia nulla.`,
    waitingNone: 'Nessuna voce aspetta una risposta.',
    waitingNoneFromClient: 'Nessuna voce aspetta una risposta dal cliente.',
    onlyClient: 'Solo in attesa del cliente',
    sidesUnknown:
      'Per distinguere chi aspetta il cliente servono le persone delle due parti in «Impostazioni».',
    asked: (by: string, when: string, days: number) =>
      `${by} · ${when} · ${days} ${days === 1 ? 'giorno lavorativo' : 'giorni lavorativi'}`,
    kinds: { bug: 'Bug', story: 'Storia' },
    draftReminder: 'Prepara il sollecito',
    draftingReminder: 'Claude scrive il sollecito…',
    reminderFor: (to: string | null) => (to ? `Sollecito per ${to}` : 'Sollecito'),
    reminderHint: 'È una bozza da copiare: la mandi tu, da dove vuoi.',
    copy: 'Copia',
    copied: 'Copiato.',
    needsClaude: 'Serve Claude Code su questo computer.',
    sprintLabel: 'Sprint',
    sprintRunning: 'in corso',
    sprintDates: (from: string, to: string) => `dal ${from} al ${to}`,
    sprintNoDates:
      'Il calendario del progetto non ha un periodo con il nome di questo sprint: non so quando finisce. Aggiungilo in «Impostazioni», fra persone e calendario.',
    sprintEnding: 'Lo sprint è agli ultimi giorni',
    noSprint:
      'Nessuno sprint in corso: le voci del tracker non portano uno sprint, oppure il calendario del progetto non ha un periodo con il suo nome che comprende oggi. Scegline uno dal menu, se c’è.',
    noSprintAtAll: 'Le voci del perimetro non portano uno sprint.',
    storiesTitle: 'Storie dello sprint',
    stages: {
      all: 'Storie',
      todo: 'Da fare',
      work: 'In lavorazione',
      verify: 'In verifica',
      validated: 'Validate',
      closed: 'Chiuse',
    },
    stageFilter: 'Scegli quali storie elencare',
    noStories: 'Nessuna storia con questo filtro.',
    sprintBugsTitle: 'Bug dello sprint',
    sprintBugsOpen: 'Aperti',
    sprintBugsClosed: 'Validati o chiusi',
    showSprintBugs: (count: number) => `Mostra i ${count} bug`,
    riskTitle: (count: number) =>
      `A rischio: ${count} ${count === 1 ? 'storia non è' : 'storie non sono'} ancora in verifica`,
    comparisonTitle: 'Sprint a confronto',
    comparisonIntro:
      'Storie che oggi stanno in ogni sprint. «Chiuse in tempo» conta quelle validate o chiuse entro l’ultimo giorno, dalla cronologia.',
    comparisonColumns: {
      sprint: 'Sprint',
      stories: 'Storie',
      done: 'Validate o chiuse',
      inTime: 'Chiuse in tempo',
      open: 'Ancora aperte',
      bugs: 'Bug entrati',
    },
    comparisonUnknown:
      'Senza cronologia delle storie o senza le date dello sprint il dato non c’è.',
    requirementsScope: (sprint: string | null, byHand: boolean) =>
      byHand
        ? 'Controllo i periodi scelti nelle impostazioni.'
        : sprint
          ? `Controllo solo le storie del prossimo sprint: ${sprint}.`
          : 'Non so quale sia il prossimo sprint: controllo tutte le storie da lavorare.',
    decisionsLabel: 'Decisioni prese',
    decisionsTitle: (count: number) => `Decisioni prese: ${count}`,
    decisionsNone: 'Nessuna decisione presa.',
    decisionKinds: { clear: 'È chiaro', signal: 'Segnale tolto', note: 'Nota' },
    decisionColumns: { item: 'Voce', decision: 'Decisione', since: 'Da quando' },
    restore: 'Ripristina',
    removeNote: 'Togli la nota',
    itemGone: 'non più nel tracker',
    flowBefore: (value: number | null) =>
      value === null
        ? ''
        : `periodo prima: ${value.toLocaleString('it-IT', { maximumFractionDigits: 1 })} gg`,
    commentTitle: 'Che cosa dice Claude dei numeri',
    commentIntro:
      'A richiesta. I numeri restano quelli calcolati qui: una frase con un numero diverso, o con una voce che il tracker non ha, non viene mostrata.',
    comment: 'Commenta il periodo',
    commenting: 'Claude legge i numeri…',
    commentAgain: 'Commenta di nuovo',
    commentOf: (when: string) => `Scritto il ${when}`,
    commentOld: 'I dati o il periodo sono cambiati da quando è stato scritto.',
    commentEmpty: 'Claude non ha trovato nulla da segnalare in questo periodo.',
    commentDropped: (count: number) =>
      `${count} ${count === 1 ? 'frase tolta' : 'frasi tolte'}: ${count === 1 ? 'citava' : 'citavano'} numeri o voci che qui non ci sono.`,
    answerWorkdays: 'Giorni lavorativi dopo i quali una domanda senza risposta è «da sollecitare»',
    phase: {
      work: 'Lavorazione',
      verify: 'Verifica',
      validated: 'Validato',
      closed: 'Chiuso',
    },
  },
  deliverablesTab: 'Deliverable',
  deliverableNew: 'Nuovo deliverable',
  deliverableMaking: 'In scrittura…',
  ownKindNew: 'Crea un tipo tuo',
  ownKindBadge: 'Tuo',
  ownKindIntro:
    'Descrivi a parole un deliverable che prepari spesso: Octo lo aggiunge al catalogo di questo progetto e lo scrive con gli stessi controlli degli altri.',
  ownKindTitle: 'Come si chiama',
  ownKindSummary: 'A che cosa serve (una riga)',
  ownKindAudience: 'Chi lo legge',
  ownKindQuestions: 'Domande da fare prima della bozza',
  ownKindQuestionsHint:
    'Scrivi una domanda per riga. Aggiungi * alla fine delle domande obbligatorie.',
  ownKindInstructions: 'Come va scritto',
  ownKindInstructionsHint:
    'Struttura, tono, che cosa non deve mai mancare, che cosa non va mai detto. Puoi incollare qui le istruzioni che usi già.',
  ownKindChecklist: 'Che cosa controllare prima di approvare (una voce per riga)',
  ownKindSave: 'Salva nel catalogo',
  ownKindEdit: 'Modifica',
  ownKindRemove: 'Elimina',
  kindCorrection: {
    title: 'Come Octo scrive questo tipo',
    intro:
      'Di’ a parole che cosa cambiare in come viene scritto. Claude riscrive le istruzioni, tu le leggi e decidi. Vale per questo progetto.',
    corrected: 'Questo progetto usa istruzioni corrette da te.',
    words: 'Che cosa va cambiato',
    ask: 'Proponi la correzione',
    asking: 'Riscrivo le istruzioni…',
    proposed: 'Istruzioni proposte',
    approve: 'Usa queste istruzioni',
    discard: 'Scarta',
    approved: 'Fatto: da ora questo tipo si scrive così in questo progetto.',
    restore: 'Torna alle istruzioni di Octo',
    restored: 'Questo tipo è tornato alle istruzioni di Octo.',
    now: 'Istruzioni in uso',
  },
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
    'Qui trovi i tempi e i giri di revisione. Le pause oltre 20 minuti sono escluse dal tempo di revisione.',
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
  deliverableRegisterApproved: (count: number) => `Approvati: ${count}`,
  deliverableNone: 'Nessun deliverable ancora. Scegline uno dal catalogo.',
  deliverableChoose: 'Che cosa vuoi preparare?',
  memoryKinds: {
    title: 'Memoria del progetto',
    about:
      'Non sono testi da mandare: sono le pagine che Octo fa leggere per prime a Claude a ogni domanda e a ogni deliverable. Aggiornale ogni tanto (i fatti di oggi, le decisioni prese, la cronologia): le risposte diventano più giuste e più brevi da controllare.',
    /** How the title of a kind of the memory begins: left out where the heading already says it. */
    prefix: /^Memoria:\s*/,
  },
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
  deliverableRedTeamFixApproved: 'La rilettura segnalava correzioni prima dell’invio.',
  deliverableSeverity: { grave: 'Grave', media: 'Media', lieve: 'Lieve' },
  deliverableChecklist: 'Da controllare prima di approvare',
  deliverableChange: 'Che cosa vuoi cambiare?',
  deliverableChangeSubmit: 'Chiedi modifica',
  deliverableApprove: 'Approva',
  deliverableFiles: 'File pronti',
  deliverableFailed: 'La scrittura non è riuscita.',
  deliverableLastChangeFailed: 'L’ultima modifica non è riuscita: la bozza è rimasta com’era.',
  deliverableRounds: (rounds: number) => (rounds === 1 ? '1 giro' : `${rounds} giri`),
  deliverableSourcesNote:
    'I numeri fra parentesi rimandano alle fonti: spariscono dal file approvato.',
  guideTitle: 'Avvio del progetto',
  guideIntro: 'Collega ciò che alimenta la memoria di questo progetto: ogni riga è facoltativa.',
  guideFill: 'Leggi tutte le fonti',
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
  meetingsHeld: {
    title: 'Riunioni di questo progetto',
    intro:
      'Una riunione finita nel progetto sbagliato si sposta da qui. Con la riunione vanno via i punti aperti che Octo ne aveva tratto; il progetto che la riceve la rilegge alla prossima chiusura della giornata. Questo progetto non la riprenderà più da solo: per riaverla va assegnata di nuovo a mano.',
    noProject: 'Nessun progetto',
    targetOf: (title: string) => `Dove va «${title}»`,
    moveOf: (title: string) => `Sposta o togli «${title}»`,
    move: 'Sposta',
    release: 'Togli dal progetto',
    confirmMove: (name: string) =>
      `La sposto a «${name}» e tolgo da qui i punti aperti che ne vengono.`,
    confirmRelease:
      'La tolgo da questo progetto con i punti aperti che ne vengono: torna fra le riunioni da assegnare.',
    confirm: 'Conferma',
    cancel: 'Annulla',
    moved: (name: string) => `Riunione spostata a «${name}».`,
    released: 'Riunione tolta dal progetto.',
  },
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
    showOptions: (count: number) => `Scegli tra ${count} opzioni`,
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
    widthOf: (label: string) => `Larghezza della colonna ${label}`,
    widthHint:
      'Trascina per allargare o stringere la colonna; doppio clic per tornare alla larghezza di Octo.',
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
  glossary: {
    title: 'Glossario: sigle e nomi sentiti male',
    short: 'la forma giusta di ciò che le trascrizioni scrivono come lo sentono',
    intro:
      'Le trascrizioni delle riunioni scrivono sigle e nomi come li sentono. Qui dici la forma giusta: Octo la mette nelle trascrizioni quando entrano nel progetto e la dà a chi scrive i deliverable. Claude propone le coppie, tu le approvi.',
    heard: 'Come viene scritta',
    right: 'Forma giusta',
    add: 'Aggiungi una coppia',
    cell: (column: string, row: number) => `${column}, coppia ${row}`,
    remove: (row: number) => `Togli la coppia ${row}`,
    save: 'Salva il glossario',
    propose: 'Chiedi a Claude le coppie',
    asking: 'Leggo le trascrizioni…',
    proposed: 'Coppie proposte da Claude',
    pair: (heard: string, right: string) => `«${heard}» → «${right}»`,
    accept: 'Aggiungi',
    acceptOf: (heard: string) => `Aggiungi al glossario: ${heard}`,
    dismiss: 'Scarta',
    dismissOf: (heard: string) => `Scarta la proposta: ${heard}`,
  },
  reader: {
    content: 'Testo della fonte',
    loading: 'Apro la fonte…',
    unreadable: 'Non riesco a leggere questo file dentro Octo: aprilo con il sistema.',
    openWithSystem: 'Apri con il sistema',
    quoteNotFound: 'La frase citata non è in questo testo: te lo mostro dall’inizio.',
  },
  citation: {
    panel: 'Fonte citata',
    marker: (n: number) => `Fonte ${n}`,
    markerMissing: (n: number) => `Richiamo ${n} senza fonte`,
    none: 'Scegli un richiamo nella risposta per vedere qui la fonte, senza perdere il testo.',
    noSources: 'Questa risposta non cita fonti: prendila come non verificata.',
    orphan: (n: number) =>
      `Il richiamo [${n}] non ha una fonte: ciò che gli sta accanto non è appoggiato a nessun file.`,
    found: 'Frase riscontrata nel file',
    foundNote: 'Leggi il contesto della fonte per valutare la conclusione.',
    notFoundNote:
      'Questa citazione non regge il controllo: verifica sull’originale prima di usarla.',
    open: 'Apri la fonte',
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
    computed: 'Calcolato da Octo',
    judged: 'Valutato da Claude',
    draft: 'Bozza',
    seen: 'Visto',
    seenDone: 'Visto ✓',
    left: (count: number) =>
      count === 0
        ? 'Tutti i rilievi rivisti'
        : count === 1
          ? '1 rilievo da rivedere'
          : `${count} rilievi da rivedere`,
    reset: 'La bozza è cambiata: i rilievi sono da rivedere di nuovo.',
    pending: 'La rilettura critica è in corso: i rilievi arrivano qui.',
    fix: 'Correggi',
    fixWhat: 'Che cosa cambiare qui (vuoto: decide Claude)',
    fixSubmit: 'Riscrivi solo questo passo',
    fixRequest: (where: string, finding: string, words: string) =>
      [
        `Riscrivi solo questo passo della bozza: «${where}».`,
        `Il rilievo della rilettura critica: ${finding}`,
        ...(words === '' ? [] : [`Che cosa cambiare: ${words}`]),
        'Lascia tutto il resto del testo esattamente com’è, parola per parola.',
      ].join('\n'),
    proposed: (findings: readonly string[]) =>
      findings.length === 0
        ? ''
        : ['Correggi i rilievi della rilettura critica:', ...findings.map((f) => `- ${f}`)].join(
            '\n',
          ),
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
  fence_unavailable:
    'Su questo computer Claude non può fare calcoli in sicurezza: la protezione del sistema che lo tiene dentro la cartella di lavoro non parte. Octo non lo fa calcolare senza. Su Windows serve WSL2, con Claude Code installato dentro la distribuzione, e il progetto su un disco del PC (non su una condivisione di rete). Chiedi senza «Con calcoli».',
  fence_interpreter_missing:
    'Manca l’interprete che Octo usa per i calcoli: reinstalla Octo. Intanto chiedi senza «Con calcoli».',
  work_not_found: 'Non trovo più i file di questo calcolo su questo computer.',
  catalog_invalid:
    'Il catalogo dei deliverable di Octo non è leggibile: un suo file manca o è stato modificato male. Reinstalla Octo.',
  scripted_not_found: 'Questo deliverable non c’è, né nel progetto né fra quelli di Octo.',
  scripted_invalid:
    'Il file che descrive questo deliverable (deliverable.json) non è leggibile, o nomina un percorso fuori dal progetto.',
  scripted_input_missing:
    'Manca un dato che lo script si aspetta: l’esportazione del tracker del cliente o i ticket letti dalla fonte Jira. Controlla il Cruscotto e le fonti.',
  scripted_result_invalid:
    'Lo script non ha lasciato un esito leggibile: non uso niente di ciò che ha scritto. Prova «Correggi a parole» dicendo che cosa è successo.',
  scripted_model_missing:
    'Il modulo da compilare non è nel progetto, al percorso scritto nella configurazione.',
  agent_cancelled: 'Domanda fermata.',
  source_not_configured: 'Questa fonte non è ancora configurata.',
  source_config_invalid: 'Controlla il giorno di inizio e la cartella: uno dei due non è valido.',
  source_busy: 'Una lettura è già in corso.',
  source_busy_elsewhere:
    'Un altro computer che condivide la cartella sta leggendo questa fonte. Riprova fra poco: la sua lettura vale anche qui.',
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
  sign_in_setup_invalid:
    'Uno dei due identificativi non è scritto bene. Quello dell’organizzazione ha la forma 00000000-0000-0000-0000-000000000000; copiali così come sono.',
  sign_in_not_configured:
    'Octo non sa dove farti entrare: manca la configurazione dell’accesso aziendale. Chiedila a chi ti ha dato Octo.',
  sign_in_failed:
    'Non sono riuscito a farti entrare. Controlla la rete e riprova: senza accesso Octo non si apre.',
  sign_in_refused: 'L’accesso è riuscito, ma non con un utente dell’organizzazione di questo Octo.',
  sign_in_cancelled: 'Accesso interrotto. Riprova quando vuoi.',
  today_decision_invalid: 'Non ho capito che cosa fare di questa segnalazione.',
  risk_invalid: 'Questo rischio non c’è più nel registro.',
  open_point_invalid: 'Questo open point non c’è più, o gli manca il titolo.',
  deliverable_input_missing: 'Manca un campo obbligatorio.',
  deliverable_kind_unknown: 'Questo tipo di deliverable non esiste più.',
  deliverable_kind_invalid: 'Servono un titolo e le istruzioni; le domande sono al massimo otto.',
  deliverable_not_found: 'Questo deliverable non c’è più.',
  deliverable_not_ready: 'Questo deliverable non è in revisione.',
  deliverable_busy: 'Sto già scrivendo questo deliverable.',
  request_empty: 'Scrivi che cosa vuoi cambiare.',
  tracker_export_not_set: 'Scegli il file dell’esportazione del tracker.',
  tracker_item_not_waiting: 'Questa voce non aspetta più una risposta: rileggi il tracker.',
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
  attachment_unsupported:
    'Non so leggere questo formato. Posso allegare Word, Excel, PowerPoint, PDF e file di testo (md, txt, csv, json).',
  attachment_too_large: 'Questo file è troppo grande per essere allegato: il limite è 100 MB.',
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
  computing: 'Calcolo',
  writing: 'Scrivo la risposta',
  checking: 'Bozza scritta: controllo le fonti una per una',
  reviewing: 'Rilettura critica in corso: la bozza si può già leggere',
}

export const citationStatusText = (status: CitationStatus): string => citationStatus[status]
export const errorText = (code: ErrorCode): string => errors[code]
export const progressText = (step: AgentProgress): string =>
  step.target ? `${progress[step.kind]} ${step.target}` : progress[step.kind]

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' })
const TIME_FORMAT = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' })

export const dateText = (iso: string): string => DATE_FORMAT.format(new Date(iso))
export const dateTimeText = (iso: string): string => TIME_FORMAT.format(new Date(iso))
