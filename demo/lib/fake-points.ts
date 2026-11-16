// Writes into the demo project the register of the open points as a PM would find it on a
// morning: points left open on the days before, one past its day, one closed the day before.
// Usage: node demo/lib/fake-points.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addOpenPoint,
  NO_OPEN_POINTS,
  type OpenPointRegister,
  previousWorkday,
  romeDateString,
  updateOpenPoint,
} from '../../packages/domain/src/index.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-points.ts <project folder>')

const today = romeDateString(new Date())
const back = (workdays: number): string => {
  let day = today
  for (let step = 0; step < workdays; step += 1) day = previousWorkday(day)
  return day
}
const yesterday = back(1)

let register: OpenPointRegister = NO_OPEN_POINTS
const open = (title: string, openedOn: string, owner = '', due: string | null = null): string => {
  register = addOpenPoint(register, { title, owner, due, origin: 'pm' }, openedOn)
  return register.points[register.points.length - 1]?.id ?? ''
}
open('Ambiente di prova per il collaudo', back(6), 'Luca Neri', back(2))
open('Risposta al cliente sulla variante CR-12', back(2))
open('Elenco dei casi di prova firmato', yesterday, 'Anna Bianchi')
const estimate = open('Stima della migrazione dei dati', back(4), 'Mario Rossi')
register = updateOpenPoint(register, estimate, { state: 'resolved' }, yesterday)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
writeFileSync(join(settings, 'open-point.json'), JSON.stringify(register, null, 1))
