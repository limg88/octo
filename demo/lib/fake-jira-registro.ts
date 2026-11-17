// A fake Jira kept as a register of activities, for a project sold at a fixed price: five issues
// (tasks and stories), no bug and no sprint, the comments of a task as the diary of the work.
// It also writes what a PM sets once: Jira linked with its token, and the hours logged on the
// issues as Octo keeps them after reading them in «Ore».
// Usage: node demo/lib/fake-jira-registro.ts <project folder> <app data folder>
//        (prints its address and keeps running)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  jiraChange,
  jiraComment,
  jiraIssue,
  startFakeJira,
} from '../../packages/connectors/test/support/fake-jira.ts'
import { worklogCsv } from '../../packages/domain/src/index.ts'

const [project, dataFolder] = process.argv.slice(2)
if (!project || !dataFolder) {
  throw new Error('usage: fake-jira-registro.ts <project folder> <app data folder>')
}

const PROJECT_ID = 'demo-aurora'
const JIRA = { email: 'pm@example.test', token: 'demo-token' }
const AURORA = { id: '10000', key: 'AUR', name: 'Aurora' }
const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (days: number): string => new Date(now - days * DAY_MS).toISOString()
const dayOf = (days: number): string => daysAgo(days).slice(0, 10)

type Spec = {
  type: 'Task' | 'Story'
  summary: string
  created: number
  first: string
  /** The states it went through after the first, each with the day it entered it. */
  steps: Array<[daysAgo: number, state: string]>
  assignee?: string
  /** The diary of the activity: what was written on it, day by day. */
  comments?: Array<[daysAgo: number, text: string]>
  /** The hours logged on it: who, how many days ago, how many hours. */
  hours?: Array<[person: string, daysAgo: number, hours: number]>
}

const SPECS: Spec[] = [
  {
    type: 'Story',
    summary: 'Gestione progetto',
    created: 60,
    first: 'Da completare',
    steps: [[58, 'In corso']],
    assignee: 'Anna Rossi',
    hours: [
      ['Anna Rossi', 50, 4],
      ['Anna Rossi', 20, 4],
    ],
  },
  {
    type: 'Story',
    summary: 'Kick-off con il cliente',
    created: 60,
    first: 'Da completare',
    steps: [
      [57, 'In corso'],
      [55, 'Completata'],
    ],
    assignee: 'Anna Rossi',
    comments: [[55, 'Verbale del kick-off inviato.']],
    hours: [['Anna Rossi', 56, 2]],
  },
  {
    type: 'Task',
    summary: 'Analisi dei processi di integrazione',
    created: 54,
    first: 'Da completare',
    steps: [[50, 'In corso']],
    assignee: 'Luca Bianchi',
    comments: [
      [48, 'Raccolti i flussi esistenti: 14 integrazioni.'],
      [30, 'Prima bozza del documento di analisi.'],
      [6, 'Inviata la bozza al cliente, aspettiamo i commenti.'],
    ],
    hours: [
      ['Luca Bianchi', 48, 8],
      ['Luca Bianchi', 30, 9.5],
      ['Luca Bianchi', 6, 8],
    ],
  },
  {
    type: 'Task',
    summary: 'Stima della migrazione',
    created: 40,
    first: 'Da completare',
    steps: [],
    assignee: 'Luca Bianchi',
  },
  {
    type: 'Task',
    summary: 'Presentazione finale',
    created: 40,
    first: 'Da completare',
    steps: [],
  },
]

const keyOf = (index: number): string => `${AURORA.key}-${index + 1}`
const issues = SPECS.map((spec, index) => {
  const states = [spec.first, ...spec.steps.map(([, state]) => state)]
  const changed = spec.steps.at(-1)?.[0] ?? spec.created
  return jiraIssue(index + 1, keyOf(index), AURORA, {
    type: spec.type,
    summary: spec.summary,
    status: states.at(-1) ?? spec.first,
    priority: 'Medium',
    assignee: spec.assignee ? { displayName: spec.assignee } : null,
    created: daysAgo(spec.created),
    updated: daysAgo(changed),
    stateChanged: daysAgo(changed),
    comments: (spec.comments ?? []).map(([at, text], n) =>
      jiraComment(n + 1, daysAgo(at), text, spec.assignee ?? 'Anna Rossi'),
    ),
    changelog: spec.steps.map(([at, state], step) =>
      jiraChange(daysAgo(at), { field: 'status', from: states[step] ?? null, to: state }),
    ),
  })
})

const write = (file: string, content: string) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
const json = (file: string, value: unknown) => write(file, JSON.stringify(value, null, 1))
const settings = join(project, '_octo', '.impostazioni')

json(join(settings, 'sources.json'), {
  mail: null,
  ado: null,
  jira: {
    since: dayOf(90),
    targetFolder: '_octo/fonti/Jira',
    site: 'demo',
    email: JIRA.email,
    projects: [AURORA.key],
  },
  confluence: null,
  dwsi: null,
})
// Demo only: the token is kept in clear, as `OCTO_DEMO_PLAIN_SECRETS=1` reads it back.
json(join(dataFolder, 'secrets.json'), {
  [`${PROJECT_ID}/jira`]: Buffer.from(JIRA.token).toString('base64'),
})
// The hours logged on the issues, one file per month as «Ore» writes them.
const logged = SPECS.flatMap((spec, index) =>
  (spec.hours ?? []).map(([person, at, hours]) => ({
    issue: keyOf(index),
    person,
    day: dayOf(at),
    hours,
  })),
)
for (const month of new Set(logged.map((entry) => entry.day.slice(0, 7)))) {
  write(
    join(project, '_octo', 'ore', 'jira', `worklog_${month}.csv`),
    worklogCsv(logged.filter((entry) => entry.day.startsWith(month))),
  )
}
json(join(settings, 'hours.json'), { timesheetPath: '', worklogPath: '_octo/ore/jira' })

const fake = await startFakeJira({ ...JIRA, projects: [AURORA], issues })
console.log(fake.server.origin)
process.on('SIGTERM', () => {
  fake.server.close()
  process.exit(0)
})
