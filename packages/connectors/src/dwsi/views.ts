import type { DocumentKind } from '@octo/domain'

/** The schema of the data warehouse the views live in: written in every query, never a value. */
export const DWSI_SCHEMA = 'dwsi'

/**
 * The type of a column as `information_schema.columns.data_type` writes it. The signature
 * compares it exactly: a column that changes type is a changed definition.
 */
export type ColumnType =
  | 'character varying'
  | 'numeric'
  | 'integer'
  | 'bigint'
  | 'double precision'
  | 'boolean'
  | 'date'
  | 'timestamp without time zone'

/**
 * How a value is read when the warehouse's type says less than the column means: a yes/no
 * written as text (`flag`), a year or a month written as floating point. What cannot be read
 * that way is not deduced, never guessed or rounded.
 */
export type ColumnReading = 'flag' | 'year' | 'month'

export interface DwsiColumn {
  name: string
  type: ColumnType
  reads?: ColumnReading
}

/** What an extraction is, for the evidence that lists it: hours or economics. */
export type DwsiCategory = 'timesheet' | 'economics'

export interface DwsiView {
  /** The relation in `dwsi`: a view, or a table the warehouse exposes as one. */
  name: string
  category: DwsiCategory
  /** The heading of the view's section in the evidence. */
  label: string
  /** The columns read, in order: nothing else of the view is ever read. */
  columns: readonly DwsiColumn[]
  /** The columns that identify a row of the view for one project. */
  key: readonly string[]
  /** The entity of `dw_prod_syncdata` whose `datelastsync` dates the view; null when none. */
  syncEntity: string | null
  /** Columns that name a person: carried as people of the evidence. */
  people: readonly string[]
}

const t = (name: string): DwsiColumn => ({ name, type: 'character varying' })
const n = (name: string): DwsiColumn => ({ name, type: 'numeric' })
const i = (name: string): DwsiColumn => ({ name, type: 'integer' })
const d = (name: string): DwsiColumn => ({ name, type: 'date' })
const f = (name: string): DwsiColumn => ({ name, type: 'double precision' })

/**
 * The closed list of what the extractor reads, per project (`projectid`). Personal columns
 * beyond the name (notes, smart working, on-call), sales representatives and comments are never
 * read; of the HR views only what `STANDARD_COST_VIEW` and `EMPLOYEE_VIEW` declare.
 */
export const DWSI_VIEWS: readonly DwsiView[] = [
  {
    name: 'v_timesheet_all',
    category: 'timesheet',
    label: 'Ore (timesheet)',
    columns: [
      { name: 'internalid', type: 'bigint' },
      t('projectid'),
      t('employee'),
      d('timesheetdate'),
      t('casetaskevent'),
      t('tipoore'),
      n('duration'),
      t('approvalstatus'),
      n('laborcosthh_new'),
      n('laborcost_new'),
    ],
    key: ['internalid'],
    syncEntity: 'TIMESHEET',
    people: ['employee'],
  },
  {
    name: 'v_project',
    category: 'economics',
    label: 'Progetto',
    columns: [
      t('projectid'),
      t('name'),
      t('projectmanager'),
      t('customername'),
      t('status'),
      d('startdate'),
      d('calculatedenddate'),
      d('enddate'),
      f('plannedwork'),
      f('actualwork'),
      f('remainingwork'),
      f('percentcomplete'),
    ],
    key: ['projectid'],
    syncEntity: 'PROJECT',
    people: ['projectmanager'],
  },
  {
    name: 'v_sales_order_all',
    category: 'economics',
    label: 'Ordini',
    columns: [
      t('projectid'),
      t('salesorderid'),
      i('lineid'),
      d('salesorderdate'),
      t('status'),
      t('item'),
      f('quantity'),
      f('amount'),
      f('invoiced'),
      { name: 'closed', type: 'character varying', reads: 'flag' },
    ],
    key: ['salesorderid', 'lineid'],
    syncEntity: 'SALESORDER',
    people: [],
  },
  {
    name: 'v_invoice_all',
    category: 'economics',
    label: 'Fatture',
    columns: [
      t('projectid'),
      t('invoiceid'),
      i('lineid'),
      t('status'),
      d('invoicedate'),
      t('item'),
      n('amount'),
      i('annocompetenza'),
      t('salesorder'),
      t('type'),
    ],
    key: ['invoiceid', 'lineid'],
    syncEntity: 'INVOICE',
    people: [],
  },
  {
    name: 'v_purchase_order_all',
    category: 'economics',
    label: 'Ordini a fornitore',
    columns: [
      t('projectid'),
      t('purchaseorderid'),
      i('lineid'),
      d('purchaseorderdate'),
      t('status'),
      t('vendorname'),
      t('item'),
      f('quantity'),
      f('amount'),
      f('invoiced'),
      { name: 'closed', type: 'character varying', reads: 'flag' },
    ],
    key: ['purchaseorderid', 'lineid'],
    syncEntity: 'PURCHASEORDER',
    people: [],
  },
  {
    name: 'v_itemreceiptpo_all',
    category: 'economics',
    label: 'Ricevimenti da fornitore',
    columns: [
      t('projectid'),
      { name: 'internalid', type: 'bigint' },
      i('lineid'),
      t('purchaseorderid'),
      d('receiptdate'),
      t('vendorname'),
      t('item'),
      f('quantity'),
      f('amount'),
    ],
    key: ['internalid', 'lineid'],
    syncEntity: 'ITEMRECEIPTPO',
    people: [],
  },
  {
    name: 'v_invoice_po_all',
    category: 'economics',
    label: 'Fatture dei fornitori',
    columns: [
      t('projectid'),
      t('invoiceid'),
      i('lineid'),
      t('status'),
      d('invoicedate'),
      t('vendorname'),
      t('item'),
      n('amount'),
      t('purchaseorder'),
      t('type'),
    ],
    key: ['invoiceid', 'lineid'],
    syncEntity: 'INVOICEPO',
    people: [],
  },
  {
    name: 'v_project_revenue_all',
    category: 'economics',
    label: 'Ricavi e costi mensili',
    columns: [
      t('projectid'),
      { name: 'anno', type: 'double precision', reads: 'year' },
      { name: 'mese', type: 'double precision', reads: 'month' },
      t('itemgroup'),
      n('cost'),
      n('actualcost'),
      n('revenue'),
      n('actualrevenue'),
    ],
    key: ['anno', 'mese', 'itemgroup'],
    syncEntity: 'PROJECTREVENUE',
    people: [],
  },
  {
    name: 'v_database_pl_all',
    category: 'economics',
    label: 'Conto economico mensile',
    columns: [
      t('projectid'),
      i('anno'),
      i('mese'),
      n('revenue'),
      n('cost_labor_ts'),
      n('cost_total'),
    ],
    key: ['anno', 'mese'],
    syncEntity: null,
    people: [],
  },
  {
    name: 'v_backlog_all',
    category: 'economics',
    label: 'Backlog',
    columns: [
      t('projectid'),
      d('backlogrefperiod'),
      n('amount'),
      n('amountbilled'),
      n('amountrecognized'),
    ],
    key: ['backlogrefperiod'],
    syncEntity: 'BACKLOG',
    people: [],
  },
  {
    name: 'dw_prod_projectpercentcomplete',
    category: 'economics',
    label: 'Avanzamento',
    columns: [
      t('projectid'),
      t('period'),
      d('perioddate'),
      { name: 'percentcomplete', type: 'double precision' },
      t('periodstatus'),
    ],
    key: ['period'],
    syncEntity: 'PROJECTPERCENTCOMPLETE',
    people: [],
  },
]

/** The table of the warehouse that says when each entity was last synchronized. */
export const SYNC_TABLE: { name: string; columns: readonly DwsiColumn[] } = {
  name: 'dw_prod_syncdata',
  columns: [t('entity'), { name: 'datelastsync', type: 'timestamp without time zone' }],
}

/**
 * The employees of the warehouse, of which only the name and the email are ever read, and only
 * inside the query that binds the project codes to the PM who owns the source: never returned,
 * never stored (the other columns of the view, personal or HR, are never named).
 */
export const EMPLOYEE_VIEW: { name: string; columns: readonly DwsiColumn[] } = {
  name: 'v_dw_employee',
  columns: [t('name'), t('email')],
}

/**
 * What an hour of a person costs today, as the sheets of the administration price every hour:
 * only the name and the cost of an hour are read, and only of who wrote hours on a project code
 * bound to the PM who owns the source (the other columns of the view are never named).
 */
export const STANDARD_COST_VIEW: { name: string; columns: readonly DwsiColumn[] } = {
  name: 'v_employee_cost_production_digital',
  columns: [t('name'), n('laborcosthh')],
}

/** Every relation of the list: the signature and the privilege check cover them all. */
export const DWSI_RELATIONS: readonly string[] = [
  ...DWSI_VIEWS.map((v) => v.name),
  SYNC_TABLE.name,
  EMPLOYEE_VIEW.name,
  STANDARD_COST_VIEW.name,
]

/**
 * The cost of an hour of who wrote hours on a project code (`$1`), by name. Nobody else's cost
 * is ever asked.
 */
export const STANDARD_COSTS_QUERY =
  `SELECT c."name", c."laborcosthh" FROM ${DWSI_SCHEMA}."${STANDARD_COST_VIEW.name}" AS c ` +
  `WHERE c."name" IN (SELECT t."employee" FROM ${DWSI_SCHEMA}."v_timesheet_all" AS t ` +
  `WHERE t."projectid" = $1) ORDER BY 1, 2`

/**
 * The project codes, among `$2`, bound to the person whose addresses (UPN and email, in lower
 * case) are `$1`: those whose project manager (`v_project.projectmanager`) bears a name of that
 * person in `v_dw_employee`. Having written hours on a project binds nothing: a project is of
 * its project manager. A name is the person's only when every employee of that name has one of
 * those addresses: a namesake with another address (or none) makes it ambiguous, and it binds
 * nothing (the views name people by name, not by id). The names are computed once (`me`) and
 * never come out: only codes do.
 */
export const BOUND_CODES_QUERY =
  `WITH me AS (SELECT e."name" FROM ${DWSI_SCHEMA}."${EMPLOYEE_VIEW.name}" AS e ` +
  `WHERE e."name" IS NOT NULL GROUP BY e."name" ` +
  `HAVING bool_and(coalesce(lower(e."email") = ANY ($1::text[]), false))) ` +
  `SELECT p."projectid" FROM ${DWSI_SCHEMA}."v_project" AS p ` +
  `WHERE p."projectid" = ANY ($2::text[]) AND p."projectmanager" IN (SELECT "name" FROM me) ` +
  `ORDER BY 1`

/**
 * Every project code whose project manager is the person whose addresses are `$1`, with its
 * name: what that person is asked to choose from. The same rule on names as `BOUND_CODES_QUERY`;
 * a project of somebody else never comes out, not even its code.
 */
export const ASSIGNED_CODES_QUERY =
  `WITH me AS (SELECT e."name" FROM ${DWSI_SCHEMA}."${EMPLOYEE_VIEW.name}" AS e ` +
  `WHERE e."name" IS NOT NULL GROUP BY e."name" ` +
  `HAVING bool_and(coalesce(lower(e."email") = ANY ($1::text[]), false))) ` +
  `SELECT p."projectid", p."name" FROM ${DWSI_SCHEMA}."v_project" AS p ` +
  `WHERE p."projectmanager" IN (SELECT "name" FROM me) ORDER BY 1`

/** The kind of the evidence of an extraction: system data, classified so at ingestion. */
export const CATEGORY_KIND: Record<DwsiCategory, DocumentKind> = {
  timesheet: 'timesheet',
  economics: 'economics_export',
}

/** The heading of an extraction's evidence, per category. */
export const CATEGORY_LABEL: Record<DwsiCategory, string> = {
  timesheet: 'Ore',
  economics: 'Dati economici',
}

export const CATEGORIES: readonly DwsiCategory[] = ['timesheet', 'economics']

/** The fixed query of a view for one project: declared columns, total order, one row too many. */
export function viewQuery(view: DwsiView, limit: number): string {
  // Texts are cut by the server too (a courtesy bound: the session bounds what it receives).
  const columns = view.columns.map((c) =>
    c.type === 'character varying'
      ? `left(t."${c.name}", ${MAX_TEXT_CHARACTERS}) AS "${c.name}"`
      : `t."${c.name}"`,
  )
  const others = view.columns.filter((c) => !view.key.includes(c.name)).map((c) => `t."${c.name}"`)
  const order = [...view.key.map((k) => `t."${k}"`), ...others].map((c) => `${c} NULLS LAST`)
  return (
    `SELECT ${columns.join(', ')} FROM ${DWSI_SCHEMA}."${view.name}" AS t ` +
    `WHERE t."projectid" = $1 ORDER BY ${order.join(', ')} LIMIT ${limit + 1}`
  )
}

/** Characters of a text value kept. */
export const MAX_TEXT_CHARACTERS = 1_000
