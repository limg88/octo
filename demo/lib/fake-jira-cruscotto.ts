// A fake Jira for the dashboard of a project that has no Azure DevOps: the project «Aurora» with
// bugs and stories in Italian states, their changes of state and a comment that waits for an
// answer.
// Usage: node demo/lib/fake-jira-cruscotto.ts   (prints its address and keeps running)
// The account it accepts is `pm@example.test` with the token `demo-token`.
import {
  jiraChange,
  jiraComment,
  jiraIssue,
  startFakeJira,
} from '../../packages/connectors/test/support/fake-jira.ts'

const JIRA = { email: 'pm@example.test', token: 'demo-token' }
const AURORA = { id: '10000', key: 'AUR', name: 'Aurora' }
const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (days: number): string => new Date(now - days * DAY_MS).toISOString()

type Step = [daysAgo: number, state: string]
type Spec = {
  type: 'Bug' | 'Story'
  summary: string
  created: number
  /** The states it went through after the first, each with the day it entered it. */
  steps: Step[]
  first: string
  priority?: string
  comment?: [daysAgo: number, by: string, text: string]
}

const SPECS: Spec[] = [
  {
    type: 'Bug',
    summary: 'Il flusso ordini si ferma senza avviso',
    created: 40,
    first: 'Da completare',
    steps: [[35, 'In corso']],
    priority: 'High',
    comment: [3, 'Carla Bianchi', 'Avete una data per la correzione?'],
  },
  {
    type: 'Bug',
    summary: 'File CSV con separatore sbagliato',
    created: 30,
    first: 'Da completare',
    steps: [
      [25, 'In corso'],
      [10, 'In test'],
    ],
  },
  {
    type: 'Bug',
    summary: 'Certificato scaduto sul gateway',
    created: 28,
    first: 'Da completare',
    steps: [
      [27, 'In corso'],
      [20, 'Completata'],
    ],
    priority: 'Highest',
  },
  {
    type: 'Story',
    summary: 'Catalogo dei flussi di integrazione',
    created: 45,
    first: 'Da completare',
    steps: [
      [40, 'In corso'],
      [12, 'Completata'],
    ],
  },
  {
    type: 'Story',
    summary: 'Stima della migrazione',
    created: 20,
    first: 'Da completare',
    steps: [],
  },
]

const issues = SPECS.map((spec, index) => {
  const states = [spec.first, ...spec.steps.map(([, state]) => state)]
  const changed = spec.steps.at(-1)?.[0] ?? spec.created
  return jiraIssue(index + 1, `${AURORA.key}-${index + 1}`, AURORA, {
    type: spec.type,
    summary: spec.summary,
    status: states.at(-1) ?? spec.first,
    priority: spec.priority ?? 'Medium',
    created: daysAgo(spec.created),
    updated: daysAgo(changed),
    stateChanged: daysAgo(changed),
    comments: spec.comment
      ? [jiraComment(1, daysAgo(spec.comment[0]), spec.comment[2], spec.comment[1])]
      : [],
    changelog: spec.steps.map(([at, state], step) =>
      jiraChange(daysAgo(at), { field: 'status', from: states[step] ?? null, to: state }),
    ),
  })
})

const fake = await startFakeJira({ ...JIRA, projects: [AURORA], issues })
console.log(fake.server.origin)
process.on('SIGTERM', () => {
  fake.server.close()
  process.exit(0)
})
