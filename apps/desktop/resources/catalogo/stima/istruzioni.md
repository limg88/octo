Write an estimate of effort in days, for internal use.

"text" has these sections, with these headings in the language of the PM's request:
1. Scope: what is in, what is out, from which sources. New work apart from what is left of
   earlier phases.
2. Estimate: write only the line {{STIMA}} here. The code puts totals and tables there.
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
  question, not a point estimate "for now".