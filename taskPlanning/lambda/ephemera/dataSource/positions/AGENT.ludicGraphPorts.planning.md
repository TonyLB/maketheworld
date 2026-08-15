# `ludicGraph` ports: implementing the boundary mechanism

**Status: not started. Blocked on nothing for Stage 1; Stage 2 waits on P7.** Next step is [LP1](#recommended-order).

**This is an implementation plan, deliberately, and the choice is load-bearing.** Ports were designed inside [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md), which follows the **design-stage variant** ([`AGENT.designVariant.md`](../../../../AGENT.designVariant.md)). This plan follows the **base framework** ([`taskPlanning/AGENT.md`](../../../../AGENT.md)) instead, because all four of the variant's overrides are wrong for this work: resolved rows here are *finished*, not graduated; its open decisions **do block slices**; it ships into a published package rather than producing tier-licensed evidence; and Progress wants a running log of what landed. [`AGENT.md`'s step 0](../../../../AGENT.md) warns that deciding this late is expensive, so it is recorded here rather than assumed.

**What this plan does not own.** Every design verdict about ports stays in the abstraction-layers plan as a PQ row and graduates there. **This plan cites those rows as premises and never restates their content** --- the same discipline the `ludicCache` corpus file uses for C-series cases, adopted here to keep two files from drifting. If a premise below looks wrong, the fix is upstream, not here.

**And the trap this plan is most likely to fall into, named up front.** [CC1b](AGENT.abstractionLayers.planning.md#recommended-order) warns that *an implementation that runs smoothly under opaque ids has produced a convenience, not a verdict*. **Building [PQ-4](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused)'s provisional keying does not settle PQ-4.** Nothing in this plan may be cited upstream as evidence that a provisional choice was correct; smooth implementation is the expected outcome of *either* branch. The rollback line recorded on PQ-4 stays live for the duration.

## Getting Started

1. **Read the framework once:** [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability and content split.
2. **Command authority is [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).** If any command here conflicts with it, follow that file.
3. **Runner and context.** `lambda/ephemera` is Jest-based and uses **`npm run test`**, not `npm test`. Run from the package root:
   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
   ```
4. **Baseline before editing** --- this should pass unchanged:
   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/
   cd packages/mtw-interfaces && npm run test -- --watchAll=false ts/ephemeraMeta.test.ts
   ```
5. **`npx tsc --noEmit` is not sufficient**, and this is not generic caution: `lambda/ephemera`'s `*.integration.test.ts` files sit outside `tsconfig`, so a rename or signature change can typecheck clean and still break the suite. Run the real suite.
6. **Read the code this changes before changing it:** [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md), then [`ludicGraph/index.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) and [`ludicGraph/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts).

## Why this plan exists

**Ports are locked in design and absent from code, and no step anywhere owned building them.** Their shape is [H3 clause 1](AGENT.abstractionLayers.proposals.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice), locked on 2026-08-06. But a survey of the abstraction-layers Recommended order on 2026-08-15 found **no step that implements them**: Channel C is CC0--CC10 and every step is about the cache, and Phases 0--7 are the design track. [PQ-10](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) owns a bounded matcher fix and nothing owns the rest.

**That is a gap rather than a deferral, and the distinction matters:** a deferred item has a gate someone can re-open, an unassigned one is invisible until something trips over it. **CC1 is what tripped over it.**

**What is blocked.** [CC1](AGENT.abstractionLayers.planning.md#recommended-order) --- the `ludicCache` rebuild function --- cannot be written. Its edges terminate at port addresses ([CC1b](AGENT.abstractionLayers.planning.md#recommended-order)), and the reducer's innermost operation is a discrimination between node and port terminals. Neither exists.

**What is not blocked, and must go first.** **P7, the merge-reduce proposal, does not wait on this plan --- this plan waits on parts of P7.** Articulating the reducer is what *generates* requirements on ports, and two of them were generated on 2026-08-15 and are recorded nowhere else (see [Premises](#premises-and-where-each-is-recorded), items 6 and 7). **Building the port record before P7 lands would build it blind to its only consumer** --- the failure CC0 was created to prevent, one layer down. Hence the stage split below.

## Premises, and where each is recorded

**Cite, do not restate.** Each row names where the verdict lives and its standing. **A premise marked *provisional* may be built against; it may not be closed by building it.**

| # | Premise | Standing | Recorded at |
| --- | --- | --- | --- |
| 1 | Ports are the boundary mechanism; a whole owns its interior graph, crossing happens only through ports | **Locked** 2026-08-06 | [H3 clause 1](AGENT.abstractionLayers.proposals.planning.md#h3-ports-as-the-boundary-mechanism-decomposition-as-a-modellers-choice) |
| 2 | A plain object carries a presence port; there is no *plain object* category to switch from | **Forced yes by entailment** --- *"the base case locked clause 1 rests on"*. **Flagged 2026-08-15: re-run before relying on it.** The row was argued in a vocabulary with **one** containment relation; premise 9 splits it into two, so *plain* now has to say **empty of which** --- a box with a crystal ball but no lid has contents and no parts. The argument runs on *decomposition*, not on kind, so it probably survives; *probably* is not *verified* | [PQ-13](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) |
| 3 | Port ids are **compact opaque tokens**, not ordinals and not names | **Provisional**, with a named rollback line | [PQ-4](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) |
| 4 | The separator is a second `#`, chosen so `isEphemeraTaggedId` **throws** rather than silently affirming | **A lean, verified against shipped code 2026-08-13 --- not yet a decision.** [LP1](#recommended-order) graduates it | [PQ-9](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) |
| 5 | Port-qualified endpoints are invisible to the shipped matchers; the fix is not architectural | **Open, bounded.** The open half is *which* sites, and parse-time versus comparison-time resolution | [PQ-10](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) |
| 6 | **A port must be navigable from both sides.** One that records its egress target but not what attaches from inside makes walks succeed in one direction and **silently return nothing** in the other | **Open --- generated by the reducer 2026-08-15, owed to P7** | [LC staged finding 5](AGENT.abstractionLayers.ludicCache.corpus.planning.md#mechanism-findings-staged-for-p7) |
| 7 | **Is there ever a pass-through with no nameable mediator?** --- whether a bare port-to-port interior edge must exist at all | **Open.** A `ludicGraph` representation question, answerable **without** P7 | [LC7](AGENT.abstractionLayers.ludicCache.corpus.planning.md#lc7-the-cable-that-passes-straight-through-the-box), [LC gap 6](AGENT.abstractionLayers.ludicCache.corpus.planning.md#coverage-gaps-recorded-up-front) |
| 8 | Declared versus derived ports | **Open, and not this plan's** --- explicitly left with PQ-9 | [PQ-9](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) |
| 9 | ***In* and *part of* are two non-exclusive containment kinds**, and the level-crossing relation is a new edge kind `PartOf`, root to part, inside the whole's own graph | **Decided 2026-08-09 and never implemented.** Worked example on the row: `Theseus -Held-> thread:1` and `room -In-> thread:2`, both true, of different parts, in different graphs | [AB-48](AGENT.abstractionLayers.planning.md#settled-register), [AB-4](AGENT.abstractionLayers.planning.md#settled-register) |
| 10 | **`rootId` is recorded, never derived** --- it must be an input, not read back off the edges | **Constraint, shipped-code-derived.** `computeCarryClosure`'s BFS absorbs a doubly-reachable object via whichever edge it traversed first, so the traversal *tree* is order-dependent while the induced edge set is not | [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) |
| 11 | Whether **Room, Area or Feature** belong in the part-of ladder | **Explicitly unsettled, and named as the thing most likely to be read as included.** Adding a node *tag* must not be taken to answer it | [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) |

## What we are changing

**Three code areas, and their blast radii differ enough to sequence by.**

- **[`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) --- published.** `EphemeraLudicRelationalEdgeData.from`/`to` are `EphemeraObjectId`. **`ROOM#A` does not match `OBJECT#${string}` under any reading**, so a room cannot be an edge terminal today --- and `Room` becoming a legal *node* in CC0b did not make it a legal *terminal*.
- **[`packages/mtw-interfaces/ts/baseClasses.ts`](../../../../../packages/mtw-interfaces/ts/baseClasses.ts) --- published, and touched only if a discriminator lands beside the tagged-id family.** `isEphemeraTaggedId` splits on `#` and **throws** `Illegal nested EphemeraId` above two sections.
- **[`ludicGraph/`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/) --- local.** The matchers, `rootId` and the `CarryClosureFragment` collapse, and eventually the port record itself.
- **The graph *shape* changes too, and it is not only about ports.** `EphemeraLudicGraphData` has no root; `EphemeraLudicGraphNode` is `Character | Object | Room`; `HostRelationalEdgeKind` is `'On' | 'Under' | 'Against' | 'Custom'` with **no containment kind at all**. LP4a--LP4d close those, and all three are **decided design that was never implemented** rather than open questions.

**One correction carried in from 2026-08-15 so it is not re-derived:** it is **not** true that a port address cannot be typed as an `EphemeraObjectId`. `EphemeraWrappedId<T>` is `` `${T}#${string}` `` and `${string}` matches `ROPE#ab6129d`, so **the nested form satisfies the type statically and assigning one compiles clean** ([PQ-9](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused), limit (i)). The entire separator difference is **runtime**, inside the predicate. The room widening is a real typing change; the port widening is about honesty and runtime behaviour, not about making code compile.

## Recommended order

Pending work uses `- [ ]` and completed work uses `- [X]`; nested bullets carry their own boxes, so mark each `[X]` as it lands rather than only the parent.

**Stage 1 --- startable now. Nothing here bets on P7's mechanism.**

- [ ] **LP1. Graduate PQ-9's separator from a lean to a decision.** Everything else keys off it. The argument and the shipped-code verification already exist; what is missing is the graduation. **Done means:** the row's verdict cell reads as decided, and the [Open decisions](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) row upstream reflects it. **No code.**
- [ ] **LP2. Build the port-aware discriminator, and treat it as a first-class primitive rather than a helper.** PQ-9's limit (ii) is the requirement: under `#`, `isEphemeraObjectId(x)` **crashes** on a port address instead of returning `false`, so a port address cannot be handed to the tagged-id family even to ask *what kind of thing is this*. PQ-9 concludes a port-aware discriminator must land **in the same change as ports**.
  - [ ] **Decide where it lives** --- beside the tagged-id family in `baseClasses.ts` (published, and the natural home for something that fixes a hole in that family) or local to `positions/`. **Published is the recommendation**, because the hazard is in the published predicate, and a local fix leaves every other caller exposed.
  - [ ] Split a terminal into `{ kind: 'node' | 'port', base: EphemeraObjectId | EphemeraRoomId, port?: string }` without ever calling a throwing predicate on an unqualified string.
  - [ ] **Unit tests are the deliverable here, not an afterthought:** unqualified id, port-qualified id, room id, malformed multi-section id, and the empty-port-segment edge case.
- [ ] **LP3. Fix the matchers (PQ-10).** Confirmed sites, all reached from `ludicGraph`: [`assertNoRelationalEdgesReferencing`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) (`index.ts:307`), [`bothObjectsOnGraph`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) (`index.ts:337`), and `edgeReferencesObjectId` in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/baseClasses.ts).
  - [ ] **Settle PQ-10's open half first:** resolution at **parse time** (one place, but it discards the port and every downstream consumer loses it) versus **at each comparison** (preserves the port, but every new comparison site is a new chance to forget). **Recommendation: at comparison, via LP2's discriminator**, because parse-time resolution destroys exactly the information the reducer needs.
  - [ ] Regression tests that would have caught the original hazard: a port-qualified edge must be **found** by `assertNoRelationalEdgesReferencing(baseId)`, which is the assertion that passed vacuously.
- [ ] **LP4. Widen edge terminals to admit rooms.** Forced by [LC8](AGENT.abstractionLayers.ludicCache.corpus.planning.md#lc8-the-spring-in-the-box-and-in-the-contraption), whose edge begins at `ROOM#A`, and **forced under any reducer mechanism**, so it carries no bet on P7. Update `isEphemeraLudicRelationalEdgeData` and `ephemeraMeta.test.ts` in the same change, as CC0b did for the `Room` node.
- [ ] **LP4a. Add `rootId` to the graph shape --- and collapse `CarryClosureFragment` into it rather than leaving parallel duplication.** Concepts clause 3 requires exactly one root node, **present in the graph's own node list** and usable as an endpoint like any other, with the graph carrying a designation of which node that is. `EphemeraLudicGraphData` is still `{ hostId, nodes, edges? }` and has none. **This is the prerequisite for LP4c**, since a containment edge runs root -> member and the root must be nameable.
  - [ ] **`rootId` is recorded, never derived** (premise 10). Take it as an input; do not infer it from the edges.
  - [ ] **A revisit trigger fires here, and it was pinned in two places for this moment.** [`CarryClosureFragment`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) is `{ rootId, members, edges }` --- *"a rooted ludic graph in all but name"*, which *"exists as a separate shape only because this class has no root to lend it."* [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) states the instruction plainly: **if `ludicGraph` ever gains a root concept, the fragment should collapse into it rather than persist as parallel duplication.** Do not add a root and leave the fragment standing.
  - [ ] Name and type the root-designating field. [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) lists this as unsettled; `rootId` matches the shipped precedent and is the recommendation.
- [ ] **LP4b. Widen `EphemeraLudicGraphNode` to the component kinds the graph actually needs.** Today the union is `Character | Object | Room` (CC0b added `Room`). **Enumerate against the corpus rather than by guesswork**, and update `isEphemeraLudicGraphNode` plus `ephemeraMeta.test.ts` in the same change, exactly as CC0b did.
  - [ ] **`Feature` is a structural extension, not a widening, and it is not symmetric with the others.** [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) (confirmed in conversation 2026-07-24): a Feature node participates in a **subset** of the instruction structure --- never the **subject** of a relation, never **membership-moved**, *"more like the walls of a room than its contents"*, look-at-able and possibly a relation **target**. **Do not let it inherit Object-node capabilities by sharing a union with them.**
  - [ ] **Guard, and it is the one most likely to be violated silently (premise 11):** adding a node tag **does not** put that kind into the part-of ladder. `AGENT.concepts.md` names *"whether Room, Area or Feature belong in the part-of ladder at all"* as the inference most likely to be wrongly read in, and warns that **a uniform graph interior is not a uniform containment ladder.** Say so in the change.
- [ ] **LP4c. Add the containment kinds to `HostRelationalEdgeKind` --- closing the phantom edge.** The union is `'On' | 'Under' | 'Against' | 'Custom'`, so **the model cannot say *in* about anything**, and hosting's implicit *contents-of* link is *"not merely unlabeled but untypeable."* Premise 9 decided the fix on 2026-08-09 and nothing implemented it.
  - [ ] **Both kinds, not one.** `PartOf` alone leaves contents implicit and recreates the phantom edge for exactly the case that exposed it --- a box's crystal ball. AB-48 says *in* **and** *part of*.
  - [ ] **Non-exclusive.** A thing can be *in* something and *part of* it at once. **Must not be written as a mutually-exclusive switch** anywhere, including in guards and in narration.
  - [ ] **The distinction lives on the edge, never on the node.** This is what keeps it compatible with the locked role claim --- *"whole and part are roles relative to a level, not kinds"*, and *"any rule that gives parts and wholes different behaviour is not a rule at all."* The crystal ball is not a different kind of object from the lid; it is joined by a different kind of edge, and it is simultaneously a whole of its own interior. **Type the edge and the claims coexist; type the node and they collide.**
  - [ ] Check whether the storage row needs the column back: [`EphemeraPositionAdjacencyRow`](../../../../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.ts) is *"a from, a to, and no third column, which shows the shape was chosen rather than overlooked."* **Open**: whether containment kinds ride on the graph's `edges` (no storage change) or on adjacency rows (a published change).
- [ ] **LP4d. Refresh [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), which is stale on exactly this.** It still lists *"what relation kind joins a root to its members --- the model has no containment kind at all"* as **unsettled**, and still defines **Part** as any non-root node reached by *a* containment edge, with no sibling term for contents. **Both were superseded on 2026-08-09 by AB-4 and AB-48 and the update never propagated.** Add **Contents** as the sibling vocabulary row, and state that the two kinds are non-exclusive. **This is the same failure mode this plan exists to fix** --- a design answer that never reached the durable doc, invisible until someone read the doc and believed it. It caused a live misreading on 2026-08-15.
- [ ] **LP5. Answer premise 7 --- *is there ever a pass-through with no nameable mediator?*** A fiction and representation question, not a reducer question, so it is answerable now and it **closes or opens LP7 before LP7 is scheduled**. Give the conduit a node and *look in the tube* becomes a move a player can make; leave it bare and it does not. **Record the verdict upstream on the `ludicGraph` side, not here.**

**Stage 2 --- gated on P7. Do not start these before the merge-reduce proposal lands.**

- [ ] **LP6. Design and build the port record**, against premise 6: navigable from both sides. **The gate is real** --- one-directional navigability fails silently, and it is a requirement no consumer other than the reducer has ever stated, so building before P7 means guessing at it.
- [ ] **LP7. Widen edge terminals to admit port addresses**, in whatever shape LP6 lands. **Conditional on LP5:** if there is never a pass-through without a nameable mediator, the bare port-to-port edge is not needed and this step shrinks.
- [ ] **LP8. Unblock CC1.** Return to the abstraction-layers plan, clear CC1's blocked-by line, and confirm CC1b's port-identity seam still reads correctly against what was built.
- [ ] **LP9. Update checkboxes, Progress and Verification in this document** as the last step of each slice, after tests pass.

## Open decisions (implementation --- plan only)

| # | Decision | Blocks | Options | Recommendation |
| --- | --- | --- | --- | --- |
| **LD-1** | Where does the port-aware discriminator live? | LP2, and LP3 through it | Published, beside the tagged-id family in `baseClasses.ts`; or local to `positions/` | **Published.** The hazard is in the published predicate; a local fix leaves every other caller exposed to a throw |
| **LD-2** | Parse-time or comparison-time port resolution? | LP3 | Resolve once at parse; resolve at each comparison | **At comparison.** Parse-time discards the port, which is the information the reducer exists to use |
| **LD-3** | Is there ever a pass-through with no nameable mediator? | LP7's size | Always nameable --- no bare port-to-port edge; or bare edges required | **None yet** --- this is LP5's job, and it is a fiction question rather than a code one |
| **LD-4** | Does the room widening go out before ports, or in one release with them? | LP4 sequencing | Ship LP4 alone; or hold it and ship the whole widening together | **Ship alone.** It is forced independently of P7, and bundling it makes a settled change wait on an unsettled one |
| **LD-5** | Do containment kinds ride on the graph's `edges`, or on `EphemeraPositionAdjacencyRow`? | LP4c | Graph edges only --- no storage change; or restore the third column the adjacency row designed out | **None yet.** The row's missing column is recorded as *chosen rather than overlooked*, so restoring it needs a reason, not a reflex |
| **LD-6** | Does `Feature` land in this pass, or only the kinds the corpus forces? | LP4b scope | Include it, since its asymmetry is already documented; or defer until something needs a Feature node | **Defer unless the corpus forces it.** It is a structural extension with narrower capabilities, and adding an unused tag invites something to treat it as an ordinary Object node |

## Verification

Per-slice, from `lambda/ephemera` unless stated:

```bash
# Stage 1, after LP2/LP3
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/

# After LP4 (published package)
cd packages/mtw-interfaces && npm run test -- --watchAll=false ts/ephemeraMeta.test.ts

# Full positions suite before calling any slice done --- integration tests live outside tsconfig
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

**Documentation check per slice:** confirm cross-file links still resolve, in both directions --- this plan cites PQ rows upstream, and [CC1](AGENT.abstractionLayers.planning.md#recommended-order) cites this plan as its blocker.

## Progress

| Stage | Status | Next |
| --- | --- | --- |
| **Stage 1** (LP1--LP5, including LP4a--LP4d) | **Not started.** Unblocked --- nothing here waits on P7 | LP1, then LP4a since LP4c depends on it; LP5 early since it sizes LP7 |
| **LP4a--LP4d** (graph shape) | **Not started.** Added 2026-08-15 --- **implementing 2026-08-09 decisions that never reached code or the durable doc** | `rootId` first; `AGENT.concepts.md` is stale and misleads readers until LP4d |
| **Stage 2** (LP6--LP9) | **Not started, gated** on P7 landing | --- |
| **Upstream effect** | CC1 blocked; CC0b landed and is unaffected | LP8 clears it |
