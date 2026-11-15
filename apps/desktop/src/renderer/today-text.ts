import type { ForecastGap, HoursPersonFact, TodayFacts, TodayItem } from '@octo/domain'
import { dateTimeText, errorText } from './messages.ts'

/** What a signal says to the PM: a line to read first, and one that explains it. */
export type SignalText = { title: string; detail: string }

const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const MONTH = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DAY = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const HOUR = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
})

const hours = (value: number): string => NUMBER.format(value)
export const monthText = (month: string): string => MONTH.format(new Date(`${month}-01T00:00:00Z`))
export const dayText = (day: string): string => DAY.format(new Date(`${day}T00:00:00Z`))
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const since = (days: number): string =>
  days === 0 ? 'da oggi' : days === 1 ? 'da ieri' : `da ${days} giorni`
const within = (days: number): string =>
  days === 0 ? 'oggi' : days === 1 ? 'domani' : `fra ${days} giorni`
const count = (value: number, one: string, many: string): string =>
  value === 1 ? `1 ${one}` : `${value} ${many}`

/** The name of who wrote a mail, without the address when there is a name. */
export const personOf = (line: string): string => {
  const name = line
    .replace(/<[^<>]*>/g, '')
    .replace(/"/g, '')
    .trim()
  return name === '' ? line.replace(/[<>]/g, '').trim() : name
}

function personLine(person: HoursPersonFact): string {
  if (person.status === 'no_worklog') {
    return `${person.person}: ${hours(person.timesheetHours)} ore di timesheet, nessuna sul tracker`
  }
  if (person.status === 'no_timesheet') {
    return `${person.person}: ${hours(person.worklogHours)} ore sul tracker, nessun timesheet`
  }
  return `${person.person}: ${hours(person.timesheetHours)} ore di timesheet, ${hours(person.worklogHours)} sul tracker`
}

function gapLine(gap: ForecastGap): string {
  if (gap.kind === 'no_cost') return `manca il costo di ${gap.person} su ${gap.code}`
  if (gap.kind === 'no_rate') return `manca la tariffa di ${gap.person} su ${gap.code}`
  if (gap.kind === 'no_external_rate') {
    return `mancano costo e tariffa dell’esterno ${gap.person} su ${gap.code}`
  }
  if (gap.kind === 'no_total_costs') return `mancano i costi totali previsti di ${gap.code}`
  return `manca l’ordinato di ${gap.code}`
}

function sourceText(facts: Extract<TodayFacts, { kind: 'source' }>): SignalText {
  const { source, days } = facts
  if (facts.reason === 'no_secret') {
    return {
      title: `${source}: su questo computer manca la credenziale`,
      detail: 'Finché non la inserisci non leggo nulla da questa fonte.',
    }
  }
  if (facts.reason === 'never') {
    return {
      title: `${source}: collegata ma mai letta`,
      detail: 'Ciò che segue non contiene ancora nulla di questa fonte.',
    }
  }
  if (facts.reason === 'error') {
    return {
      title: `${source}: l’ultima lettura non è riuscita`,
      detail: facts.error ? errorText(facts.error) : '',
    }
  }
  return {
    title: `${source}: non si legge ${since(days ?? 0)}`,
    detail: `Ciò che segue su ${source} è fermo all’ultima lettura.`,
  }
}

function alignmentDetail(facts: Extract<TodayFacts, { kind: 'alignment' }>): string {
  return [
    facts.missing > 0 ? count(facts.missing, 'voce senza ticket', 'voci senza ticket') : '',
    facts.needsUpdate > 0
      ? count(facts.needsUpdate, 'voce con il ticket altrove', 'voci con il ticket altrove')
      : '',
    facts.duplicates > 0
      ? count(facts.duplicates, 'voce con più ticket', 'voci con più ticket')
      : '',
    facts.orphans > 0 ? count(facts.orphans, 'ticket orfano', 'ticket orfani') : '',
  ]
    .filter((part) => part !== '')
    .join(' · ')
}

/** A signal in the words a PM reads. Every figure comes from the signal: nothing is worked out here. */
export function signalText(item: TodayItem): SignalText {
  const facts = item.facts
  switch (facts.kind) {
    case 'source':
      return sourceText(facts)
    case 'tracker_old':
      return {
        title: `Il tracker del cliente è di ${count(facts.days, 'giorno', 'giorni')} fa`,
        detail: 'Bug e requisiti qui sotto sono a quella data.',
      }
    case 'mail_reply':
      return {
        title: `Rispondi a ${personOf(facts.from)} · «${facts.subject}»`,
        detail: `Aspetta ${since(facts.days)}.`,
      }
    case 'mail_waiting':
      return {
        title: `Aspetti una risposta da ${personOf(facts.to)} · «${facts.subject}»`,
        detail: `Hai scritto ${facts.days} giorni fa e nessuno ha risposto.`,
      }
    case 'hours': {
      const parts = [
        ...facts.people.map(personLine),
        ...(facts.duplicates > 0
          ? [count(facts.duplicates, 'possibile doppione', 'possibili doppioni')]
          : []),
        ...(facts.tieOutOk ? [] : ['la quadratura delle ore approvate non torna']),
      ]
      return {
        title:
          facts.people.length > 0
            ? `${capital(monthText(facts.month))}: le ore di ${count(facts.people.length, 'persona non tornano', 'persone non tornano')}`
            : `${capital(monthText(facts.month))}: le ore non quadrano`,
        detail: parts.join(' · '),
      }
    }
    case 'forecast':
      return {
        title: `Previsionale di ${monthText(facts.month)}: ${count(facts.gaps.length, 'dato che manca', 'dati che mancano')}`,
        detail: capital(facts.gaps.map(gapLine).join(' · ')),
      }
    case 'month_due':
      return {
        title: `Il previsionale di ${monthText(facts.month)} non è ancora compilato`,
        detail:
          'Il modello dell’amministrazione di quel mese non ha ancora la sua copia compilata.',
      }
    case 'bugs_stuck':
      return {
        title: `${count(facts.count, 'bug fermo', 'bug fermi')} da più di ${facts.stuckDays} giorni`,
        detail: `Il più vecchio è nello stesso stato da ${facts.oldestDays} giorni.`,
      }
    case 'requirements':
      return {
        title: `${count(facts.count, 'storia poco chiara', 'storie poco chiare')} nel periodo`,
        detail: `Voci: ${facts.ids.join(', ')}${facts.count > facts.ids.length ? '…' : ''}`,
      }
    case 'alignment':
      return {
        title: `${facts.sprint}: i due tracker non sono allineati`,
        detail: capital(alignmentDetail(facts)),
      }
    case 'draft':
      return {
        title:
          facts.status === 'failed'
            ? `«${facts.title}»: la scrittura non è riuscita`
            : `«${facts.title}» è in bozza ${since(facts.days)}`,
        detail:
          facts.status === 'failed'
            ? 'Va fatta ripartire.'
            : facts.fixFirst
              ? 'Aspetta la tua approvazione. La rilettura critica dice «da correggere prima».'
              : 'Aspetta la tua approvazione.',
      }
    case 'calendar':
      return facts.what === 'period_ends'
        ? {
            title: `${facts.name} finisce ${within(facts.inDays)}`,
            detail: capital(dayText(facts.day)),
          }
        : {
            title: `${facts.name} lascia il progetto ${within(facts.inDays)}`,
            detail: capital(dayText(facts.day)),
          }
    case 'meeting':
      return {
        title: `Alle ${HOUR.format(new Date(facts.start))}: ${facts.subject}`,
        detail: facts.location === '' ? 'Dall’invito nella posta.' : `Dove: ${facts.location}`,
      }
    case 'risk':
      return {
        title: facts.title,
        detail: `Rischio aperto, nel registro dal ${facts.since.split('-').reverse().join('/')}.`,
      }
    case 'risk_candidates':
      return {
        title: count(facts.count, 'rischio proposto da Claude', 'rischi proposti da Claude'),
        detail:
          facts.count === 1
            ? 'Aspetta che tu lo accetti o lo scarti.'
            : 'Aspettano che tu li accetti o li scarti.',
      }
  }
}

/** When the data a signal stands on was read, in words; empty when the source does not say. */
export const asOfText = (item: TodayItem): string =>
  item.asOf === null || item.facts.kind === 'risk' ? '' : `Dati del ${dateTimeText(item.asOf)}`

/** How long a signal has been waiting or how far it is, in a few characters for a row of a list. */
export function ageText(item: TodayItem): string {
  const facts = item.facts
  switch (facts.kind) {
    case 'mail_reply':
    case 'mail_waiting':
    case 'draft':
      return since(facts.days)
    case 'tracker_old':
      return `${count(facts.days, 'giorno', 'giorni')} fa`
    case 'bugs_stuck':
      return since(facts.oldestDays)
    case 'calendar':
      return within(facts.inDays)
    case 'meeting':
      return `alle ${HOUR.format(new Date(facts.start))}`
    case 'source':
      return facts.days === null ? '' : since(facts.days)
    default:
      return ''
  }
}
