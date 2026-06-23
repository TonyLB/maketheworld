# Diegetic logic --- unknowns

Extension of [`AGENT.concepts.md`](AGENT.concepts.md). How the system treats **uncommitted** in-fiction detail.

**Status:** Stub --- vocabulary and open questions only.

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Unknown** | Detail the fiction has **not** committed to in manipulation truth (or has **revoked**). Distinct from "the server does not know yet" as a transient cache miss. |
| **Withhold** | Refuse to assert detail in a projection or emission even when generation could guess --- preserves unknowns for storytelling. |
| **Assert** | Commit a claim into manipulation truth (or a durable field that counts as truth for a consumer). |
| **Elaborate** | Add **presentation-only** or **generation** detail that does not retroactively become manipulation truth unless a later operation asserts it. |

---

## Open design threads

- **Perspective:** What is unknown to one character may be known globally (or to another perspective). How diegetic logic interacts with `perspectiveKey` filtering is TBD.
- **Improvisation:** Spawning objects asserts **existence** and **placement**; other attributes may remain unknown until enriched or described.
- **Relational edges (slice 5+):** Whether an `On` / `In` edge **asserts** contact geometry or only a narrative staging relation is TBD.
- **Graduation:** When asserting vs elaborating becomes normative, rules move to **`AGENT.contract.md`** and the owning implementation lane.

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.concepts.md`](AGENT.concepts.md) | Known vs unknown summary |
| [`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md) | What play graphs commit to today |
| [`../AGENT.narrativeTranscript.concepts.md`](../AGENT.narrativeTranscript.concepts.md) | Transcript position vs correlation (orthogonal) |
