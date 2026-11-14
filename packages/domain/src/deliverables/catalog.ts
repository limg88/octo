import type { DeliverableKind } from './deliverable.ts'
import { ESTIMATE_PLACEHOLDER } from './pert.ts'

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
  deck: true,
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
- The report is also shown as slides, one per section: give each section a second-level heading,
  keep a section to a few short lines or one table, and put in a table what is a list of items
  with the same attributes (objectives, risks, decisions).
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

const estimateKind: DeliverableKind = {
  id: 'stima',
  title: 'Stima',
  summary: 'Giornate per attività con intervallo: tu confermi le righe, i totali li calcola Octo.',
  audience: 'internal',
  calculation: 'pert',
  fields: [
    {
      key: 'tema',
      label: 'Che cosa va stimato',
      kind: 'text',
      required: true,
      hint: 'Per esempio: migrazione del modulo ordini',
    },
    {
      key: 'perimetro',
      label: 'Che cosa è dentro e che cosa è fuori',
      kind: 'long',
      required: false,
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write an estimate of effort in days, for internal use.

"text" has these sections, with these headings in the language of the PM's request:
1. Scope: what is in, what is out, from which sources. New work apart from what is left of
   earlier phases.
2. Estimate: write only the line ${ESTIMATE_PLACEHOLDER} here. The code puts totals and tables there.
3. Assumptions, each with what changes if it is false.
4. Risks.
5. Open questions.
6. Exclusions.

"wbs" has one line per activity:
- "id" (W-01, W-02…), "fase", "attivita", "ruolo";
- "driver": what the effort depends on, with the marker [n] of its source ("40 requisiti [3]");
- "ott", "prob", "pess": optimistic, most likely and pessimistic days, with ott ≤ prob ≤ pess and
  never ott equal to pess. The most likely value is anchored to an evidence;
- "stato": "completo", "parziale" or "mancante", honestly. The range follows it: narrow when the
  information is complete, wide (pess at least three times ott) when it is missing.

Rules:
- Never write a total, a sum or a range yourself, anywhere: the code computes them from "wbs".
- Contingency is a line of its own, never hidden in the pessimistic values.
- Include the lines every estimate needs: alignment with the client, internal review, client
  review, delivery.
- Information you do not have is a line marked "mancante" with a wide range and an open
  question, not a point estimate "for now".`,
  checklist: [
    'Ogni riga dice da che cosa dipende lo sforzo, con la sua fonte',
    'Lo stato dell’informazione è onesto: dove manca, l’intervallo è largo',
    'La contingenza è una riga a sé',
    'Ci sono allineamento con il cliente, revisioni e consegna',
    'Gli avvisi sotto il totale sono risolti o motivati',
  ],
}

/** The deliverables that ship with Octo, in the order the catalog shows them. */
export const DELIVERABLE_CATALOG: readonly DeliverableKind[] = [
  emailToClient,
  statusReport,
  minutes,
  estimateKind,
]

export function deliverableKind(id: string): DeliverableKind | null {
  return DELIVERABLE_CATALOG.find((kind) => kind.id === id) ?? null
}
