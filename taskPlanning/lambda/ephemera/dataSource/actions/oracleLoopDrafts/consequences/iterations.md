# Consequences drafts: problems, proposals and what was tried

Owned by the [oracle loop plan](../../AGENT.oracleLoop.planning.md), like the [play-by-play's](../playByPlay/iterations.md), so it carries across episodes of tuning this piece. The first episode is the [imagination plan](../../AGENT.imagination.planning.md), from its step 1.5 (2026-11-11). It is laid out the same way as the play-by-play's:
- **Problems** say what is wrong, where it shows, and what "solved" means.
- A **Library** entry is one change, so one entry is one draft.
- The **Ledger** has one line per batch, with the detail in the draft's `.notes.md`.

**A draft is two parts:**
- this ask's part, `N.ask.txt` (Role, `Relations and frames`, examples and Task, with one `{{core}}` line);
- a version of the shared core, [`../imaginationCore/`](../imaginationCore/2.txt).

`npm run assemble-draft` in `lambda/ephemera/` builds the payload and prints each part's hash. A change to the core costs every ask's cells; a change to this part costs this ask's cells only.

The piece is [`imaginationPieces/consequences.ts`](../../../../../../../lambda/ephemera/calibration/imaginationPieces/consequences.ts). It is read, not tallied: code checks each reply's form, and every reply is read against its cell's look-for and the draft's rubric, both written before the batch.

**IDs:**
- Rows carried from the play-by-play's [disposition](../playByPlay/iterations.md#disposition-at-the-play-by-play-plans-exit-c-2026-11-11) keep their IDs, restated for this piece, as step 1.5 assigned them.
- New rows are `CQ-Pn` and `CQ-Ln` (mine), so they don't collide.

## Problems

| ID | Problem | Shows on | Solved when | Status |
| --- | --- | --- | --- | --- |
| PB-P3 | No knock-on motion where the plan needs a thing to stay put: the saucer and cup "need to stay" so that the cup catches the tea, where tipping the table would slide them | The play-by-play's OC-30/2: 0 of 3 in batches 1 and 11, 2 of 3 at best (batch 3) | OC-30/2's saucer and cup slide 3 of 3, the cup's place under the spout flagged, with OC-1's carry kept | Open; carried from the play-by-play, where the ask kept the action succeeding (PB-L22) |
| PB-P1 | The block's shape: `actions` as one entry per thing, as one object, or as sentences | The play-by-play, batches 1 to 11 | Every reply passes the form | Open; carried to both asks while the block is shared (IM-5) |
| PB-P6 | The reply cut off by the output cap | The play-by-play's draft 5 at 512 | No reply cut off | The cap 1024 for this piece too (`CONSEQUENCES_MAX_TOKENS`) |
| CQ-P1 | The knock-on hedged as conditional: the saucer "tilts along with the table", falling "if the table tips too far", where tipping the table to pour slides it | Draft 1: OC-30/2 2 of 3 | ~~The slide stated as what happens, 3 of 3~~ Reframed (the user, 2026-11-18): a hedge that names a condition the plan leaves open is a spread of outcomes worth keeping. It becomes a possibility, in the [action plan](../../AGENT.actionPlan.planning.md)'s step 5. Solved when every hedge names such a condition and none hedges against the scene | Open, reframed |
| CQ-P2 | Collateral flagged, not listed: breakage, spills, the glue "breaking free", none of which works against the intent | Draft 1: 6 of 6 (OC-1 3/3, OC-30/2 3/3). Draft 2: OC-1 0/3, OC-30/2 3/3 | OC-1's problems empty 3 of 3; OC-30/2's only what works against the pour | Open |
| CQ-P3 | The chosen method questioned: the glued teapot "might not pour … at all" | Draft 1: OC-30/2 1 of 3. Draft 2: 2 of 3, the glued teapot "tips over with it" and spills, read from the explicit render's securing line | No reply doubts the action it is given | Open |
| CQ-P4 | A line for a thing not listed: [table1], which the action names | Draft 2: OC-30/2 2 of 3 (draft 1: the teapot, 1 of 3). The render's own `The things:` section lists it, a likely source (mine) | No reply describes a thing not listed | Open; the block is replaced at the action plan's step 4b |

## Library

| ID | Change | Status |
| --- | --- | --- |
| PB-L22 | "How each of the things … moves" for the knock-on, in place of the play-by-play's premise | Built into draft 1 |
| PB-L1 | The whole scene in place of the sub-scene, with PB-5. Step 3's first lever is a subset between the two, with more of the named things' children and siblings (user, 2026-11-11) | Untried |
| PB-L3 | The candidate's after-state shown, with PB-3 | Untried |
| PB-L7 | The form in words, without "object" or "entry" | Untried; shared with the play-by-play while the block is |
| PB-L9 | The block keyed by thing | Untried; shared with the play-by-play while the block is |
| PB-L16 | A shorter reply | Untried; booked for when the replies are good |
| CQ-L1 | The explicit scene render (`scene: 'explicit'`) in place of the Fiction and Graph, with no core: the render says what the reading guide taught (the user's, 2026-11-17, [action plan](../../AGENT.actionPlan.planning.md) step 4a) | Draft 2 ([notes](2.notes.md#results-2026-11-18-batch-2)); batch 2 at parity, OC-1 better; kept (the user, 2026-11-18) |
| CQ-L2 | `Relations and frames` dropped, as the explicit render's carry lines overlap it (mine) | Untried; kept out of draft 2 so the render is tested alone |

**Options:** the `rules` and `scene` options are shared with the play-by-play. Draft 1 runs `rules: 'none'` (PB-2), with `consequence` available. Draft 2 runs `scene: 'explicit'`, which refuses `rules: 'consequence'`.

## Ledger

| Batch | Tried | Cells x calls | Result | Kept |
| --- | --- | --- | --- | --- |
| 1 | Draft 1, step 1.5's baseline ([notes](1.notes.md#results-2026-11-11-batch-1)) | 2 cells x3, Micro, 6 | Form 3 of 6 (OC-30/2 one entry per thing 3/3, PB-P1). **OC-1's carry 3/3**, with collateral flagged 3/3 (CQ-P2). **OC-30/2's knock-on 3/3, hedged in 2** (CQ-P1); the cup out from under the spout 0/3; against the intent in 1 reply's prose. The method questioned 1/3 (CQ-P3) | The baseline |
| 2 | Draft 2, the explicit render, no core (CQ-L1; [notes](2.notes.md#results-2026-11-18-batch-2)) | 2 cells x3, Micro, 6 | Form 3 of 6 (OC-30/2: one entry per thing 1/3, a [table1] line 2/3, CQ-P4). **OC-1 3/3:** the carry, problems empty; the glue flag gone. **OC-30/2 0/3, 3 partly, as batch 1:** the knock-on 3/3, hedged in 2; the cup out from under the spout 0/3. The method questioned 2/3 (CQ-P3), from the securing line | Parity; kept (the user, 2026-11-18) |
