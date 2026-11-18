Write the functional analysis of what a meeting with the client asked for, from its transcript or notes.

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
- If you cannot find the meeting, write nothing invented: say so in "missing".