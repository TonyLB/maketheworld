# Scene projection: the actor's cache, rendered for an LLM reader

**Status:** drafted 2026-11-01. Nothing is built. **Next step: Slice 0** (worked scenes, no code), which decides the rows that block Slice 1. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md): the deliverable is code, and its open questions each belong to a slice. This is a first iteration, written expecting to surface further questions; collect them in [Questions this iteration should surface](#questions-this-iteration-should-surface) rather than growing the slices.

## Goal

Every LLM rung still to be built (the orchestration loop in the [iteration ladder's proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25), the deferred adjudication tier's judge, the synthesis fallback) has to reason about what the actor can reach. The `ludicCache` holds that, but in a shape that is very bad for semantic reasoning. Membership is node-list position, not an edge. A hosting kind sits on a cover entry, not on a relation. Where a thing sits is a walk over `fromHostPresences`. One tie is three edges (`Custom`, the `SecuredTo` it justifies, and the `Justifies` between them). Handing the model JSON makes it reconstruct those facts before it can reason, and switches register between ids and meaning on every line.

This plan builds an **output-only projection** from the actor's cache into text an LLM reads as a scene:

```text
Contents of the Lab:
- [pole1] Pole (gloss: ...)
- [rope1] Rope (gloss: ...), tied to [pole1]
```

It has two layers:

- **A scene model:** structured data built from the actor's cache. It holds the described things, their handles, where each is placed, and the relations between them as phrases. Beside it sits a **handle table** mapping each handle to an id, which is never shown to the model.
- **A text renderer** over the scene model.

"Output-only" means the model is never parsed back into the cache. The handle table is how a later reader's output names things again (see SP-1).

**Payoff, at the observable output:** in dev, a player types `/test scene` and receives, as an OOC message, the rendered scene of their own actor's cache. That covers the room's contents, nested, with relations in words, and their held inventory. The integration test ends at that published message, not at the scene model. A second, smaller payoff is that `CommandAttempt.renderProse`'s room-context section is filled by the renderer instead of its string-list stub (Slice 4).

## What exists today (checked 2026-11-01)

- **The source.** [`ActorLudicCache`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCache.ts): the room's stored row unioned with a fold seeded at the actor, built per command by `loadCommandWorld`. It is a **boundary type**: the union is private, and each accessor answers one question with flat values (`entries`, `containersOf`, `boundaryRelationsOf`, `relationsBetween`, `securedToSupportEdgeIds`, `presencesOf`). Rule: [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild), "A command reads the actor's cache". The scene model would be one more accessor of the same kind.
- **What the cache carries** ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts)):
  - Nodes carry a reasoning `shortName` and `gloss`, both optional, plus `presenceNodes` (the bindings nested on their owner).
  - Cover entries carry the member's `hostingKind` in that host: `On`, `In`, `Held`, `PartOf` or `SectionOf`.
  - Edges carry `kind` (`Custom` with `relationLabel`, `SecuredTo`, `ConnectedTo`, `Justifies`), cache terminals (a component, a port address or an edge terminal) and `endHosts`.
  - A leg whose partner is outside the union stays an open leg ending at a port address.
- **Placement and naming helpers already in use:**
  - [`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts) builds each object's `placement`: its own bindings, the parents each sits under, and the rooms they reach.
  - [`objectViews.ts`](../../../../../lambda/ephemera/dataSource/actions/objectViews.ts) has `readingsOf`, `defaultReading`, `readingLabel` ("the cloth on the table", "in your hands", "in another room") and `wholeReadingLabel`.
  - Consult labels use these through `placeNameOf` in [`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts). `readingLabel` writes "on the X" for every object parent, whatever the hosting kind; that limitation is shelved in [actions `AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md#shelved-asking-the-player), "Option labels for same-named objects".
- **A precedent for a forward walk over covers:** [`roomObjectContents.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/roomObjectContents.ts), the room header. It goes one level deep, takes display labels from the viewer's asset stack, and nothing past its return type is cache-shaped. The scene differs on names: it is a reasoning view, so it uses the reasoning `shortName` and never a display label. The two never fall back to each other (memory rule; see the header's own comment).
- **The prose this feeds:** `CommandAttempt.renderProse(roomContext?)` ([`commandAttempt/index.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/index.ts)). **It has no production caller.** Its room-context section is a stub (`RoomContextSection`: `hostShortName`, `nodes: string[]`, `edges: string[]`). Its referents section prints the raw id (`- refKey -> OBJECT#..., shortName`), which is the same register problem in miniature. The six-section format and the "context comes from a scope function" rule are [CA-1 in the command attempt plan](AGENT.commandAttemptPhase.planning.md#open-decisions-implementation--plan-only). CA-1's first scope function is "the whole room's structure from `ludicCache` (short names, edges in words), with glosses for the referents only", and this plan builds it.
- **Not in the cache:**
  - Exits: the room's exits come from `roomExitContext`, and exits are not cache edges.
  - Bystanders: present characters other than the actor are in the characters row, not the cache.
  - Features: the catalog lists objects only.
- **A harness precedent for the payoff:** `/test parse` ([`parseObjectManipulationParseTestSlash.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/parseObjectManipulationParseTestSlash.ts), handled in [`runObjectManipulationParseHarness.ts`](../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runObjectManipulationParseHarness.ts)) returns one dev-only OOC report. Per the actions contract ("The test harnesses stay OOC"), a harness reply is not a command outcome.
- **Fixtures:** [`actorCacheTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCacheTestFixtures.ts) (Kitchen, table, lamp, bag, coin, rope, leash, actor, another character).

## Relationship to other plans

- **Concept** ([`positions/AGENT.conceptKind.planning.md`](../positions/AGENT.conceptKind.planning.md)): **gates SP-2.** It separates things present only by association from physical things, and its physical-forest invariant (AK-2) is what lets this plan render physical placement as a forest with Concepts as references. A rollback there rolls back SP-2's direction.

- **Iteration ladder** ([`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md)): this is foundation for the proposal's step 3 (the orchestration loop) and for layer 2 (fallbacks as attempt consumers). It builds no LLM call.
- **Command attempt phase** ([`AGENT.commandAttemptPhase.planning.md`](AGENT.commandAttemptPhase.planning.md)): CA-1's section 4 is this plan's first consumer (Slice 4).
- **Attention history** ([`positions/AGENT.attentionHistory.planning.md`](../positions/AGENT.attentionHistory.planning.md)): it owns what the cache holds; this plan only renders what it holds. If attention scoping narrows the cache, the scene narrows with it at no cost to this plan.
- **StableRefs** ([`positions/AGENT.stableRefs.planning.md`](../positions/AGENT.stableRefs.planning.md)): SR-5 asks whether ref variables share a namespace with `stableRefKey`. A scene handle is a third kind of name for a thing, so SP-1 should be decided knowing that row, not in isolation.
- **Edge abstractions** ([`positions/AGENT.edgeAbstractions.planning.md`](../positions/AGENT.edgeAbstractions.planning.md)): what a `Justifies` means at another scale. SP-3 collapses today's single-graph `Justifies` into a phrase and should not assume more than that.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **The graph model, before reading any cache code:** the primer [`positions/AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), all of sections 1--5. Its running example (Lab, box, cup, spring, contraption, hook, a rope across two rooms) is Slice 0's first scene. Edge identity (`edgeId`, `chainId`, legs) is defined in [`AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) (LG-10), not in the primer.
3. **The cache's rules:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild) ("Ludic cache staleness and rebuild", including "A command reads the actor's cache"), and `SecuredTo` / `Justifies` under its relation kinds.
4. **Who reads the scene, and why:** [actions `AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (`CommandAttempt`, especially the six-section prose and `gloss`), and the ladder's [orchestration-loop proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25).
5. **Code to read:** `actorCache.ts`, `catalogHandles.ts`, `objectViews.ts`, `roomObjectContents.ts`, `commandAttempt/index.ts` (`renderProse`).
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` files sit outside `tsconfig`. ts-jest here type-checks tests.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`. Record the pass count at Slice 0.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

Each row is decided against Slice 0's worked scenes, not in the abstract. Where a recommendation is given it is a starting point for Slice 0, not a decision.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SP-1 | **Handles: form, uniqueness and lifetime.** What the model sees in place of an id, and how its output names a thing again. Options include a name-derived slug (`[cup1]`), the bare short name made unique ("Cup", "Cup (2)"), or numbers. Also: are handles stable only within one render, or across the turns of one command (the loop's later turns must mean the same cup), or across commands? And how do they relate to `stableRefKey` (a phrase's referent) and to SR-5's ref variables? *Recommended start:* a name-derived slug, unique within one render, built deterministically from cache order so that one cache always renders the same handles. The handle table is part of the scene model's result. | 1 | Open |
| SP-2 | **Placement in a DAG.** **Gated on the [Concept plan](../positions/AGENT.conceptKind.planning.md)** (user, 2026-11-01): if that plan is rolled back, this direction is rolled back with it. *Direction pending that plan:* physical placement is a forest over hosts (its AK-2 invariant, decided 2026-11-01: each binding's physical parents all belong to one host; relied on here, not enforced at write time), nested by indentation with no back-references among physical placements. A binding with several parents on one host (a join) renders once, under that host. An object with several bindings (a spread rope or plank) appears once per binding, worded with the `readingsOf` / `readingLabel` vocabulary ("one end on [sawhorse1], the other on [sawhorse2]"). Concepts are not placed; they are rendered as references from their associated members. (Concept plan AK-3: the room holds an `Associated` binding of each Concept with a member there, so the renderer finds it in the room's row and leaves it out of the physical forest.) Open here: whether a thing reachable only through another's interior is nested or flattened, and what this plan renders if Slice 1 must start before the Concept plan's Slice 4 lands. | 1 | Open; AK-2 decided, still gated on the Concept plan holding |
| SP-3 | **Relations as phrases.** What the scene model carries for each edge, and the wording:<br>- a `Custom` label, as given ("tied to");<br>- `SecuredTo` plus its `Justifies` folded into the manner edge they support ("tied to [pole1], secured");<br>- `ConnectedTo` inside one whole (suppressed, or written as part of the description of the parts);<br>- an open leg ("tied to something inside [box1]");<br>- direction, read as English about the subject, as the primer does.<br>The **structure** (what the model holds per relation) blocks Slice 1; the **wording** blocks Slice 2. | 1 | Open |
| SP-4 | **What sits outside the cache in this iteration.** The room itself (named as the heading), its exits (from `roomExitContext`; navigation is a Plan attempt, so a reader may need them), bystanders (characters row), and features (not in the catalog). *Recommended start:* the room heading and held inventory are in; exits are in as their own section if the harness can read them cheaply (the command world already loads them); bystanders and features are out, recorded under the questions below. | 1 | Open |
| SP-5 | **Where the two layers live.** *Recommended start:* the scene model is an accessor on `ActorLudicCache` (positions, beside `entries`), so the boundary-type rule holds and nothing outside sees cache shapes. The text renderer is actions-side beside `commandAttempt/` (`actions/sceneProse/` or similar), since rendering for an LLM reader is the attempt prose's concern. Placement helpers now in `actions/objectViews.ts` are reused, not copied. | 1 | Open |
| SP-6 | **The payoff surface.** A `/test scene` harness (the recommendation, following `/test parse`): routed by the slash prefix with no Bedrock, it builds the actor's cache through `loadCommandWorld`'s read and posts one OOC report holding the rendered scene and, below it, the handle table. The alternative is to pin the payoff on `renderProse` alone, but that has no production caller, so no player could see it. | 3 | Open |

## Questions this iteration should surface

Not Open rows: none of these gates a slice. Each is recorded when Slice 0 or a later slice meets it, with the scene that raised it, and is handed to an owner in Slice 5 (an existing plan, a new plan, or a shelf in a durable doc).

- **Scope.** Is the whole actor's cache the right context, or a part scoped to the command (the things Identify's pools touched, plus their neighbours)? This iteration renders everything. The scope function in CA-1 is where a narrower scope goes, and attention history decides what the cache holds at all.
- **Size.** Token count of a rendered scene for the Coyote rooms at their placement cap. Measure in Slice 3; it decides nothing until a reader has a budget.
- **Grounding a handle back.** How a reader's output names a handle so that it becomes a `ReferentAssignment` entry, or a `graphNode` referent, without breaking the freeze rule (actions contract, "Plan stays blind to the world, or its output is frozen whole").
- **The hand-up.** The loop's first turn needs the fills, readings, pools and abstain reasons beside the scene. Today `compileAttemptsFromSkeleton` returns one `Abstain { reason }`. That is a separate piece of foundation, not this plan's.
- **Unnamed things.** A node with no `shortName` is left out of the catalog, but it can still be one end of a relation or a container.
- **State.** The prose's State section overrides the gloss. Where the scene would carry a state override once a state axis exists.
- **Hosting kinds `Held`, `PartOf`, `SectionOf` in words**, and whether `readingLabel`'s "on the X" for every object parent should take the scene's wording (one fix for both).
- **Bystanders and features** as scene content, if SP-4 leaves them out.
- **Inbound links.** Nothing links to this plan yet: neither CA-1 in the command attempt plan nor the ladder's orchestration-loop proposal (user, 2026-11-01: hold off and see what falls out of the questions). Slice 5 is obligated to add both if nobody has. Whether to add them earlier, and in what form, stays open while the questions are discussed.

## Progress

| Slice | State |
| --- | --- |
| 0. Worked scenes; decide SP-1, SP-3, SP-4, SP-5 (no code) | Not started; can start. SP-2's direction rests on the Concept plan's AK-2 (decided) |
| 1. Scene model and handle table, built from `ActorLudicCache` | |
| 2. Text renderer | |
| 3. Payoff: `/test scene` | |
| 4. First consumer: `renderProse`'s room context and referents | |
| 5. Durable docs, spin-off handoff, plan deleted | |

## Recommended order

Pending work is `[ ]` and completed work is `[X]`; mark each nested line `[X]` as it is done.

0. [ ] **Slice 0: worked scenes (no code).**
   - [ ] Record the baseline pass count (Getting Started step 7).
   - [ ] Write each scene below as a small cache setup plus its hand-written expected render. Keep them in a temporary sibling, `AGENT.sceneProjection.corpus.temp.md`, deleted when Slice 2's golden tests pin the same renders.
     - [ ] The primer's running example, from the Lab: box with cup and spring, contraption whose mechanism is the same spring, hook, rope tied to the hook and to the cup inside the box (a joined crossing), the rope's other end in the Hall.
     - [ ] Held inventory: a bag in hand holding a coin; a rope with one end in hand and one end on the floor (half-held, so `catalogScope` is `room`).
     - [ ] Two objects with the same short name (two cups), one on a table and one in the room.
     - [ ] A tie (`Custom` plus `SecuredTo` plus `Justifies`) next to a bare `Custom` edge with no `SecuredTo`.
     - [ ] An open leg: an edge whose far end the cache does not hold.
     - [ ] A draped cloth with a part on the table and a part in the room.
     - [ ] A node with no `shortName` that is a container or a relation end.
     - [ ] An empty room with the actor holding nothing.
   - [ ] Decide SP-1, SP-3, SP-4 and SP-5 against the scenes; write the scenes' expected renders under SP-2's pending direction, and give them to the Concept plan's Slice 0 as cases the AK-2 invariant must hold over. Record each decision in its row, and add anything new to [Questions this iteration should surface](#questions-this-iteration-should-surface).
1. [ ] **Slice 1: the scene model.**
   - [ ] Define the scene model type and the handle table (shape from SP-1 to SP-4), with no cache types in its surface.
   - [ ] Build it from the actor's cache (SP-5's home): a forward walk over covers from the room, then the actor; placements per SP-2; relations per SP-3's structure.
   - [ ] Unit tests over cache fixtures for every Slice 0 scene, asserting on the model (structure, not prose). Extend `actorCacheTestFixtures.ts` where a scene needs it.
2. [ ] **Slice 2: the text renderer.**
   - [ ] A pure function from the scene model to text, with SP-3's wording.
   - [ ] Golden tests: every Slice 0 scene renders exactly its hand-written text. Then delete the corpus temp file, moving any reasoning worth keeping into this plan's rows.
3. [ ] **Slice 3: payoff, `/test scene`** (SP-6).
   - [ ] Slash prefix and tail parse beside `/test parse`'s (no Bedrock), a harness handler that reads the actor's cache as `loadCommandWorld` does, and one OOC report with the render and the handle table.
   - [ ] Integration test from a real fold (leaf reads faked, per the house pattern) to the published OOC message, asserting on the message text.
   - [ ] Smoke-test in dev on a Coyote room at a realistic placement count; record the token size (questions section, "Size").
4. [ ] **Slice 4: first consumer, the attempt prose.**
   - [ ] `renderProse`'s room context takes the rendered scene in place of `RoomContextSection`'s string lists; the CA-1 scope function is "the whole actor's cache".
   - [ ] The referents section names each referent by its scene handle, not its raw id, so the attempt prose and the scene use one set of names. Update `commandAttempt/index.test.ts` to match.
5. [ ] **Slice 5: durable docs and handoff.**
   - [ ] Rules to `positions/AGENT.contract.md` (the accessor, if a rule-bearing boundary) and the actions contract (handles; the scene uses reasoning names, never display labels); code map to both `AGENT.implementation.md` files; vocabulary (scene, handle) to actions `AGENT.concepts.md` only if it is new vocabulary a reader needs.
   - [ ] Hand each entry under [Questions this iteration should surface](#questions-this-iteration-should-surface) to an owner: an existing plan's row, a new plan, or a shelf in a durable doc.
   - [ ] **Obligated, if not done earlier:** link this work from CA-1 in the command attempt plan and from the ladder's [orchestration-loop proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25), pointing at the shipped renderer. Whether to link earlier is under [Questions this iteration should surface](#questions-this-iteration-should-surface), "Inbound links".
   - [ ] Grep for inbound links to this file, then delete it.

## Verification

From `lambda/ephemera/`:

- Full suite (every slice): `npm run test -- --watchAll=false`. Compare against the Slice 0 baseline count.
- After changing a shared field to required: `npm run test -- --clearCache` once before trusting a green run (see the testing doc).
- Slice 1--2 focus: `npm run test dataSource/positions/ludicCache/actorCache.test.ts` and the renderer's test file (path set by SP-5).
- Slice 3: the `/test scene` integration test by path, then the dev smoke test.
- Before deleting the plan: `grep -rn "sceneProjection" --include='*.md' .` from the repo root.
