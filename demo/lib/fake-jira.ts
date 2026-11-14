// A fake Jira on this computer, with the project «Aurora» and the hours of last month logged on
// its issues: the same hours demo/lib/fake-hours.ts writes as a file.
// Usage: node demo/lib/fake-jira.ts            (prints its address and keeps running)
// The account it accepts is `pm@example.test` with the token `demo-token`.
import { jiraIssue, startFakeJira } from '../../packages/connectors/test/support/fake-jira.ts'
import { days, PEOPLE } from './hours-data.ts'

export const DEMO_JIRA = { site: 'demo', email: 'pm@example.test', token: 'demo-token', key: 'AUR' }
const AURORA = { id: '10000', key: DEMO_JIRA.key, name: 'Aurora' }
const SECONDS_PER_HOUR = 3600

export async function startDemoJira() {
  const issues = days.map((day, index) => {
    const issue = jiraIssue(index + 1, `${AURORA.key}-${100 + index}`, AURORA, {
      updated: `${day}T17:00:00.000+0000`,
      summary: `Attività del ${day}`,
    })
    issue.fields.worklog = {
      worklogs: PEOPLE.filter((person) => person.tracker > 0).map((person) => ({
        started: `${day}T09:00:00.000+0000`,
        timeSpentSeconds: person.tracker * SECONDS_PER_HOUR,
        author: { displayName: person.trackerName },
      })),
    }
    return issue
  })
  return startFakeJira({
    email: DEMO_JIRA.email,
    token: DEMO_JIRA.token,
    projects: [AURORA],
    issues,
  })
}

if (import.meta.main) {
  const fake = await startDemoJira()
  console.log(fake.server.origin)
  process.on('SIGTERM', () => {
    fake.server.close()
    process.exit(0)
  })
}
