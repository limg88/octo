import type { DeliverableKind } from './deliverable.ts'

const CLIENT_RULES = `- The reader is the client. Nothing internal goes in the text: no days of effort, costs, margins,
  rates, internal project codes, names of internal tools, nor who inside said what.
- Do not commit the supplier by accident: a date is a deadline only if a source says so; say
  "is planned" rather than "will be" for what is not yet decided.
- A number different from one already told to the client must be declared as a change.`

const emailToClient: DeliverableKind = {
  id: 'email-cliente',
  title: 'Email al cliente',
  summary:
    'Recap, escalation o richiesta di decisione: una richiesta chiara, con chi e per quando.',
  audience: 'client',
  fields: [
    { key: 'destinatario', label: 'A chi scrivi', kind: 'text', required: true },
    {
      key: 'tema',
      label: 'Di che cosa',
      kind: 'text',
      required: true,
      hint: 'Per esempio: spostamento del collaudo',
    },
    {
      key: 'richiesta',
      label: 'Che cosa chiedi o comunichi',
      kind: 'long',
      required: true,
      hint: 'La decisione o l’azione che ti serve, e per quando',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the draft of a formal email to the client. A person sends it, never you.

Structure of the text, in this order:
1. A first line "Oggetto: …" with the subject: the topic, then the state or the action asked.
2. Context, in one line.
3. The present state, with the facts that support it written in the body: the reader may not
   open attachments.
4. One request only: the decision or the action asked, who owns it and by when. Several decisions
   become a numbered list, each with owner and deadline.
5. The next step on the supplier's side.

Rules:
${CLIENT_RULES}
- A fact you could not verify in the project does not enter the text: it goes in "missing" as a
  question for the PM.
- Formal register, in the language of the PM's request. No headings, no tables: it is an email.`,
  checklist: [
    'Una sola richiesta, con chi deve rispondere e per quando',
    'Nessun dato interno (giornate, costi, tariffe, codici commessa)',
    'I numeri sono quelli già comunicati al cliente, oppure il cambiamento è dichiarato',
    'Il tono è quello che usi con questo destinatario',
  ],
}

const statusReport: DeliverableKind = {
  id: 'stato-avanzamento',
  title: 'Stato di avanzamento',
  summary:
    'Il report di periodo per il cliente: avanzamento, fatto, prossimi passi, rischi, decisioni.',
  audience: 'client',
  fields: [
    {
      key: 'periodo',
      label: 'Periodo',
      kind: 'text',
      required: true,
      hint: 'Per esempio: Sprint 28, dal 26/10 al 13/11',
    },
    { key: 'destinatario', label: 'A chi è destinato', kind: 'text', required: false },
    { key: 'note', label: 'Che cosa mettere in evidenza', kind: 'long', required: false },
  ],
  instructions: `Write the status report of the period for the client.

Sections, with these headings in the language of the PM's request:
1. Period and summary, in three lines at most.
2. Progress by objective or deliverable.
3. Completed in the period.
4. Next steps.
5. Risks and blocks, each with its owner.
6. Decisions asked of the client, each with a deadline.

Rules:
${CLIENT_RULES}
- Every number cites its source: the tracker (with the date of its reading), a meeting note, a
  document.
- If the project says how old the tracker data may be and they are older, give no numbers from the
  tracker: write a qualitative report, say so in the summary, and list in "missing" what is needed.
- Look at the previous report, if the project has one: a number that changed is declared as a
  change, and nothing of the previous period is left as if it were new.`,
  checklist: [
    'Ogni numero ha la sua fonte, e la data dei dati del tracker è dichiarata',
    'I numeri sono coerenti con il report precedente, o lo scarto è dichiarato',
    'Rischi e blocchi hanno un responsabile',
    'Le decisioni richieste hanno una scadenza',
    'Nessun dato interno (giornate, costi, tariffe, codici commessa)',
  ],
}

const minutes: DeliverableKind = {
  id: 'verbale',
  title: 'Verbale di riunione',
  summary: 'Decisioni, azioni con responsabile e scadenza, questioni aperte, dalla trascrizione.',
  audience: 'internal',
  fields: [
    {
      key: 'riunione',
      label: 'Quale riunione',
      kind: 'text',
      required: true,
      hint: 'Titolo e data, o il nome del file della trascrizione',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the minutes of a meeting from its transcript or notes in the project.

Sections, with these headings in the language of the PM's request:
1. Date, participants and their roles, subject.
2. Decisions.
3. Actions: what, who owns it, by when.
4. Open questions.

Rules:
- The source is the transcript or the notes of the meeting. An automatic summary made by the
  meeting tool is not a source.
- Every decision and every action cites the passage it comes from.
- An owner or a deadline is written only if it was said in the meeting; otherwise write
  "[DA CONFERMARE]" in its place.
- A disagreement that the meeting did not settle is reported as such, with both positions: never
  a summary that takes a side.
- If you cannot find the meeting, write nothing invented: say so in "missing".`,
  checklist: [
    'La fonte è la trascrizione o gli appunti, non il riepilogo automatico',
    'Ogni decisione e ogni azione ha la sua fonte',
    'Responsabili e scadenze sono quelli detti in riunione; il resto è «DA CONFERMARE»',
    'I disaccordi non risolti sono riportati come tali',
  ],
}

/** The deliverables that ship with Octo, in the order the catalog shows them. */
export const DELIVERABLE_CATALOG: readonly DeliverableKind[] = [
  emailToClient,
  statusReport,
  minutes,
]

export function deliverableKind(id: string): DeliverableKind | null {
  return DELIVERABLE_CATALOG.find((kind) => kind.id === id) ?? null
}
