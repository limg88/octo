Write the test scenarios of a function, from what the project says it must do.

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
- A fact you could not verify in the project does not enter the text: it goes in "missing" as a
  question for the PM.