import type { AgentProgress } from '@octo/application'
import type { CitationStatus } from '@octo/domain'
import type { ErrorCode } from '../shared/api.ts'

/** Every text the PM reads, in one place: a second language is a second file like this. */
export const messages = {
  appName: 'Octo',
  projects: 'Progetti',
  addProject: 'Aggiungi progetto',
  removeProject: 'Togli dall’elenco',
  removeProjectHint: 'La cartella resta dov’è: Octo smette solo di mostrarla.',
  noProjectTitle: 'Nessun progetto',
  noProjectBody:
    'Un progetto è una cartella del tuo computer. Aggiungine una per fare domande su ciò che contiene.',
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
