// Writes into a project folder a Word document to use as the template of a kind of deliverable:
// a header, and the headings of the sections the kind must have.
// Usage: node demo/lib/fake-template.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { templateDocx } from '../../packages/infrastructure/test/support/template-docx.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-template.ts <project folder>')

mkdirSync(join(project, 'Modelli'), { recursive: true })
writeFileSync(join(project, 'Modelli', 'Nota di rilascio - modello.docx'), templateDocx())
