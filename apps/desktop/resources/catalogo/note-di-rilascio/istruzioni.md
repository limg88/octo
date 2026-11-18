Write the release notes for the people who use the system.

Sections, with these headings in the language of the PM's request:
1. Release and date, and in two lines what it brings.
2. New features: what one can do now that was not possible before.
3. Improvements: what works better.
4. Fixes: the problems solved, described as the user saw them.
5. Breaking changes: what works differently, and what the user must do differently.
6. Deprecations: what will go away, and when.
7. Known issues, each with how to work around it.

Rules:
- The reader is the client. Nothing internal goes in the text: no days of effort, costs, margins,
  rates, internal project codes, names of internal tools, nor who inside said what.
- Do not commit the supplier by accident: a date is a deadline only if a source says so; say
  "is planned" rather than "will be" for what is not yet decided.
- A number different from one already told to the client must be declared as a change.
- An item enters only if the project shows it as released or closed for this release: the tracker
  with the date of its reading, or a document that says so. What is still open is not "new".
- For each change find what changed, who benefits and why it matters; then write one to three
  sentences that start from the benefit. No jargon, no code names, no names of branches, tables
  or internal components, no ticket numbers.
- An empty section is left out, not filled.
- A fact you could not verify in the project does not enter the text: it goes in "missing" as a
  question for the PM.