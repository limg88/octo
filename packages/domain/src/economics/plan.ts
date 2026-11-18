import type { ForecastSettings } from '../forecast/model.ts'
import { personKey } from '../hours/model.ts'

/**
 * The plan the sheet of a project code kept until the plans left Octo (18/11/2026): the budget
 * and the months stay in the sheets of the administration. Octo only reads what it had kept, to
 * hand it back to the PM as a text and to keep the rates the monthly forecast was using.
 */
export const PLAN_GROUPS = [
  'internal',
  'external',
  'product',
  'other_internal',
  'other_external',
] as const
export type PlanGroup = (typeof PLAN_GROUPS)[number]

/** A quantity for each month, `YYYY-MM`: hours for people, units for the rest. */
export type MonthQuantities = Record<string, number>

export type PlanLine = {
  group: PlanGroup
  name: string
  unitCost: number | null
  unitPrice: number | null
  budget: MonthQuantities
  forecast: MonthQuantities
  declared: MonthQuantities
}

export type SheetPlan = {
  lines: PlanLine[]
  confirmedOn: string | null
  milestones: Array<{ salesOrder: string; month: string; amount: number }>
  declaredProgress: Record<string, number>
  registry: Record<string, string>
}

/** The plans of the project codes of a project, by code. */
export type SheetPlans = Record<string, SheetPlan>

/** Where the plans are written for the PM to read: with the costs, out of what Claude reads. */
export const RETIRED_PLANS_FILE = 'commessa/piano-esportato.md'

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The settings of the monthly forecast with what the plans said an hour is sold for, or costs:
 * taken over once, when the plans leave Octo, so the forecast of each code gives the figures it
 * gave. What no plan says stays as it was; taking over twice changes nothing.
 */
export function settingsWithPlans(settings: ForecastSettings, plans: SheetPlans): ForecastSettings {
  let { rates, externals, hourlyCosts } = settings
  const perDay = (perHour: number): number => perHour * settings.hoursPerDay
  for (const [code, plan] of Object.entries(plans)) {
    for (const line of plan.lines) {
      if (line.group === 'internal' && line.unitPrice !== null) {
        const key = personKey(line.name)
        rates = [
          ...rates.filter((rate) => rate.code !== code || personKey(rate.person) !== key),
          { person: line.name, code, ratePerDay: perDay(line.unitPrice) },
        ]
      }
      if (line.group !== 'external' || (line.unitCost === null && line.unitPrice === null)) continue
      const known = externals.find(
        (external) => external.code === code && sameName(external.name, line.name),
      )
      externals = [
        ...externals.filter((external) => external !== known),
        {
          name: line.name,
          code,
          costPerDay: line.unitCost === null ? (known?.costPerDay ?? 0) : perDay(line.unitCost),
          ratePerDay: line.unitPrice === null ? (known?.ratePerDay ?? 0) : perDay(line.unitPrice),
        },
      ]
      if (line.unitCost !== null) {
        const key = personKey(line.name)
        hourlyCosts = [
          ...hourlyCosts.filter((cost) => personKey(cost.person) !== key),
          { person: line.name, costPerHour: line.unitCost },
        ]
      }
    }
  }
  return { ...settings, rates, externals, hourlyCosts }
}

const GROUP_WORDS: Readonly<Record<PlanGroup, string>> = {
  internal: 'Risorse interne',
  external: 'Risorse esterne',
  product: 'Prodotti',
  other_internal: 'Altri costi interni',
  other_external: 'Altri costi esterni',
}
const NOTHING = '—'
const cell = (value: string): string => value.replaceAll('|', '/').replaceAll('\n', ' ')
const numberText = (value: number | null): string => (value === null ? NOTHING : String(value))
const monthsText = (quantities: MonthQuantities): string => {
  const months = Object.keys(quantities).sort()
  return months.length === 0
    ? NOTHING
    : months.map((month) => `${month}: ${quantities[month]}`).join('; ')
}
const table = (headings: readonly string[], rows: readonly string[][]): string[] => [
  `| ${headings.join(' | ')} |`,
  `|${headings.map(() => '---').join('|')}|`,
  ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
]

function planText(code: string, plan: SheetPlan): string[] {
  const lines = [`## ${code}`, '']
  if (plan.confirmedOn !== null) lines.push(`Budget confermato il ${plan.confirmedOn}.`, '')
  if (plan.lines.length > 0) {
    lines.push(
      ...table(
        ['Gruppo', 'Voce', 'Costo unitario', 'Prezzo unitario', 'Budget', 'Forecast', 'Dichiarato'],
        plan.lines.map((line) => [
          GROUP_WORDS[line.group],
          line.name,
          numberText(line.unitCost),
          numberText(line.unitPrice),
          monthsText(line.budget),
          monthsText(line.forecast),
          monthsText(line.declared),
        ]),
      ),
      '',
    )
  }
  if (plan.milestones.length > 0) {
    lines.push(
      '### Piano di fatturazione',
      '',
      ...table(
        ['Ordine di vendita', 'Mese', 'Importo'],
        plan.milestones.map((milestone) => [
          milestone.salesOrder === '' ? NOTHING : milestone.salesOrder,
          milestone.month,
          String(milestone.amount),
        ]),
      ),
      '',
    )
  }
  if (Object.keys(plan.declaredProgress).length > 0) {
    lines.push(`Avanzamento dichiarato (quota fra 0 e 1): ${monthsText(plan.declaredProgress)}`, '')
  }
  const registry = Object.entries(plan.registry).filter(([, value]) => value.trim() !== '')
  if (registry.length > 0) {
    lines.push(
      '### Anagrafica',
      '',
      ...registry.map(([field, value]) => `- ${field}: ${value}`),
      '',
    )
  }
  return lines
}

/**
 * The plans as a text the PM reads: every line with its months, the invoices planned, the
 * progress declared, the registry. Written once, when the plans leave Octo.
 */
export function sheetPlansText(plans: SheetPlans, day: string): string {
  const codes = Object.keys(plans).sort()
  return [
    '# Piano delle commesse, esportato da Octo',
    '',
    `Scritto il ${day}. Budget, mesi, piano di fatturazione, avanzamento dichiarato e anagrafica non si tengono più in Octo: restano nelle schede progetto. Qui c'è ciò che Octo aveva. Quantità in ore per le persone, in unità per il resto; importi in euro.`,
    '',
    ...codes.flatMap((code) => planText(code, plans[code] as SheetPlan)),
  ].join('\n')
}
