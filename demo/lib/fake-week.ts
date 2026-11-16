// Adds to the demo project what makes a week critical: two risks in the register (one with how
// much it matters, one with the day it is due by) and an open point due in two days.
// Usage: node demo/lib/fake-week.ts <project folder>   (after fake-points.ts)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addOpenPoint,
  addRisk,
  NO_RISKS,
  type OpenPointRegister,
  romeDateString,
  updateRisk,
} from '../../packages/domain/src/index.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-week.ts <project folder>')

const DAY_MS = 24 * 60 * 60 * 1000
const IN_DAYS = 2
const today = romeDateString(new Date())
const soon = romeDateString(new Date(Date.now() + IN_DAYS * DAY_MS))
const settings = join(project, '_octo', '.impostazioni')

let risks = addRisk(NO_RISKS, 'Il cliente non ha ancora nominato chi firma il collaudo', today)
risks = addRisk(risks, 'Licenze dell’ambiente di prova in scadenza', today)
const [first, second] = risks.risks.map((risk) => risk.id) as [string, string]
risks = updateRisk(risks, first, { severity: 'alta', note: 'Ne parlo con Carla al SAL' })
risks = updateRisk(risks, second, { due: soon })
writeFileSync(join(settings, 'rischi.json'), JSON.stringify(risks, null, 1))

const pointsFile = join(settings, 'open-point.json')
const points = JSON.parse(readFileSync(pointsFile, 'utf8')) as OpenPointRegister
writeFileSync(
  pointsFile,
  JSON.stringify(
    addOpenPoint(
      points,
      { title: 'Piano di rilascio da mandare al cliente', due: soon, origin: 'pm' },
      today,
    ),
    null,
    1,
  ),
)
