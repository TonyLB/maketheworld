# Scene projection: the actor's cache, rendered for an LLM reader

**Status:** drafted 2026-11-01; reshaped 2026-11-02 to compare candidate text formats before choosing one (see [Candidate formats](#candidate-formats)). Nothing is built. Baseline 2026-11-02: 4197 passed, 9 skipped (436 suites passed, 1 skipped). **Next step: Slice 0** (worked scenes in every candidate format, no code). SP-1 to SP-6 were decided 2026-11-02; Slice 0 pins their details (slug spelling, relation phrases) and checks SP-2's direction against the scenes. An implementation plan, per [`taskPlanning/AGENT.md`](../../../../AGENT.md): the deliverable is code, and its open questions each belong to a slice. This is a first iteration, written expecting to surface further questions; collect them in [Questions this iteration should surface](#questions-this-iteration-should-surface) rather than growing the slices.

## Goal

Every LLM rung still to be built (the orchestration loop in the [iteration ladder's proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25), the deferred adjudication tier's judge, the synthesis fallback) has to reason about what the actor can reach. The `ludicCache` holds that, but in a shape that is very bad for semantic reasoning. Membership is node-list position, not an edge. A hosting kind sits on a cover entry, not on a relation. Where a thing sits is a walk over `fromHostPresences`. One tie is three edges (`Custom`, the `SecuredTo` it justifies, and the `Justifies` between them). Handing the model JSON makes it reconstruct those facts before it can reason, and switches register between ids and meaning on every line.

**The reader the scene is designed for is the orchestration loop** (user, 2026-11-02). There, nothing is identified yet: the loop identifies things itself (Identify is one of its tools), reasoning over the scene and naming things by handle. The adjudication judge (CA-1's prose) is a secondary consumer: it reads an attempt the deterministic pipeline already grounded, so it adds a referents section the loop doesn't have. Design choices here answer to the loop's needs first.

This plan builds an **output-only projection** from the actor's cache into text an LLM reads as a scene:

```text
Contents of the Lab:
- [pole1] Pole (a tarred mooring post)
- [rope1] Rope (a coil of thick hemp rope), tied to [pole1]
```

It has two layers:

- **A scene model:** structured data built from the actor's cache. It holds the described things, their handles, where each is placed, and the relations between them as phrases. Beside it sits a **handle table** mapping each handle to an id, which is never shown to the model.
- **A text renderer** over the scene model. Several candidate renderers are built first and compared by a hands-on Bedrock probe (Slice 3); the losers are deleted and one renderer ships.

"Output-only" means the model is never parsed back into the cache. The handle table is how a later reader's output names things again (see SP-1).

**Payoff, at the observable output:** in dev, a player types `/test scene` and receives, as an OOC message, the rendered scene of their own actor's cache. That covers the room's contents, nested, with relations in words, and their held inventory. The integration test ends at that published message, not at the scene model. A second, smaller payoff is that `CommandAttempt.renderProse`'s room-context section is filled by the renderer instead of its string-list stub (Slice 5).

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
- **The prose this feeds:** `CommandAttempt.renderProse(roomContext?)` ([`commandAttempt/index.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/index.ts)). **It has no production caller.** Its room-context section is a stub (`RoomContextSection`: `hostShortName`, `nodes: string[]`, `edges: string[]`). Its referents section prints the raw id (`- refKey -> OBJECT#..., shortName`), which is the same register problem in miniature. The six-section format and the "context comes from a scope function" rule are [CA-1 in the command attempt plan](AGENT.commandAttemptPhase.planning.md#open-decisions-implementation--plan-only). CA-1's first scope function is "the whole room's structure from `ludicCache` (short names, edges in words), with glosses for the referents only". That prose is the judge's (an already-grounded attempt), written before the orchestration loop was proposed, when room context was a string-list stub. Slice 5 supersedes its sections 2 and 4 (see there); the rest of CA-1 stands.
- **Not in the cache:**
  - Exits: the room's exits come from `roomExitContext`, and exits are not cache edges.
  - Bystanders: present characters other than the actor are in the characters row, not the cache.
  - Features: the catalog lists objects only.
- **A precedent for the probe:** embedding calibration ([`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md)) is operator tooling reached by direct Lambda invoke only (AWS console, CLI or SDK), routed on `event.type` by an early return in [`app.ts`](../../../../../lambda/ephemera/app.ts) through [`routeCalibrationEvent.ts`](../../../../../lambda/ephemera/calibration/routeCalibrationEvent.ts). It is read-only and IAM-gated, and player sessions cannot reach it; its corpus is compiled into the bundle.
- **A harness precedent for the payoff:** `/test parse` ([`parseObjectManipulationParseTestSlash.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/parseObjectManipulationParseTestSlash.ts), handled in [`runObjectManipulationParseHarness.ts`](../../../../../lambda/ephemera/dataSource/actions/actionHandlers/runObjectManipulationParseHarness.ts)) returns one dev-only OOC report. Per the actions contract ("The test harnesses stay OOC"), a harness reply is not a command outcome.
- **Fixtures:** [`actorCacheTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/actorCacheTestFixtures.ts) (Kitchen, table, lamp, bag, coin, rope, leash, actor, another character).

## Relationship to other plans

- **Concept** (shipped and retired 2026-11-01; vocabulary in [positions `AGENT.concepts.md` --- Concept](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#concept), rules in the [positions contract](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#component-updated-containment-population-cache-time)): **SP-2's direction rests on it.** It separates things present only by association from physical things, and its physical-forest invariant is what lets this plan render physical placement as a forest with Concepts as references. If the kind is ever withdrawn, SP-2's direction goes with it.

- **Iteration ladder** ([`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md)): this is foundation for the proposal's step 3 (the orchestration loop) and for layer 2 (fallbacks as attempt consumers). It builds no LLM call on any player path. Its one Bedrock call is the operator-only format probe (SP-8), which is invoked by hand and makes one call per prompt, never a loop.
- **Command attempt phase** ([`AGENT.commandAttemptPhase.planning.md`](AGENT.commandAttemptPhase.planning.md)): the judge's prose (CA-1) is this plan's first built consumer, though a secondary one (Slice 5): the scene replaces CA-1's section 4 and reduces section 2 to phrase-to-handle. CA-1's row records the supersession.
- **Attention history** ([`positions/AGENT.attentionHistory.planning.md`](../positions/AGENT.attentionHistory.planning.md)): it owns what the cache holds; this plan only renders what it holds. If attention scoping narrows the cache, the scene narrows with it at no cost to this plan.
- **StableRefs** ([`positions/AGENT.stableRefs.planning.md`](../positions/AGENT.stableRefs.planning.md)): SR-5 asks whether ref variables share a namespace with `stableRefKey`. A scene handle is a third kind of name for a thing, so SP-1 should be decided knowing that row, not in isolation.
- **Edge abstractions** ([`positions/AGENT.edgeAbstractions.planning.md`](../positions/AGENT.edgeAbstractions.planning.md)): what a `Justifies` means at another scale. SP-3 collapses today's single-graph `Justifies` into a phrase and should not assume more than that.

## Getting Started

1. **Durability framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. **The graph model, before reading any cache code:** the primer [`positions/AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), all of sections 1--5. Its running example (Lab, box, cup, spring, contraption, hook, a rope across two rooms) is one of Slice 0's scenes. Edge identity (`edgeId`, `chainId`, legs) is defined in [`AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) (LG-10), not in the primer.
3. **The cache's rules:** [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild) ("Ludic cache staleness and rebuild", including "A command reads the actor's cache"), and `SecuredTo` / `Justifies` under its relation kinds.
4. **Who reads the scene, and why:** [actions `AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (`CommandAttempt`, especially the six-section prose and `gloss`), and the ladder's [orchestration-loop proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25).
5. **Code to read:** `actorCache.ts`, `catalogHandles.ts`, `objectViews.ts`, `roomObjectContents.ts`, `commandAttempt/index.ts` (`renderProse`). Before Slice 3, also [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) and `routeCalibrationEvent.ts` (the probe's precedent).
6. **Testing (command authority):** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Run from `lambda/ephemera/` with `npm run test` (not `npm test`). `npx tsc --noEmit` is not sufficient, because `*.integration.test.ts` files sit outside `tsconfig`. ts-jest here type-checks tests.
7. **Baseline (must pass before edits):** from `lambda/ephemera/`, `npm run test -- --watchAll=false`. Record the pass count at Slice 0.

## Candidate formats

**Why compare (user, 2026-11-02).** English is much closer than JSON to the register the reader reasons in, but it is bad at nesting. More precisely, it is bad at branching. A right-branching chain reads easily ("the cup on the saucer on the table in the tavern"). A fan of siblings inside another fan does not: after a subtree, prose has no clean way to say which level it has returned to. Indentation is the usual patch. Whether an LLM reads indentation reliably is a hypothesis, not a fact. Finding a line's parent from indentation means comparing leading whitespace, which is a counting task over tokens that split inconsistently. Matching an identical handle string earlier in the context is what attention does best. So the candidates differ in which cue carries the structure: whitespace, a lexical parent clause, or neither.

The worked scene used below: a tavern (with gloss) as the room; a table holding a saucer with a cup on it, and a candle; the actor holding a hammer. The candle is there so every format has to climb back out of a subtree.

**A. Indented tree.** Hosting kinds are carried by indentation alone.

```text
The Tavern: A low-beamed common room, smoky from the hearth.
Contents of the Tavern:
- [table1] Table
  - [saucer1] Saucer
    - [cup1] Cup
  - [candle1] Candle
You are holding:
- [hammer1] Hammer
```

**D. Indented tree with a parent clause.** Every nested line names its parent by handle, with the hosting kind in words. The indentation is a visual aid; the clause carries the meaning.

```text
- [table1] Table, in the Tavern
  - [saucer1] Saucer, on [table1]
    - [cup1] Cup, on [saucer1]
  - [candle1] Candle, on [table1]
```

**Blocks.** Shape-aware, with no indentation. The renderer analyses the physical forest and uses English's two native shapes: a host with children is a block ("On [table1]: ..."); a child whose contents form a chain (one thing per level) stays inline as a phrase read downward from the child; a child that branches (two or more things) is promoted to its own block and marked "(see below)" in its parent's list. The deepest structure is one list plus inline phrases, and every jump between blocks is a handle match. The number of blocks grows with how much the scene branches, not with its depth.

```text
In the Tavern: [table1] Table.
On [table1]: [saucer1] Saucer, with [cup1] Cup on it; [candle1] Candle.
You are holding: [hammer1] Hammer.

(with a tray holding a teapot and a jug also on the table)
On [table1]: [saucer1] Saucer, with [cup1] Cup on it; [candle1] Candle; [tray1] Tray (see below).
On [tray1]: [teapot1] Teapot; [jug1] Jug.
```

Known costs of Blocks: the render's shape flips when the scene changes (a spoon put on the saucer promotes it to a block), so across a loop's turns one object can be rendered two ways, though its handle is stable; and each hosting kind needs chain wording ("with X on it", "with X in it", "with X as a part").

**Held constant across candidates:** handles (SP-1), relation wording (SP-3), glosses, the room heading, and sections outside the cache (SP-4). Only the representation of nesting varies, so the probe measures that alone. The shared wording is pinned in the [corpus conventions](AGENT.sceneProjection.corpus.temp.md#conventions) (Slice 0); the examples above predate it in small ways (Blocks' room line gains "(see below)" for a promoted table).

**Not candidates:** a flat line per thing giving its full chain to the room (redundant at depth, and "what moves with X" becomes a scan over every line); and guided-tour prose (fails exactly at branching; at most a summary on top of another format).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

Each row is decided against Slice 0's worked scenes, not in the abstract. Where a recommendation is given it is a starting point for Slice 0, not a decision.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SP-1 | **Handles: form, uniqueness and lifetime.** What the model sees in place of an id, and how its output names a thing again. Options include a name-derived slug (`[cup1]`), the bare short name made unique ("Cup", "Cup (2)"), or numbers. Also: are handles stable only within one render, or across the turns of one command (the loop's later turns must mean the same cup), or across commands? And how do they relate to `stableRefKey` (a phrase's referent) and to SR-5's ref variables? **Decided (user, 2026-11-02):** a name-derived slug (`[cup1]`), unique within one render, built deterministically from cache order so that one cache always renders the same handles. The handle table is part of the scene model's result. **Spelling (user, 2026-11-02):** lowercase; drop apostrophes; each other run of non-alphanumerics becomes one hyphen; trim; append a counter, always (`[cup1]`), after a hyphen when the slug ends in a digit (`[room-101-1]`); a node with no `shortName` takes its tag (`[object1]`). Counters follow a depth-first pre-order of the scene model (room contents, then Concepts, then held), siblings in cover order; a thing is numbered where it is placed, not where first mentioned. Details: [corpus conventions](AGENT.sceneProjection.corpus.temp.md#handles-sp-1). Lifetime beyond one render, and the tie to `stableRefKey` and SR-5, stay with [Grounding a handle back](#questions-this-iteration-should-surface). | 1 | Decided |
| SP-2 | **Placement in a DAG.** **Rests on the shipped [Concept kind](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#concept)** (user, 2026-11-01): if it is withdrawn, this direction goes with it. *Direction:* physical placement is a forest over hosts (the physical-forest invariant, [positions contract](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#component-updated-containment-population-cache-time): each binding's physical parents all belong to one host; relied on here, not enforced at write time), nested by indentation with no back-references among physical placements. A binding with several parents on one host (a join) renders once, under that host. An object with several bindings (a spread rope or plank) appears once per binding, worded with the `readingsOf` / `readingLabel` vocabulary ("one end on [sawhorse1], the other on [sawhorse2]"). Concepts are not placed; they are rendered as references from their associated members. (The room holds a binding of each Concept with a member there, so the renderer finds it in the room's row and leaves it out of the physical forest.) Every contained thing is nested; how deep chains are laid out is a format question ([Candidate formats](#candidate-formats)), not a placement one. **Decided (user, 2026-11-02)** as this direction, resting on the Concept kind as above. Slice 0 checks it against the scenes, including the thing placed only through associations ([questions](#questions-this-iteration-should-surface)). **Slice 0 result (2026-11-02, awaiting user review):** the invariant holds on all 13 scenes. One refinement: "once per binding" means once per *physical* binding. Bindings with no physical parent (association only) render no line of their own; a thing with no physical binding at all (the steamer chest, [corpus scene 13](AGENT.sceneProjection.corpus.temp.md#13-the-steamer-chest-placed-only-through-associations)) renders once in the room's contents, with no placement clause, all its associations, and the union of its bindings' covers as contents. | 1 | Decided |
| SP-3 | **Relations as phrases.** What the scene model carries for each edge, and the wording:<br>- a `Custom` label, as given ("tied to");<br>- `SecuredTo` plus its `Justifies` folded into the manner edge they support ("tied to [pole1], secured");<br>- `ConnectedTo` inside one whole: no phrase of its own; the whole's placement wording carries it (SP-2's "one end on [sawhorse1], the other on [sawhorse2]");<br>- an open leg ("tied to something inside [box1]");<br>- direction, read as English about the subject, as the primer does.<br>The **structure** (what the model holds per relation) blocks Slice 1; the **wording** blocks Slice 2, and is one wording shared by every candidate renderer so the probe compares nesting alone ([Candidate formats](#candidate-formats)). **Decided (user, 2026-11-02)** as listed; Slice 0's tie, bare-`Custom` and open-leg scenes pin the exact phrases. **Pinned in Slice 0 (2026-11-02, awaiting user review):** tie `L [x], secured`; bare `Custom` the label as given; bare `SecuredTo` `secured to [x]`; open leg by its far owner (`something inside [x]`, `something someone else is holding`, `something in another room`); association `associated with [x]`; same-phrase objects joined with "and"; a spread object's other bindings as a note `(also on [x])` / `(also held by you)` / `(also in another room)`. Full table: [corpus conventions](AGENT.sceneProjection.corpus.temp.md#relation-phrases-sp-3). | 1 | Decided |
| SP-4 | **What sits outside the cache in this iteration.** The room itself (named as the heading), its exits (from `roomExitContext`; navigation is a Plan attempt, so a reader may need them), bystanders (characters row), and features (not in the catalog). *Recommended start:* the room heading and held inventory are in; exits are in as their own section if the harness can read them cheaply (the command world already loads them); bystanders and features are out, recorded under the questions below. **Decided (user, 2026-11-02)** as the recommended start, **with an obligation: features must come into the scene in a later iteration.** This iteration leaves them out only because the catalog lists objects alone; a scene without the room's features is not the finished product. Slice 6 hands the obligation to an owner (see [Bystanders and features](#questions-this-iteration-should-surface)). | 1 | Decided |
| SP-5 | **Where the two layers live.** *Recommended start:* the scene model is an accessor on `ActorLudicCache` (positions, beside `entries`), so the boundary-type rule holds and nothing outside sees cache shapes. The text renderers are actions-side beside `commandAttempt/` (`actions/sceneProse/` or similar), one module per candidate format until SP-7 decides, since rendering for an LLM reader is the attempt prose's concern. Placement helpers now in `actions/objectViews.ts` are reused, not copied. **The scene model is format-neutral** (user, 2026-11-02): it carries the forest, hosting kinds, handles and relations, and no rendering decision. Shape analysis (chain against fan) is the Blocks renderer's own, so every candidate renders from the same input. **Decided (user, 2026-11-02)** as the recommended start. | 1 | Decided |
| SP-6 | **The payoff surface.** A `/test scene` harness (the recommendation, following `/test parse`): routed by the slash prefix with no Bedrock, it builds the actor's cache through `loadCommandWorld`'s read and posts one OOC report holding the rendered scene and, below it, the handle table. **Until SP-7 decides, it takes a format argument** (`/test scene A`, `/test scene D`, `/test scene blocks`); after, the argument is removed with the losing renderers. The alternative is to pin the payoff on `renderProse` alone, but that has no production caller, so no player could see it. **Decided (user, 2026-11-02):** `/test scene`. | 4 | Decided |
| SP-7 | **Which candidate format ships** ([Candidate formats](#candidate-formats)): A, D or Blocks, or a variant the probe suggests. Decided by the user from hand-run probe batches (Slice 3), not in the abstract. On deciding: the other renderers, their golden tests, their Slice 0 renders and the format arguments (SP-6, SP-8) are deleted; we are pre-rollout, so no versioned renderers stay behind. | 5 | Open |
| SP-8 | **The format probe** (user, 2026-11-02: hands-on Bedrock only; no script or opt-in test that calls Bedrock, since a loop there gets expensive fast). A direct Lambda invoke, run from the console's Test tab, following the calibration precedent. Proposed payloads:<br>- `{ "type": "SceneReasoningFixtures" }`: no Bedrock. Lists the fixture names and, for each, the scene rendered in every format and its question set. This is how to see exactly what a batch would send before paying for it.<br>- `{ "type": "SceneReasoningProbe", "scene": { "fixture": "tavern" }, "formats": ["A", "D", "blocks"], "questions": [...], "repeats": 1 }`: one Bedrock call per (format, question, repeat), each a single prompt with no follow-up turn. `questions` is optional; leaving it out runs the fixture's own set. `scene` may instead be `{ "characterId": "CHARACTER#..." }`, which builds that character's actor cache from live dev data (reads only), for a one-off look at a real room; such a scene has no expected answers.<br>- **Returns**, per call: the rendered scene, the question, the model's answer and, for a fixture question, the expected answer with a match flag. The flag is a reading aid; the user judges.<br>**Fixtures are a closed, named set compiled into the bundle**, one definition per scene: the Slice 0 cache setups, imported by the Slice 1 model tests, the Slice 2 golden tests and the probe alike, so the scene the model reasons about is the scene the golden tests pin. Each fixture carries its question set, typed (for example *what is X on*, *what moves if X is taken*, *list everything on X*, *what is tied to X*), with expected answers computed from the scene model. An unknown fixture name fails before any Bedrock call and lists the valid names. A new situation found in dev becomes a fixture in code, never a payload-defined scene.<br>**Open:**<br>- **Home.** *Recommended:* a sibling of `objectMatch/` under `calibration/`, reusing its router, with [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md) widened from embedding calibration to operator Bedrock tooling. The alternative is its own top-level folder and a second early return in `app.ts`.<br>- **Call cap.** A hard limit on formats x questions x repeats per invoke, refused before any call when exceeded. The number is set when it is built.<br>- **Model.** Which Bedrock model answers. It should be the model the orchestration loop will use, which the ladder's proposal leaves open ("Model choice"); a `modelId` field with a default is the likely shape.<br>- **Prompt.** One fixed frame around the scene and the question, shared by every format; its wording is part of Slice 3.<br>- **Fixture module home.** It must be a module the production bundle can import. `actorCacheTestFixtures.ts` builds graphs through `ludicGraph/testFixtures` and is named as test-only, so either the scene fixtures get a production-named sibling (holding cache data directly, or graphs folded at probe time) or those helpers are renamed out of test status. | 3 | Open |

## Questions this iteration should surface

Not Open rows: none of these gates a slice. Each is recorded when Slice 0 or a later slice meets it, with the scene that raised it, and is handed to an owner in Slice 6 (an existing plan, a new plan, or a shelf in a durable doc).

- **Scope.** Is the whole actor's cache the right context, or a part scoped to the command (the things Identify's pools touched, plus their neighbours)? This iteration renders everything. The scope function in CA-1 is where a narrower scope goes, and attention history decides what the cache holds at all.
- **Size.** Token count of a rendered scene for the Coyote rooms at their placement cap. Measure in Slice 4; it decides nothing until a reader has a budget. The probe's renders give a per-format count for free, which may bear on SP-7 if the formats differ much.
- **Shape stability across turns.** If SP-1 makes handles last across a command's loop turns and SP-7 picks Blocks, one object can render as an inline chain on one turn and a block on the next. Whether that confuses a multi-turn reader is a question the single-prompt probe cannot answer.
- **Handles for the room and the actor.** If a reader's output must name "the hammer you hold" or "put it on the floor", the room and the actor need handles, and "you" cannot be the actor's only name. Belongs with SP-1.
- **Grounding a handle back.** How a reader's output names a handle so that it becomes a `ReferentAssignment` entry, or a `graphNode` referent, without breaking the freeze rule (actions contract, "Plan stays blind to the world, or its output is frozen whole").
- **The hand-up.** The loop's first turn needs the fills, readings, pools and abstain reasons beside the scene. Today `compileAttemptsFromSkeleton` returns one `Abstain { reason }`. That is a separate piece of foundation, not this plan's.
- **Unnamed things.** A node with no `shortName` is left out of the catalog, but it can still be one end of a relation or a container. *Slice 0 renders every unnamed node* as `[object1] (unnamed object)` (corpus scene 11); whether an unnamed leaf, neither container nor relation end, should be dropped is still open.
- **State.** The prose's State section overrides the gloss. Where the scene would carry a state override once a state axis exists. One case to meet then: things inside a closed container may need to be hidden or marked, since the actor may not perceive them.
- **Hosting kinds `Held`, `PartOf`, `SectionOf` in words**, and whether `readingLabel`'s "on the X" for every object parent should take the scene's wording (one fix for both).
- **Bystanders and features** as scene content. SP-4 leaves both out of this iteration. **Features are obligated** (user, 2026-11-02): Slice 6 must hand them to an owner that will put them in the scene (a new plan or a row in an existing one), not merely shelve them. Bystanders are a plain question.
- **A thing placed only through associations** (handed on from the Concept kind, 2026-11-01). PR-C5 re-expressed (`presenceParentSets.concepts.payoff.test.ts`) leaves the steamer chest with no physical binding in the attic: it is there only as a member of Inherited Furniture and of Boardgames. A physical-forest render reaches it only as an associate. Either that is right (the fiction never placed the chest on the floor), or the case wants a physical binding too. Meet it under SP-2.
- **Wording for associations** (handed on from the Concept kind): "part of", "associated with", or the Concept's own phrasing. It belongs with SP-3's wording. *Slice 0 uses "associated with"* (corpus scenes 5 and 13): "one of" fits a collection but not a mechanism like the contraption, and "part of" collides with `PartOf`. The section heading is `Concepts here:`, which may read as jargon to a model.
- **Association-only placement in the room's lists** (corpus scene 13). The steamer chest sits under "Contents of the Attic" (Blocks: "In the Attic:"), which implies a placement nothing records. The alternative is a separate section (`Here by association:`), which is honest but splits "what's in the attic". Also open: whether the union of covers is right once covers differ per association (PR-C5 beat 1, unmodelled).
- **A join under a spread host** (corpus scene 10). SP-2 renders a join once under its host, but a spread host has one line per binding: which line holds it (the forest test's candle under a cloth draped over table and chair)?
- **Mixed hosting kinds under one host in Blocks.** A block header names one kind (`In [box1]:`). A box with a lid `PartOf` it and a cup `In` it needs two headers or a per-item kind. No scene has this yet.
- **A spread binding under an unrendered host** (corpus scene 5). The rope's far end is in the cache under a binding whose parent (the Hall) is not rendered, so only the spread note `(also in another room)` mentions it. Enough for "what is the far end tied to"?
- **`Custom` labels that read as verb phrases** (corpus scene 6, "is near"). Labels are printed as given after a comma; "Lamp, is near [rope1]" is awkward. A normalisation, if wanted, is SP-3 wording.
- **Shared fixtures are not all scene content** (corpus scene 6). `actorCacheGraphs` carries a `rope -ConnectedTo-> coin` crossing to exercise composition; it joins two separate wholes, which the contract never allows `ConnectedTo` to do, so the corpus drops it. Slice 1's scene fixtures should not import that edge.
- **Inbound links.** CA-1's row links here since 2026-11-02 (its sections 2 and 4 are superseded by Slice 5). The ladder's orchestration-loop proposal does not yet (user, 2026-11-01: hold off and see what falls out of the questions). Slice 6 is obligated to add both if nobody has. Whether to add them earlier, and in what form, stays open while the questions are discussed.

## Progress

| Slice | State |
| --- | --- |
| 0. Worked scenes in every candidate format, with question sets; pin SP-1's slugs and SP-3's phrases, check SP-2 (no code) | Corpus written 2026-11-02 ([`AGENT.sceneProjection.corpus.temp.md`](AGENT.sceneProjection.corpus.temp.md)); awaiting user review |
| 1. Scene model and handle table, built from `ActorLudicCache` (format-neutral) | |
| 2. Candidate text renderers (A, D, Blocks) | |
| 3. Format probe (console invoke); user runs batches; decide SP-7 | |
| 4. Payoff: `/test scene` | |
| 5. First built consumer (secondary): the judge's prose, CA-1 sections 2 and 4 | |
| 6. Durable docs, spin-off handoff, plan deleted | |

## Recommended order

Pending work is `[ ]` and completed work is `[X]`; mark each nested line `[X]` as it is done.

0. [ ] **Slice 0: worked scenes (no code).**
   - [X] Record the baseline pass count (Getting Started step 7): 4197 passed, 9 skipped (2026-11-02).
   - [X] Write each scene below as a small cache setup, its hand-written expected render **in each candidate format** (A, D, Blocks), and its question set with expected answers (SP-8). Keep them in a temporary sibling, [`AGENT.sceneProjection.corpus.temp.md`](AGENT.sceneProjection.corpus.temp.md), deleted when Slice 2's golden tests pin the same renders and the fixtures hold the same questions.
     - [X] The tavern ([Candidate formats](#candidate-formats)): the room with a gloss; a table holding a saucer with a cup on it, and a candle; the actor holding a hammer.
     - [X] A sibling fan: a table set with a fork, a knife, a plate and a cup.
     - [X] A branch inside a branch: the tavern table also holding a tray with a teapot and a jug (Blocks promotes the tray).
     - [X] A deep chain, four or more levels (room, table, box, bag, coin).
     - [X] The primer's running example, from the Lab: box with cup and spring, contraption whose mechanism is the same spring, hook, rope tied to the hook and to the cup inside the box (a joined crossing), the rope's other end in the Hall.
     - [X] Held inventory: a bag in hand holding a coin; a rope with one end in hand and one end on the floor (half-held, so `catalogScope` is `room`).
     - [X] Two objects with the same short name (two cups), one on a table and one in the room.
     - [X] A tie (`Custom` plus `SecuredTo` plus `Justifies`) next to a bare `Custom` edge with no `SecuredTo`, and a bare `SecuredTo` whose `Custom` was dissolved (added 2026-11-02).
     - [X] An open leg: an edge whose far end the cache does not hold.
     - [X] A draped cloth with a part on the table and a part in the room.
     - [X] A node with no `shortName` that is a container or a relation end.
     - [X] An empty room with the actor holding nothing.
     - [X] The steamer chest (added 2026-11-02): PR-C5's world, the chest present only through two Concepts, the backgammon set joined under both chest bindings.
   - [X] Decide SP-1 to SP-6 (user, 2026-11-02, as recommended; SP-4 with the features obligation).
   - [ ] Pin SP-1's slug spelling and SP-3's phrases against the scenes; write the scenes' expected renders under SP-2's direction, and check that each holds the physical-forest invariant (add any that should be pinned to `physicalForest.invariant.test.ts`). Record each decision in its row, and add anything new to [Questions this iteration should surface](#questions-this-iteration-should-surface). *Done 2026-11-02, awaiting user review:* rows SP-1 to SP-3 updated; no scene needs a new pin in `physicalForest.invariant.test.ts` (each shape is already one of its cases).
1. [ ] **Slice 1: the scene model.**
   - [ ] Define the scene model type and the handle table (shape from SP-1 to SP-4), with no cache types in its surface and no rendering decision in it (SP-5: format-neutral).
   - [ ] The scene fixtures as one production-importable module (SP-8, "Fixture module home"), each named, with its typed question set and expected answers computed from the scene model.
   - [ ] Build it from the actor's cache (SP-5's home): a forward walk over covers from the room, then the actor; placements per SP-2; relations per SP-3's structure.
   - [ ] Unit tests over cache fixtures for every Slice 0 scene, asserting on the model (structure, not prose). Extend `actorCacheTestFixtures.ts` where a scene needs it.
2. [ ] **Slice 2: the candidate text renderers.**
   - [ ] One pure function per candidate format (A, D, Blocks) from the scene model to text, all with SP-3's one wording.
   - [ ] Golden tests: every Slice 0 scene renders exactly its hand-written text in each format. Then delete the corpus temp file, moving any reasoning worth keeping into this plan's rows.
3. [ ] **Slice 3: the format probe** (SP-8; decides SP-7).
   - [ ] Decide SP-8's open items (home, call cap, model, prompt frame).
   - [ ] The `SceneReasoningFixtures` payload (no Bedrock) and the `SceneReasoningProbe` payload (fixture or `characterId` scene, formats, optional questions, repeats), routed by an early return on `event.type`; the cap and unknown-fixture checks refuse before any Bedrock call.
   - [ ] Unit tests with Bedrock mocked: routing, the cap, unknown fixture names, expected answers and match flags. No test calls Bedrock.
   - [ ] Console payloads documented beside calibration's, with the access boundary (direct invoke only, read-only, worst case is Bedrock cost).
   - [ ] **User:** run batches by hand in dev and decide SP-7. Record the decision and the evidence in SP-7's row.
   - [ ] Delete the losing renderers, their golden tests and the format arguments.
4. [ ] **Slice 4: payoff, `/test scene`** (SP-6).
   - [ ] Slash prefix and tail parse beside `/test parse`'s (no Bedrock), a harness handler that reads the actor's cache as `loadCommandWorld` does, and one OOC report with the render and the handle table.
   - [ ] Integration test from a real fold (leaf reads faked, per the house pattern) to the published OOC message, asserting on the message text.
   - [ ] Smoke-test in dev on a Coyote room at a realistic placement count; record the token size (questions section, "Size").
5. [ ] **Slice 5: first built consumer, the judge's attempt prose** (CA-1 sections 2 and 4; secondary to the loop, see [Goal](#goal)).
   - [ ] Section 4: `renderProse`'s room context is the rendered scene, every gloss included, in place of `RoomContextSection`'s string lists; the CA-1 scope function is "the whole actor's cache". CA-1's "glosses for the referents only" goes: the referent's gloss is already on its scene line.
   - [ ] Section 2: the referents section becomes phrase to handle only (`- "the rope" -> [rope1]`), with no raw id and no gloss, since both live in the scene. Update `commandAttempt/index.test.ts` to match.
   - [ ] `CommandAttemptReferent` drops what section 2 no longer prints, if nothing else reads it (check callers first).
6. [ ] **Slice 6: durable docs and handoff.**
   - [ ] Rules to `positions/AGENT.contract.md` (the accessor, if a rule-bearing boundary) and the actions contract (handles; the scene uses reasoning names, never display labels); code map to both `AGENT.implementation.md` files; vocabulary (scene, handle) to actions `AGENT.concepts.md` only if it is new vocabulary a reader needs.
   - [ ] Hand each entry under [Questions this iteration should surface](#questions-this-iteration-should-surface) to an owner: an existing plan's row, a new plan, or a shelf in a durable doc. **Features (SP-4) must go to a plan that will build them, not to a shelf.**
   - [ ] **Obligated, if not done earlier:** link this work from the ladder's [orchestration-loop proposal](AGENT.objectManipulationIterations.planning.md#proposal-deterministic-first-then-an-orchestration-loop-2026-10-25), pointing at the shipped renderer, and update CA-1's supersession note to point at the shipped code (CA-1 links here since 2026-11-02). Whether to link earlier is under [Questions this iteration should surface](#questions-this-iteration-should-surface), "Inbound links".
   - [ ] Grep for inbound links to this file, then delete it.

## Verification

From `lambda/ephemera/`:

- Full suite (every slice): `npm run test -- --watchAll=false`. Compare against the Slice 0 baseline count.
- After changing a shared field to required: `npm run test -- --clearCache` once before trusting a green run (see the testing doc).
- Slice 1--2 focus: `npm run test dataSource/positions/ludicCache/actorCache.test.ts` and the renderers' test files (paths set by SP-5).
- Slice 3: the probe's unit tests by path (Bedrock mocked). Then, by hand in the dev console: `{ "type": "SceneReasoningFixtures" }` first (no Bedrock) to check what a batch would send, then small `SceneReasoningProbe` batches under the cap.
- Slice 4: the `/test scene` integration test by path, then the dev smoke test.
- Before deleting the plan: `grep -rn "sceneProjection" --include='*.md' .` from the repo root.
