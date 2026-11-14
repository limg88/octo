/** How much is known about a line of an estimate: the width of its range must match it. */
export const WBS_STATES = ['completo', 'parziale', 'mancante'] as const
export type WbsState = (typeof WBS_STATES)[number]

/** One line of the work breakdown of an estimate, as the writer proposes it. */
export type WbsRow = {
  id: string
  fase: string
  attivita: string
  /** What the effort depends on, with the marker of its source. */
  driver: string
  ruolo: string
  /** Optimistic, most likely and pessimistic effort, in days. */
  ott: number
  prob: number
  pess: number
  stato: WbsState
}

export type EstimatedRow = WbsRow & { media: number; sd: number }

export type Estimate = {
  rows: EstimatedRow[]
  total: number
  sd: number
  min: number
  max: number
  byPhase: Array<[string, number]>
  byRole: Array<[string, number]>
  /** Lines left out of the totals, each with why, and ranges that do not match what is known. */
  warnings: string[]
}

/** The interval the range is given at, and the z of the normal distribution for it. */
export const ESTIMATE_INTERVAL = 0.8
const Z_FOR_INTERVAL = 1.2816
/** How many times the optimistic value the pessimistic one may be, by what is known. */
const MAX_WIDTH: Readonly<Record<Exclude<WbsState, 'mancante'>, number>> = {
  completo: 2,
  parziale: 3,
}
/** With information missing, a range narrower than this is false precision. */
const MIN_WIDTH_WHEN_MISSING = 3
const PERT_WEIGHT_OF_LIKELY = 4
const PERT_DIVISOR = 6
const UNIT = 'gg'

/** Why a line cannot enter the totals, or null when it can. */
function refusal(row: WbsRow, seen: ReadonlySet<string>): string | null {
  if (row.id.trim() === '') return 'riga senza id'
  if (seen.has(row.id)) return `${row.id}: id duplicato`
  if (row.driver.trim() === '') {
    return `${row.id}: manca il driver — ogni riga dice da che cosa dipende lo sforzo`
  }
  const values = [row.ott, row.prob, row.pess]
  if (
    !values.every(Number.isFinite) ||
    !(0 <= row.ott && row.ott <= row.prob && row.prob <= row.pess)
  ) {
    return `${row.id}: serve 0 ≤ ottimistico ≤ probabile ≤ pessimistico`
  }
  if (row.pess === row.ott) {
    return `${row.id}: ottimistico uguale a pessimistico — una stima a tre punti ha sempre incertezza`
  }
  return null
}

function widthWarning(row: WbsRow): string | null {
  if (row.stato === 'mancante') {
    return row.pess < MIN_WIDTH_WHEN_MISSING * row.ott
      ? `${row.id}: informazione mancante ma intervallo stretto (pessimistico sotto ${MIN_WIDTH_WHEN_MISSING} volte l'ottimistico)`
      : null
  }
  const limit = MAX_WIDTH[row.stato]
  return row.pess > limit * row.ott
    ? `${row.id}: informazione ${row.stato === 'completo' ? 'completa' : 'parziale'} ma intervallo largo (pessimistico oltre ${limit} volte l'ottimistico)`
    : null
}

function grouped(rows: readonly EstimatedRow[], key: 'fase' | 'ruolo'): Array<[string, number]> {
  const sums = new Map<string, number>()
  for (const row of rows) sums.set(row[key], (sums.get(row[key]) ?? 0) + row.media)
  return [...sums.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * The totals of an estimate, by the code and never by the model: three-point PERT on independent
 * activities. A line that cannot be computed is left out and said, never corrected.
 */
export function estimate(rows: readonly WbsRow[]): Estimate {
  const warnings: string[] = []
  const kept: EstimatedRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const refused = refusal(row, seen)
    if (refused) {
      warnings.push(`Esclusa dai totali — ${refused}`)
      continue
    }
    seen.add(row.id)
    const media = (row.ott + PERT_WEIGHT_OF_LIKELY * row.prob + row.pess) / PERT_DIVISOR
    kept.push({ ...row, media, sd: (row.pess - row.ott) / PERT_DIVISOR })
    const width = widthWarning(row)
    if (width) warnings.push(width)
  }
  const total = kept.reduce((sum, row) => sum + row.media, 0)
  const sd = Math.sqrt(kept.reduce((sum, row) => sum + row.sd ** 2, 0))
  return {
    rows: kept,
    total,
    sd,
    min: Math.max(0, total - Z_FOR_INTERVAL * sd),
    max: total + Z_FOR_INTERVAL * sd,
    byPhase: grouped(kept, 'fase'),
    byRole: grouped(kept, 'ruolo'),
    warnings,
  }
}

const days = (value: number): string => value.toFixed(1).replace('.', ',')
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

function table(header: string[], lines: string[][]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...lines.map((line) => `| ${line.map(cell).join(' | ')} |`),
  ]
}

/** The numbers of an estimate as the Markdown that goes in its document. */
export function estimateMarkdown(result: Estimate): string {
  const interval = `${Math.round(ESTIMATE_INTERVAL * 100)}%`
  const lines = [
    `Totale **${days(result.total)} ${UNIT}** · intervallo all'${interval}: **${days(result.min)} – ${days(result.max)} ${UNIT}** · deviazione standard ${days(result.sd)} ${UNIT}.`,
    '',
  ]
  if (result.warnings.length > 0) {
    lines.push('### Avvisi', '', ...result.warnings.map((warning) => `- ${warning}`), '')
  }
  lines.push(
    '### Per fase',
    '',
    ...table(
      ['Fase', UNIT],
      result.byPhase.map(([name, value]) => [name, days(value)]),
    ),
    '',
    '### Per ruolo',
    '',
    ...table(
      ['Ruolo', UNIT],
      result.byRole.map(([name, value]) => [name, days(value)]),
    ),
    '',
    '### Dettaglio',
    '',
    ...table(
      [
        'Id',
        'Fase',
        'Attività',
        'Da che cosa dipende',
        'Ruolo',
        'Ott',
        'Prob',
        'Pess',
        'Stato',
        'PERT',
      ],
      result.rows.map((row) => [
        row.id,
        row.fase,
        row.attivita,
        row.driver,
        row.ruolo,
        days(row.ott),
        days(row.prob),
        days(row.pess),
        row.stato,
        days(row.media),
      ]),
    ),
    '',
    '_Metodo: PERT a tre punti su attività indipendenti. Totali e intervallo sono calcolati da Octo._',
  )
  return lines.join('\n')
}

/** Where the writer says the computed numbers go in its text. */
export const ESTIMATE_PLACEHOLDER = '{{STIMA}}'

/** The text of an estimate with its numbers in place: where the writer said, or at the end. */
export function withEstimate(text: string, rows: readonly WbsRow[]): string {
  const numbers = estimateMarkdown(estimate(rows))
  return text.includes(ESTIMATE_PLACEHOLDER)
    ? text.replace(ESTIMATE_PLACEHOLDER, numbers)
    : `${text.trimEnd()}\n\n${numbers}\n`
}
