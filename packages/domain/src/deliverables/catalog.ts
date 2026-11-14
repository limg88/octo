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

const NO_INVENTION = `- A fact you could not verify in the project does not enter the text: it goes in "missing" as a
  question for the PM.`

const testScenarios: DeliverableKind = {
  id: 'scenari-di-test',
  title: 'Scenari di test',
  summary:
    'I casi da provare per una funzione, dai requisiti: passi, dati, esito atteso, casi limite.',
  audience: 'internal',
  fields: [
    {
      key: 'tema',
      label: 'Che cosa va provato',
      kind: 'text',
      required: true,
      hint: 'La funzione, la voce di backlog o il requisito',
    },
    {
      key: 'livello',
      label: 'Che tipo di prova',
      kind: 'text',
      required: false,
      hint: 'Per esempio: collaudo con il cliente, regressione, integrazione',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the test scenarios of a function, from what the project says it must do.

Sections, with these headings in the language of the PM's request:
1. What is tested and from which requirements, each with its source.
2. Preconditions and test data.
3. Scenarios, one block each, numbered TS-01, TS-02…: scenario, objective, the requirement or
   acceptance criterion it covers, starting conditions (state, data, permissions), role of the
   user, steps as a numbered list (action, then expected result), expected outcome. One
   behaviour per scenario.
4. What is not covered, and why.
5. Open questions: what the requirements do not say and a test needs to know.

Rules:
- Every scenario covers a requirement or an acceptance criterion written in the project, and
  cites it. A scenario you would add from experience alone goes in "Open questions" as a proposal.
- The expected result is what the source says, in its words where they are precise. Where the
  source is vague, do not invent a threshold or a message: ask in "Open questions".
- Beside the main path write the negative and the limit cases the requirement implies: empty
  values, limits, missing permissions, wrong order of the steps.
- Steps are written so that someone who does not know the system can follow them.
${NO_INVENTION}`,
  checklist: [
    'Ogni scenario dice quale requisito o criterio di accettazione copre',
    'Gli esiti attesi vengono dai requisiti, non sono inventati',
    'Ci sono i casi negativi e i casi limite, non solo il percorso principale',
    'Ciò che non è coperto è dichiarato',
  ],
}

const backlogItem: DeliverableKind = {
  id: 'voce-di-backlog',
  title: 'Voce di backlog',
  summary: 'Una storia pronta da copiare nel tracker: perché, che cosa, criteri di accettazione.',
  audience: 'internal',
  fields: [
    {
      key: 'tema',
      label: 'Quale bisogno',
      kind: 'text',
      required: true,
      hint: 'Per esempio: esportazione degli ordini in Excel',
    },
    {
      key: 'origine',
      label: 'Da dove viene',
      kind: 'text',
      required: false,
      hint: 'La riunione, la mail o il documento che lo chiede',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write one backlog item, ready to be copied by hand into the tracker. You never write to the tracker.

Sections, with these headings in the language of the PM's request:
1. Title: "[component] — [action]", in one line.
2. Why: who needs it and for what, with the source of the request.
3. Description: the expected behaviour and its context, in one or two paragraphs, in the
   imperative form with the system or the component as subject ("the system must…"), in the
   terms of the project (its glossary, the names of its screens and data).
4. Acceptance criteria: a numbered list, each one checkable by a test. Cover, where the request
   allows it: the observable behaviour, a limit case, an error or an empty value, performance,
   integration with what is around, and what an automated test would check.
5. Out of scope.
6. Dependencies and links to other items of the project, by their id.
7. Open questions.

Rules:
- One need, one item: small enough to be released and tested on its own. If the request holds
  several, write the first and list the others in "Open questions" as items to open.
- The imperative form is the default. Write a user story ("as a… I want… so that…"), a
  why-what-acceptance or a job story only if the PM asks for it, and Gherkin criteria
  ("given … when … then …") only if the PM asks for them.
- Before writing, look in the project for an item that already covers the need: if there is one,
  say so at the top and write what would change in it instead of a duplicate.
- No estimate, no priority and no assignee: the team decides those.
- The words of who asked are quoted, not improved: an ambiguity in the request stays visible and
  becomes an open question.
${NO_INVENTION}`,
  checklist: [
    'Un solo bisogno, con la fonte della richiesta',
    'I criteri di accettazione si possono provare uno per uno',
    'Non duplica una voce che c’è già',
    'Nessuna stima, priorità o assegnatario decisi al posto della squadra',
  ],
}

const releaseNotes: DeliverableKind = {
  id: 'note-di-rilascio',
  title: 'Note di rilascio',
  summary: 'Che cosa cambia per chi usa il sistema: novità, correzioni, problemi noti.',
  audience: 'client',
  fields: [
    {
      key: 'tema',
      label: 'Quale rilascio',
      kind: 'text',
      required: true,
      hint: 'Versione o nome, per esempio: 2.4 di novembre',
    },
    { key: 'data', label: 'Data del rilascio', kind: 'date', required: false },
    {
      key: 'perimetro',
      label: 'Che cosa contiene',
      kind: 'long',
      required: false,
      hint: 'Lo sprint, il periodo o l’elenco delle voci rilasciate',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the release notes for the people who use the system.

Sections, with these headings in the language of the PM's request:
1. Release and date, and in two lines what it brings.
2. New features: what one can do now that was not possible before.
3. Improvements: what works better.
4. Fixes: the problems solved, described as the user saw them.
5. Breaking changes: what works differently, and what the user must do differently.
6. Deprecations: what will go away, and when.
7. Known issues, each with how to work around it.

Rules:
${CLIENT_RULES}
- An item enters only if the project shows it as released or closed for this release: the tracker
  with the date of its reading, or a document that says so. What is still open is not "new".
- For each change find what changed, who benefits and why it matters; then write one to three
  sentences that start from the benefit. No jargon, no code names, no names of branches, tables
  or internal components, no ticket numbers.
- An empty section is left out, not filled.
${NO_INVENTION}`,
  checklist: [
    'Ogni voce risulta rilasciata o chiusa nel tracker, con la data dei dati',
    'Ogni voce parte dal beneficio per chi usa il sistema, senza gergo né numeri di ticket',
    'I problemi noti hanno il loro modo di aggirarli',
    'Nessun dato interno (giornate, costi, tariffe, codici commessa)',
  ],
}

const functionalAnalysis: DeliverableKind = {
  id: 'analisi-funzionale',
  title: 'Analisi funzionale da riunione',
  summary:
    'Dalla trascrizione di una riunione con il cliente: requisiti, regole, voci di backlog proposte.',
  audience: 'internal',
  fields: [
    {
      key: 'riunione',
      label: 'Quale riunione',
      kind: 'text',
      required: true,
      hint: 'Titolo e data, o il nome del file della trascrizione',
    },
    {
      key: 'ambito',
      label: 'Quale funzione o area',
      kind: 'text',
      required: false,
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the functional analysis of what a meeting with the client asked for, from its transcript or notes.

Sections, with these headings in the language of the PM's request:
1. Meeting, date, participants, and the function or area discussed.
2. Context: how it works today, as the meeting described it.
3. Functional requirements: a table with id (RF-01, RF-02…), the requirement in one sentence,
   who asked for it, and the passage of the transcript it comes from.
4. Non-functional requirements, constraints and dependencies, apart from the functional ones.
5. Business rules and data: validations, calculations, states, roles, as they were said.
6. Proposed backlog items: a table with title, the requirements it covers, and whether an item
   of the project already covers it (with its id) or it is new. With a wide scope, group them
   by stream of work.
7. Decisions taken in the meeting.
8. Open questions: what the meeting left undecided, ambiguous or contradictory, each with who
   can answer and whether it blocks the work.

Rules:
- The source is the transcript or the notes. An automatic summary made by the meeting tool is
  not a source.
- A requirement is what someone asked, not what would be reasonable to build: a solution nobody
  discussed does not enter, even if it is obvious.
- Two participants who said different things are both reported, with their words: the document
  does not choose.
- Use the terms of the project. Where the client corrected a term, the client's term wins and
  the wrong one does not come back. A new term heard in the meeting is quoted and marked as new.
- The proposed items are proposals to be opened by hand in the tracker; give no estimate.
- If you cannot find the meeting, write nothing invented: say so in "missing".`,
  checklist: [
    'La fonte è la trascrizione o gli appunti, non il riepilogo automatico',
    'Ogni requisito ha chi l’ha chiesto e il passaggio da cui viene',
    'Nessuna soluzione che in riunione non è stata discussa',
    'Le contraddizioni sono riportate, non risolte',
    'Le voci proposte dicono se nel progetto c’è già qualcosa che le copre',
  ],
}

const trackerChanges: DeliverableKind = {
  id: 'modifiche-al-tracker',
  title: 'Modifiche da applicare al tracker',
  summary:
    'L’elenco delle modifiche da fare a mano sul tracker: voce, azione, testo di oggi, testo nuovo, decisione.',
  audience: 'internal',
  fields: [
    {
      key: 'tema',
      label: 'Che cosa va sistemato',
      kind: 'text',
      required: true,
      hint: 'Per esempio: esiti della riunione di pianificazione del 12/11',
    },
    {
      key: 'origine',
      label: 'Da dove vengono le modifiche',
      kind: 'text',
      required: false,
      hint: 'La riunione, la mail o il documento che le decide',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the list of changes a person will apply by hand to the tracker. You never write to the tracker.

Sections, with these headings in the language of the PM's request:
1. Summary: what the changes come from, the date of the tracker data you read, how many items
   are touched and how many changes of each kind.
2. Changes, grouped by feature (or parent item) and, inside it, by sprint. For each item:
   - its id and title, owner, sprint and state today;
   - the action: change, addition, removal, suspension (taken out of scope), or whole
     replacement;
   - the field and its text today, word for word from the project's copy of the tracker;
   - the new text;
   - the decision it comes from and who took it, with its source.
3. Items to create: title, type, parent, and the source that asks for it.
4. Suspended or under re-evaluation: the items taken out of scope or waiting for a decision,
   apart from the others.
5. Not applied: what the source asks that you could not turn into a change, and why.

Rules:
- One change, one field of one item: the person ticks them off one by one.
- "Text today" is what the project's copy of the tracker says, never what you assume. If it is
  already the new text, the change is left out.
- The new text comes only from a decision that can be traced: minutes, an addendum, an open
  question that was answered. A change nobody decided does not enter, however sensible: it goes
  in "Not applied" as a proposal.
- If the project says how old the tracker data may be and they are older, write no list: say so
  in the summary and ask in "missing" for fresh data. If they are older than the source of the
  changes, say so at the top: a text may have changed since.
${NO_INVENTION}`,
  checklist: [
    'Ogni modifica è un solo campo di una sola voce, con il testo di oggi e il testo nuovo',
    'Il testo di oggi è quello del tracker, parola per parola',
    'Ogni modifica ha la decisione da cui viene e chi l’ha presa',
    'La data dei dati del tracker è dichiarata',
    'Nessuna modifica che nessuno ha deciso',
  ],
}

const technicalProposal: DeliverableKind = {
  id: 'technical-proposal',
  title: 'Technical proposal',
  summary:
    'La parte narrativa di una proposta: contesto, perimetro, attività, approccio, assunzioni. Senza cifre.',
  audience: 'client',
  fields: [
    {
      key: 'tema',
      label: 'Per quale fase o progetto',
      kind: 'text',
      required: true,
      hint: 'Per esempio: fase 3, da gennaio a marzo',
    },
    {
      key: 'perimetro',
      label: 'Quale perimetro',
      kind: 'long',
      required: true,
      hint: 'Dove è deciso che cosa è dentro: la presentazione di pianificazione, un elenco, una mail',
    },
    { key: 'note', label: 'Altro da sapere', kind: 'long', required: false },
  ],
  instructions: `Write the narrative part of a technical proposal for a phase of work.

Sections, with these headings in the language of the PM's request:
1. Context and objectives of the phase.
2. Scope, by stream of work: what is done in each.
3. Activities and deliverables.
4. Approach and way of working: ceremonies, environments, quality, how changes are handled.
5. Assumptions and dependencies on the client.
6. Out of scope.
7. Organisation of the team, by role.

Rules:
${CLIENT_RULES}
- No figures at all: no days, no effort, no costs, no rates, no capacity, no head count, in the
  text or in a table. Effort and prices travel in another document.
- The scope is what the source named by the PM decides, not everything the tracker lists for the
  phase. An item of the tracker that the source does not name stays out and is listed in
  "missing" as a question.
- Exclusions written in the source are kept word for word.
- If the project holds the proposal of the previous phase, follow its structure and its terms,
  and leave nothing of the previous phase as if it were of this one. A deliberate reference to
  the previous phase ("in continuity with…") stays.
- Roles, never names of people, unless the source names them for this purpose.
${NO_INVENTION}`,
  checklist: [
    'Nessuna cifra: né giornate, né costi, né capacità, nemmeno nelle tabelle',
    'Il perimetro è quello deciso nella fonte indicata, non l’elenco del tracker',
    'Le esclusioni sono riportate parola per parola',
    'Nessun residuo della fase precedente',
    'Assunzioni e dipendenze dal cliente sono esplicite',
  ],
}

/** The deliverables that ship with Octo, in the order the catalog shows them. */
export const DELIVERABLE_CATALOG: readonly DeliverableKind[] = [
  emailToClient,
  statusReport,
  minutes,
  estimateKind,
  functionalAnalysis,
  backlogItem,
  trackerChanges,
  testScenarios,
  releaseNotes,
  technicalProposal,
]

export function deliverableKind(id: string): DeliverableKind | null {
  return DELIVERABLE_CATALOG.find((kind) => kind.id === id) ?? null
}
