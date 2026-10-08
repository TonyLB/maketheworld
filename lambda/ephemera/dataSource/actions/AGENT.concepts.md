# `mtw.ephemera.actions` --- object manipulation pipeline concepts

This file records **mental models and vocabulary** for how a player command becomes KR-grounded, legal instruction execution in the object-manipulation pipeline (take / drop / relate / contain / describe). Rules: [`AGENT.contract.md`](./AGENT.contract.md). Code map: [`AGENT.implementation.md`](./AGENT.implementation.md). Other links: [Navigation](#navigation).

**Status: Shipped on every object-manipulation route.** Which module realizes each stage, per route, is in [`AGENT.implementation.md`](./AGENT.implementation.md#object-manipulation-pipeline-route-wiring).

---

## Parse (upstream stage)

**Parse** turns raw player language into a **command skeleton** --- an ordered sequence of exactly two token kinds, `{ type: 'objectSpan', span: string, stableRefKey: string } | { type: 'text', text: string }`. It is the tokenizer that feeds the three jobs below; it does **not** resolve ids (Identify's job) or decide which attempt applies (Plan's job) --- it only segments referents out from surrounding text.

**`stableRefKey`** is a per-occurrence key stamped onto each `objectSpan` token by deterministic code, **never by the LLM**. It exists so two identical-text spans at different positions ("put bench on bench," two different benches) stay distinguishable by occurrence rather than collapsing on span text --- downstream Grounding keys resolved candidates on it, not on text (see [Synthesize's three sub-roles](#synthesizes-three-sub-roles-grounding-expansion-and-validation)). Keys are derived from the span (camelCased, `Ref`-suffixed: `"big bag"` -> `bigBagRef`; duplicates numbered, `benchRef1`/`benchRef2`), which aids debugging while the field *name* keeps the "occurrence, not object" signal.

## Three conceptual jobs

Every object-manipulation command, once **Parse** has produced the command skeleton (`objectSpan` data), decomposes into three independent jobs:

| Job | Question it answers | Needs KR (graph/catalog) state? |
| --- | --- | --- |
| **Identify** | Which in-world id(s) does this `objectSpan` refer to, given current position/relationship context? | Yes |
| **Plan** | Which ungrounded attempts does this verb/frame admit? An attempt is a list of actions over referents, with no ids. (e.g. "seize" admits a `transferMembership` attempt) | **No** --- decidable from verb/frame alone |
| **Synthesize** | Given a chosen plan step *and* KR grounding together, what is the complete, concrete, legal instruction set? (dissolve existing relationships if needed, express a relation across shard boundaries if needed, validate legality) --- splits into **Grounding**, **Expansion**, and **Validation** sub-roles, see below | Yes --- needs **both** Identify's and Plan's output simultaneously |

**Identify and Plan do not depend on each other's output.** Nothing about inferring "this utterance needs a `transferMembership`-shaped primitive" requires knowing *which* id the span resolves to, or where that object currently sits in the graph --- it only needs the verb frame. The two jobs are independent and can run in parallel (or even be reasoned about/cached independently of any particular game state). Only **Synthesize** is a genuine join: completing a grounded instruction (deciding whether a relation must dissolve, deciding whether to defer for interaction assessment, choosing where a relation's legs go) is inherently a function of *both* the plan step's shape *and* the live KR graph. Plan never needs KR grounding in hand.

### Pipeline shape

The jobs compose into one shape on every route:

**a set of plans × a set of identity candidates -> ground -> expand -> adjudicate -> validate -> select**

1. **Plan** proposes a set of ungrounded attempts; **Identify** proposes a candidate pool per span. Neither reads the other's output.
2. Their **cross-product** is the candidate space: each candidate pairs one attempt with one identity per referent. **Enumerate** forms it, before Grounding, over the referents of the attempt's actions (a candidate pool per referent), so an attempt is free to name as many referents as it has, not just one.
3. **Synthesize** runs per candidate: Grounding, then Expansion (completing the candidate), then Validation, giving `legal`, `defer` or `illegal` (see [Synthesize's three sub-roles](#synthesizes-three-sub-roles-grounding-expansion-and-validation)). **Adjudicate sits between Expansion and Validation**: it judges the challenges Expansion attached to the candidate's attempt (see [`CommandAttempt`](#commandattempt)), so Validation checks an adjudicated candidate. Routes differ only as **producers**: a route's producer runs Identify, Enumerate and Grounding over its attempts, and one **shared stage** expands, adjudicates, validates and selects, whichever producer ran.
4. **Selection** chooses among the survivors. It is not part of Synthesize: Synthesize judges each candidate alone, and Selection compares them. It ranks `legal` candidates by confidence against a floor and a margin, resolving, asking the player (**Consult**) or abstaining. With no `legal` candidate, the top `defer` goes to the deferred adjudication tier, which may judge it or abstain. A candidate's confidence over several referents is bounded by its weakest referent.

**The attempt side is a set.** Plan returns every attempt its templates admit, and an LLM fallback may propose several ranked attempts, or `(identity, attempt)` pairs directly. Each candidate carries its own attempt, and the producer forms one candidate per attempt per joint identity assignment, so a multi-attempt skeleton needs no change to the shared stage.

**Object and Character referents don't need structurally different resolution.** `EphemeraLudicGraph` nodes carry a `tag` field (`'Object'` | `'Character'`) under one node mechanism, filtered/removed identically --- so "which graph node does this span refer to" is one job regardless of referent kind, not two. Candidate ids are typed as a **thing** (`EphemeraThingId`: Object, Character or Feature); what limits which kinds appear is the catalog, not the resolution mechanism.

**Plan generalizes beyond object manipulation; Identify and Synthesize do not, by deliberate choice.** Plan's dispatch spans every command family. Identify and Synthesize stay object-manipulation-scoped because no other family needs KR-grounded referent resolution, and forcing a shared `Identify` abstraction on that basis alone would be premature --- grow it when a concrete case demands it, the same discipline as [Expansion's technique set](#synthesizes-three-sub-roles-grounding-expansion-and-validation).

---

## Plan steps and referents: grounded by what is known

**Plan step** (`PlanStep`): a KR-agnostic description of one instruction a command needs against the position graph, expressed over **referents**, not over resolved ids. "Position" scopes it to the domain these steps manipulate (`EphemeraLudicGraph` / `mtw.ephemera.positions` membership and relational state). E.g. "seize golf club" implies a `transferMembership` step with `object: objectSpan('golf club')`, `from: currentHost(actingCharacter)`, `to: actingCharacter`. An older name for the same thing, still in some plan files, is **ungrounded position planning primitive**.

**A referent is grounded or ungrounded by what is known about it, not by where it sits in the pipeline.** Every referent kind carries an optional `groundedId`, the id it grounds to once known. Grounding *adds* the id without discarding the rest: a grounded `objectSpan` keeps its span and `stableRefKey`, which is what ties the phrase to its id in the command attempt's prose. `GroundedReferent` is any referent with `groundedId` required, and `PlanStep<R extends Referent = Referent>` is generic over its referents, so `PlanStep<GroundedReferent>` names a step whose every id is known. Plan emits steps with no `groundedId`s; Grounding fills in the span ids per candidate, by substitution on `stableRefKey`; Expansion emits fully grounded steps. **Ids are genuinely needed in only two places**: Expansion (a boundary sweep reads a real graph) and the kernel's step vocabulary. Everywhere upstream holds `PlanStep`.

**The executor's grounded vocabulary:** a grounded `Change` is the instruction, and a run retires steps carrying raw object and host ids (a relational edge retires as its whole chain) that --- critically --- form a **complete** instruction set: any required `dissolveRelation` steps already inserted, ordered for atomic apply. A transfer names one moved entity; anything it hosts lives in its own shard and travels with it, so no step widens what moves.

**Not the same axis as "candidate":** Identify's output (a span resolved, ranked, or pooled to ids, as a span candidate pool) is orthogonal to grounded-vs-ungrounded. A candidate can be uncertain (multiple ranked ids) while still being grounded in the sense that matters here (each candidate *is* a real id with real graph position). A referent is ungrounded while it carries no `groundedId`; fanning out one step per candidate is what gives each copy its id.

**Referent language:** steps need to express referents like "wherever the object with span `X` is currently located" or "the actor's current host," not just literal ids. `Referent` has four kinds, deliberately not exhaustive-in-advance (grow the union as concrete cases demand, not by pre-designing a general type language). Every kind also carries `groundedId?`. `objectSpan` and `graphNode` also carry **`groundedPresence?`**: every place the thing is seen, each a presence bucket that holds it, or the room itself when it sits in the room's own graph. It is learned alongside `groundedId`, by whoever learns the id (Grounding reads it off the `ludicCache`; Expansion reads the ends of a boundary edge it dissolves off the host graph), and it is what a narration audience walks up from to reach every room that can see the thing change. The actor's perspective picks which thing a phrase means, not who sees it. Absent means not learned, never "in the room":

| Kind | Shape | Meaning |
| --- | --- | --- |
| `objectSpan` | `{ referentType: 'objectSpan', span: string, stableRefKey?: string }` | The object referred to by this parsed `objectSpan`. |
| `actingCharacter` | `{ referentType: 'actingCharacter' }` | The character issuing the command --- contextual, not span-derived. |
| `currentHost` | `{ referentType: 'currentHost', referentTarget: Referent }` | The membership host of whatever the nested `Referent` resolves to. Recursively typed over `Referent` (not restricted to `objectSpan`) so it composes: `currentHost(actingCharacter)` expresses "the room the actor is currently in" without a dedicated kind. |
| `graphNode` | `{ referentType: 'graphNode', groundedId, groundedPresence? }` | Born grounded: a thing known only by its id in a graph, which no phrase named --- e.g. the post at the far end of a boundary edge Expansion must dissolve. |

Explicitly out of scope for `Referent` itself: plurality (several objects named by one span) and multi-host co-location (the `multiPresent` complexity class's territory).

**Change vs. Assertion (first-class step kinds, not nested).** Every plan step is either a **`Change`** (an effect, e.g. `transferMembership`) or an **`Assertion`** (a precondition-shaped check that gates continuation but produces no state transition) --- coequal variants in the same step union, mirroring the classical AI-planning precondition/effect split, not assertions nested under a change. An `Assertion` step can exist with no paired `Change` at all. Assertion evaluation is **Synthesize's** job, not Plan's --- Plan emits only the assertion's shape (predicate + referents) with zero KR access; Synthesize evaluates it against live graph state, since that's the stage holding both Identify's and Plan's output. An `Assertion` whose predicate has a meaningful inverse carries a `negate: boolean` flag rather than paired predicate names (e.g. no separate `notContainedBy`), because predicate evaluation is often itself disjunctive and a paired name would fork that logic into two copies to keep in sync. **Ternary-safe:** evaluation resolves `satisfied` / `violated` / `defer` (semantic residue needing an LLM judgment); `negate` flips `satisfied` <-> `violated` but leaves `defer` as `defer` --- you cannot confidently assert the negation of a fact you can't yet confidently resolve. The predicate is `containedBy(subject, object)`: disjunctive over membership/`On`, deterministic, plus `embedded into` as LLM-only semantic residue. **Placement is not a predicate.** Where a relation lands ("where does this relation go?") has no negation to express; it is Expansion's job (see `sameHost` below). Neither is a move's boundary dissolve: those are facilitating actions Expansion adds to the command attempt (see [`CommandAttempt`](#commandattempt)). `Assertion`/`Change` dispatch is per-primitive rather than per-kind, which keeps the union open-ended rather than requiring a new top-level case for every new job. Predicates grow as concrete cases demand, per `Referent`'s own discipline above.

---

## The relation-under-transfer table is Expansion's

The relation-under-transfer classification table (`dissolve` / `defer` per relation kind and moved end) answers "given a plan step and current KR state, what else must the instruction set do?" --- that is Expansion's job, not Plan's: Plan names the transfer, and only a grounded candidate has edges to classify. Commit reads it again against a later snapshot, to verify rather than to decide. The table itself, and where it is read: see [Navigation](#navigation).

---

## Synthesize's three sub-roles: Grounding, Expansion, and Validation

Synthesize is one *stage* (needs both Identify's and Plan's output simultaneously) but splits into three distinct *jobs* that must not be conflated, roughly in dependency order:

- **Grounding:** substitutes each `Referent` in a plan with its actual object or host id, against a precomputed **`ReferentAssignment`** --- one value per referent, in two namespaces with different lifetimes: **spans**, keyed by `stableRefKey`, decided once when identities are selected and carried with the candidate wherever it goes; **derived** (`actingCharacter`, `currentHost(X)`), keyed structurally, built fresh by whoever holds a live snapshot of the world (the actions-side dry run; positions at commit). A referent whose `groundedId` is already known passes through either namespace untouched. Grounding is substitution, not a live KR walk of its own: by the time it runs, the assignment it is given is complete. This is the join step that literally turns Plan's `PlanStep[]` output into a grounded candidate (a `Change` whose every referent has an id) --- the act the "ungrounded vs. grounded" vocabulary is named after. **The joint candidate space is Enumerate's, not Grounding's**: the product across an attempt's referents is formed before Grounding, so each assignment grounds to one answer. A relation joining the same object to itself never forms a candidate --- this is the disambiguation `stableRefKey` exists for ("put bench on bench" -> two distinct referents, four combinations, one dropped).
- **Expansion:** given a grounded-but-possibly-**incomplete** plan plus KR context, produces what a precondition or validity requirement needs that the plan didn't already say --- growing it into something Validation can then check. Two instances. **Boundary-edge Expansion** runs ahead of the executor, on the command attempt: a whole-object transfer's precondition is that the object is connected to nothing outside itself, so it adds one facilitating action per boundary edge the move must break, classifying each by relation kind and moved end. A `dissolve` cell's action has no challenge; a `Custom` edge's action, a subject-move included, carries a graph challenge for Adjudicate. The executor lowers these actions, facilitating dissolves first. **`sameHost`**, the executor's placement expansion, decides where a relational step lands: a relation between things in different shards becomes crossing legs and ports (establish builds a chain; dissolve finds the existing one), and a relation it cannot express declines. Neither widens what moves. Carrying is what hosting does: an object's hosted contents live in its own shard and travel with it.
- **Validation:** checks an already-**complete** grounded candidate for legality. Never grows a candidate. Validation checks what the world forbids, not what the builder just built: re-checking a chain Expansion produced is not Validation, so a route whose only Expansion is placement has no Validation of its own, and the kernel rechecks every leg at commit. World consistency (contradicting relations, cycles) is a planner's judgment, raised as a challenge, not a construction check. That a relation joins two different objects is a rule of the producer, not of Validation.

**Grounding precedes Expansion.** Every candidate is fully grounded before Expansion runs, and every step Expansion mints is already grounded. Expansion runs as a worklist: a step's minted children go to the front, so whatever a step needs happens before it.

**Expansion's scope of authority is defined by its job, not by its first implementation.** Boundary-edge Expansion uses one technique --- a classification table keyed by relation kind, where enum kinds resolve deterministically and `Custom` defers to an LLM. That shape is **one instance's technique**, not Expansion's definition; `sameHost`'s crossing-leg lowering already doesn't fit it. A future precondition may need a resolution mechanism that doesn't fit this shape at all --- one that consults more than two objects at once, ranks several valid repairs instead of returning a single one, or has no relation-kind axis to key off of. Don't assume "classify by kind, enum vs. `Custom`" is the whole space of techniques Expansion logic must take; grow the technique set the same way `Assertion` predicates grow --- as concrete cases demand, not by generalizing from one example.

---

## Fast-path implications

Because Identify, Plan, and Synthesize are independent jobs, "does this step need an LLM hop" is a **per-stage** question, not a whole-pipeline one:

| Stage | Deterministic fast path exists when | LLM needed when |
| --- | --- | --- |
| Identify | Exact-name catalog match (single candidate) | Ambiguous span, no exact match --- embedding rank + identity adjudication |
| Plan | Verb unambiguously admits one attempt (closed verb/frame template, e.g. `take` / `drop` / `get`) | Verb or frame is open/ambiguous about which attempt applies |
| Synthesize | No boundary relational edges touch the moved object (nothing to dissolve or defer) | A boundary edge classifies as `defer` (genuine interaction assessment, e.g. a `Custom` subject-move) |

This sharpens where LLM cost is actually spent, compared to treating "fast path vs. LLM" as one property of the whole command. It also reframes proposer-side fast paths (membership pre-gates, a minimal-verb classify skip) as **Identify+Plan** fast paths specifically.

---

## `DeterministicTemplate`

**Scope note:** unlike the rest of this file, this vocabulary is not object-manipulation-specific --- it generalizes the bare-word fast path (`look`, `help`, `home`, `predict`, none of which are object manipulation) alongside relational templates. It may move to a more general actions-level doc once cross-family plumbing lands.

A **`DeterministicTemplate`** is a structural interface --- `matchString(command: string)` / `matchTokens(skeleton: ParseSkeleton)`, both returning a **`DeterministicTemplateMatch`** --- for recognizing a command deterministically, at zero Bedrock cost, from either raw text or an already-tokenized skeleton. The **pattern-driven** family is a `PatternElement[]` (`templateText` closed-vocabulary gate, `objectSpan` referent slot, `capturedText` free-text slot) plus a constant `templateIntent`. The interface leaves a seam for a **context-dependent** family --- Navigation's exit resolution, `get`'s room-object-label gating --- whose emitted shape depends on live context rather than pattern data alone.

**`DeterministicTemplateMatch`** is a three-arm result:
- `{ type: 'noMatch' }` --- didn't recognize this at all.
- `{ type: 'matched', skeleton: ParseSkeleton, intent: ParseCommandResult }` --- classification **and** a synthesized skeleton together, in one deterministic hit. Reuses `ParseCommandResult` rather than a new "intent info" type, since the union already discriminates cleanly across families by construction.
- `{ type: 'defer', reason: DeterministicTemplateDeferReason }` --- recognized a known-but-structurally-unsupported shape --- distinct from "didn't understand this at all."

**Differentiation lives in the skeleton, not the intent.** Relational templates share one minimal intent across every row; which verb, which relation phrase and which subject/target spans are carried by the **synthesized skeleton**, recoverable downstream the same way a Parse-produced skeleton is.

---

## `CommandAttempt`

A player's attempted command, structured so later code can still reason about *what was attempted*, not just its compiled result --- built to keep "adjudication is trivial today" from hardening into a pipeline with nowhere to put adjudication later.

**One attempt per candidate, built before selection.** A producer grounds it, the shared stage expands and adjudicates it, and the grounded attempt is the selection unit: the dry run seeds from its desired results, and the selected candidate's attempt is the one published. If deferred adjudication changes the candidate, the dry run re-validates it. **Not every challenge is detectable deterministically.** A route whose attempt carries no graph challenge has not skipped a step; nothing deterministic could detect one there, which is the honest "not detected" half of the fast-path story.

**Adjudicate is a position in the phase order, not a place in the deployment.** It runs per candidate, right after Expansion, so the dry run validates an adjudicated attempt and selection ranks by that verdict; the bus decides only what is serialized. Verdicts ride the published attempt, and commit honors them rather than judging. **Which challenge kinds an adjudicator may judge is that adjudicator's policy**, so it lives in the adjudicator, not on the challenge members. The Coyote evaluator is the worked case: every player command is a preparation command, and in preparation a challenge on whether a facilitating action can physically happen is met. It judges a challenge only when the facilitating action expansion added is **certain to satisfy** the plan's precondition. For a `Custom` edge it always is: untying or cutting the lashing leaves the same graph. For a `Custom` subject-move it is not: the rope could be under a table (clearance: pull it out) or under a boulder (pinned: the boulder may have to move first). A pending challenge defers the candidate to the deferred tier. The two tiers share one contract (an attempt in, the same attempt with verdicts recorded out): the per-candidate tier runs on every candidate, and the deferred tier runs once from Selection, on the top deferred candidate.

**Preconditions, facilitating actions and sibling attempts.** A graph connection is a **precondition of a plan**, not a challenge on the intent: "not connected to anything" is a precondition of whole-object transfer. Within an attempt built on that plan, Expansion satisfies it with prior **facilitating actions** ("the lashing no longer holds"), and any judged challenge sits on the facilitating action, never on the primary. A different plan without that precondition is a **sibling attempt** in the same candidate pool, which Selection chooses between (e.g. take part of the rope and leave the rest connected in the room). **A facilitating action states a desired result, not a method.** Deterministic code can say "the lashing no longer holds"; it cannot choose between untying and cutting, which is manner, and manner belongs to an LLM reader or to narration. **A method choice is not a facilitating-action choice**: untying and cutting leave the same graph, so the choice between them is manner. Pulling a rope out from under a boulder and lifting the boulder off it leave different graphs, so they are different facilitating actions, and choosing between them is a choice between results. Expansion is one pass while no facilitating action has preconditions of its own.

**An attempt is a list of `AttemptAction`s, each an optional desired result plus the challenges that make it non-trivial.** Most actions have no challenge, and an attempt with none is simply done --- no adjudication. **Every action carries an id**, minted by whatever creates it (Plan, Expansion) and kept by every copy, so an action is addressed by id, never by position: Expansion adds actions after Plan, which shifts positions. Candidates grounded from one Plan attempt share that attempt's action ids. **Impossibility is a challenge verdict, not a separate check.** The attempt's **result** (`pending` / `succeeded` / `impossible`) is derived from the challenge verdicts, never held as its own state.

**Three declared-interface families, one container.** The container delegates prose and result to its members rather than holding per-kind logic:

- **Actions** (`AttemptActionMember`): expose your desired result, describe it, list your challenges. Members are keyed by **outcome class**. **Position** is one class --- `PlanStep`'s primitive shapes all share it --- with its desired result a `PlanStep` (Plan's step for the primary action, grounded per candidate; a fully grounded step for each facilitating dissolve) plus a separate prose gloss for an LLM reader. **Narration** is another: describing a referent is not a world mutation, so it has no desired result, only a description. It carries its referents itself, since it has no steps to hold them, and Identify, Enumerate and Grounding reach them through the same `referents()` accessor a position uses. A look is a narration. Each further outcome class is its own member.
- **Challenges** (`Challenge`): its wording, its **detection source** (`graph` or `worldKnowledge` --- distinguishing the deterministic fast path from what it cannot detect), and its verdict. A challenge propagates nothing: what a met verdict permits is its action's own desired result. Graph challenges carry the edge they judge (a `Custom` edge's wording phrases off its relation label); a world-knowledge challenge is free text with no edge.
- **Verdicts** (`Verdict`): does it proceed, does it refuse, what detail goes to narration, how does it render in the result section. **Met** and **impossible** (which carries its reason). **Pending** is the *absence* of a verdict, not a member.

**Narration units.** What witnesses read comes from the attempt, never from the outcome: a world change cannot say which act made it (untying and cutting leave the same graph) and carries no manner. A **narration unit** is its own value on the attempt, not a field on an action, because lines and actions are many-to-many: one action can have several lines, one line can **cover** several actions, and an action can have none. It names the action ids it covers and is authored by whatever created those actions, which alone knows why they exist; an action no unit covers narrates nothing. A unit holds one or more **witness variants**, each a line plus the **audience** it goes to. An audience names things in the sentence and a **phase** (*before* or *after* the covered actions), never a host: it means everyone in any room those things are seen in at that point, so an author reasons about the rope and the post, not about rooms. Several things in one audience form one roster, which is how one line reaches everyone who can see either end of a relation, once. Variants live in one unit rather than as separate units because they stand or fall together: a committed attempt committed every action it covers. **Not to be confused with a narration action**, the outcome class a look belongs to: that is a step-less action, while a narration unit is a line about actions.

**`CommandAttemptReferent`** is prose data, not how an action names a thing. An action's steps hold `Referent`s, which carry their own `groundedId` once known. `CommandAttemptReferent` describes one phrase the player used for the prose's referents section: its key, the id it grounded to, a short name and an optional gloss. Plan's ungrounded attempt is simply an attempt whose steps carry no `groundedId`s, so there is no separate ungrounded-attempt type. Referents are deliberately **not** a member family: every kind answers the same questions as data, differing only in where the data is looked up, so this stays a plain type. A `CommandAttempt` stores no referents list: its referents are rendered from its actions.

**The six-section prose format** --- words, referents, state, room context, actions, result --- is built only when an LLM will read it. **Room context is not attempt-owned state**: it is supplied at render time by a scope function, so a wider scope swaps the function, not the format.

**`gloss` (a referent's optional short physical description) is a reasoning field, not a render field** --- one description per thing, global like `shortName` (not per situation), present only where authored or improvised, and rewritten only at identity events (authoring edits, improvisation updates, divide/merge), never at a play-time mutation. **Current state overrides it**: a gloss's facts hold unless a later game-state override supersedes them (e.g. a painted-blue cup instead of a red one) --- the prose format's "State" section exists to carry that override, marked as superseding the gloss, and is read by an LLM as a convention rather than resolved by code (resolving it in code would need a property schema). The section's heading is always present, even when empty, so the convention is fixed ahead of any state axis.

## Non-goals (for this file)

- Does not restate the relation-under-transfer rule table itself (dissolve/defer per relation kind) --- that's instance-owned content in [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md#interaction-under-transfer).
- Does not record where code lives, how the design got here, or what is not built yet --- those belong to the implementation docs, git, and `taskPlanning/` respectively.

## Maintaining this file

Present tense, current model only: no dates, no slice or iteration provenance, no file paths outside [Navigation](#navigation), no status of unbuilt work. Update it only when vocabulary is added or a mental model changes. **A refactor that changes no behaviour but seems to need an edit here is the signal that the text being edited belongs in another file** --- move it there instead of updating it in place.

---

## Navigation

- Rules: [`AGENT.contract.md`](./AGENT.contract.md); commit-side rules (positions honors verdicts): [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md)
- Code map, per-route wiring, selection stage, `DeterministicTemplate` module: [`AGENT.implementation.md`](./AGENT.implementation.md)
- Parse / Identify / producers / relation-under-transfer table and where it is read: [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md)
- Synthesize executor (Grounding, worklist, placement): [`enrich/objectManipulation/synthesize/AGENT.implementation.md`](enrich/objectManipulation/synthesize/AGENT.implementation.md)
- Kernel commit wiring: [`../positions/manipulation/AGENT.implementation.md`](../positions/manipulation/AGENT.implementation.md)
- `gloss` authoring and storage: [`packages/mtw-wml/.../components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) ("Literal-field factory: `ShortName` and `Gloss`")
- Design seams and output trust (general Ephemera pipeline vocabulary, complementary axis): [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md)
- Open work: iteration roadmap and history index [`AGENT.objectManipulationIterations.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectManipulationIterations.planning.md); command attempt [`AGENT.commandAttemptPhase.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.commandAttemptPhase.planning.md); `Assertion` emission [`AGENT.deterministicFastPathImprovements.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.deterministicFastPathImprovements.planning.md); cross-family Plan [`AGENT.classifyPlanGeneralization.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md); fallbacks and backtrack [`AGENT.backtrackChannel.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.backtrackChannel.planning.md)
