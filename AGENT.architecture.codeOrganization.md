# Code Organization - Abstractions You Can Reason Over

> Project-wide code-style convention, not tied to one package. Why it matters architecturally: [`AGENT.architecture.philosophy.md`](AGENT.architecture.philosophy.md#code-organization-abstractions-you-can-reason-over). Each area's code map stays in its own `AGENT.implementation.md`.

**Status: newly articulated (2026-09-26), and followed inconsistently.** Most existing code predates this convention. Expect many places across the codebase where aligning with it would be a refactor. Treat a mismatch as refactoring debt to note, not as precedent to copy. New code follows the convention.

## The goal

The codebase is too large to hold in one context window, or to reason over coherently even if it fit. Development needs abstractions that let you reason about extending a subsystem without knowing its details. A TS class is a tool for that goal. It is worth using where it bounds what you must read to make a change, and not otherwise.

## The precedent

In `mtw-wml`, adding `Gloss` to every manipulable component was easy to reason about: it was clear where changes landed, which constructors to lean on, and how to test. That came from four things:

- **A declared set of questions every member answers.** Here that is the `ComponentConstructorMethods` interface in [`packages/mtw-wml/ts/standardize/components/component.ts`](packages/mtw-wml/ts/standardize/components/component.ts).
- **A unit of extension.** Here that is a field module, for example `glossField.ts`.
- **A sibling to copy.** Here that is `ShortName`, so `Gloss` could be designed as "like `ShortName`, except ..." rather than from scratch.
- **A test shape implied by the questions.** Here that is a round trip.

## Use a class for two roles

1. **Members of a family.** Declare the family as an interface or abstract class, with one class per member. The interface is the family's reasoning surface. A new member gets it as a checklist. A new question makes the compiler list every member that still needs an answer.
2. **Containers that compose members.** A component composes its fields. The container's methods delegate to the members and fold their answers. The whole is then correct if each member is correct and the fold is correct, and each can be checked alone. This is what keeps reasoning from scaling with the number of members.

**Do not use a class only to put bespoke logic in one file.** That gives locality ("where is the code?") but no leverage on "what changes when this grows?"

## Which axis grows?

- **The set of members keeps growing** (new kinds keep arriving): use a class per member. One member's answers stay together, and adding a member touches one place.
- **The members are stable and the operations keep growing:** use a discriminated union with exhaustive switches (`never` checks), and plain functions. Adding an operation touches one place.

**Judge growth by forward demand.** For a structure that isn't in the pipeline yet, look at what the roadmap says will arrive. Its git history, its current producers (often none), and its current lack of nuance are not evidence. A three-valued verdict type looks closed only because nothing adjudicates yet.

A table keyed by a closed union is a lightweight version of the first case, for families whose answers are data rather than behavior. [`interactionUnderTransfer.ts`](lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts)'s `CLOSED_RELATION_BEHAVIOR` is one example: a `Record<ClosedRelationKind, ...>` the compiler forces complete.

## Apply it at every level that grows

Declaring a family's questions doesn't make each member thread every sub-part through every answer. `withGloss` is on the component interface. But nothing forced `gloss` into each component's `merge`, `invert`, and `isEmpty`; copying `ShortName` did that. Fields are a family in practice, but they are wired into each component by hand, rather than implementing a shared field interface the component folds over. The gap sits exactly where the pattern stopped being applied.

## Techniques (not reasons to choose a class)

- **Private constructor, named static constructors.** Keep `fromJSON`/`toJSON` for the bus and storage boundary, and build through constructors named for the domain. [`EphemeraLudicGraph`](lambda/ephemera/dataSource/positions/ludicGraph/index.ts) (`empty`, `fromFieldPayload`, `fromPlayEnvelope`) is the model.
- **Method names are the vocabulary callers reason in, so name them in domain terms.** A method addressed by array positions (`recordVerdict(0, 0, ...)`) gives this benefit away.
- **Explain in the file.** Doc comments state what the class is, rather than pointing at planning-row IDs a reader would have to go and open.
- **The interface declares everything the container calls, not only the domain questions.** Plumbing counts: serialization (`toJSON`) and pure updates (`withX`). Type the container against the interface even when the family has one member. A one-member family hides the gap, because an alias from the family type to its only class compiles fine. The smell is a cast to a union of concrete classes (`as MetVerdict | ImpossibleVerdict`) in the family's dispatch code, or a family type that aliases one class.
- **A fold over a class family needs its own exhaustiveness check.** A class family loses the compiler's `never` check. So each outcome must require its own positive answer from every member, and whatever matches no outcome must throw. Don't infer an outcome by elimination ("nothing refused, nothing pending, so it succeeded"). With few members, two different questions can give the same answers, and the tests can't tell them apart. The residual throw is the runtime stand-in for `never`.
- **Type a value by what is known about it, not by the stage that holds it.** Knowledge a later stage learns is an optional field that a refined type makes required. It is not a replacement variant that discards what was already known. Containers that hold the value become generic, with the general type as the default, so one name covers both. The model is [`plan/planStep.ts`](lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planStep.ts). Every `Referent` kind carries `groundedId?`, `GroundedReferent` requires it, and `PlanStep<R extends Referent = Referent>` names a step at any level of grounding. Add a new variant only for a thing that is *born* knowing (there, `graphNode`). The smell is parallel per-stage types for one concept, with conversion code between them that copies fields across.

## Costs

- **Classes don't cross boundaries.** Anything on the message bus, in Dynamo, or inside an Immer `produce()` draft needs `toJSON`/`fromJSON` at the edge. Retain plain copies past a reducer: Immer revokes draft proxies when the reducer returns (see `EphemeraLudicGraph.fromFieldPayload`'s comment).
- **Wiring is still manual where the family pattern isn't applied.** Adding `Gloss` touched 21 files, mostly mechanically. The reasoning was cheap; the typing was not.

## Worked example: the command-attempt pipeline

[`lambda/ephemera/dataSource/actions/commandAttempt/`](lambda/ephemera/dataSource/actions/commandAttempt/index.ts)'s `CommandAttempt` was the prototype that produced this convention. As first shipped (2026-09-26), it was a container without its families: its methods held bespoke logic (`renderProse`, `recordVerdict`) rather than delegating to members. The command-attempt pipeline had four candidate families. Applying the test to each, by forward demand (2026-09-26):

- **Actions: a family.** New kinds of desired result are queued (outcome classes beyond position, effects along relations), and each member answers the same questions: describe yourself, list your challenges, give your outcome.
- **Challenges: a family.** Relation-edge defers, lock state, feasibility, stability and strength are all queued. Each kind differs in wording, in how it's detected, and in what a *met* verdict must propagate.
- **Verdicts: a family.** Success with a manner ("painstakingly") and failure with a consequence are posited. Each member answers: proceed, refuse or fail? What manner goes to narration? How does it render? `pending` is the absence of a verdict, not a member.
- **Referents: not a family.** Object, Character and Feature answer the same questions as data, and differ only in where the data is looked up. The work there is a named constructor from Identify's output.

**Shipped, same day (slice 1.7):** the first three are now declared-interface families ([`action.ts`](lambda/ephemera/dataSource/actions/commandAttempt/action.ts), [`challenge.ts`](lambda/ephemera/dataSource/actions/commandAttempt/challenge.ts), [`verdict.ts`](lambda/ephemera/dataSource/actions/commandAttempt/verdict.ts)), each with one-or-more members answering that family's fixed questions, built before the attempt has any real caller. The container (`index.ts`) composes referents (still plain data) and actions (each holding its own challenges), and `renderProse`/`result` now fold over member answers instead of holding per-kind logic --- `result` asks each recorded verdict `proceeds()`/`refuses()`; it no longer compares verdict strings. `recordVerdict` moved from array-position addressing (`recordVerdict(actionIndex, challengeIndex, ...)`) to a caller-assigned challenge id, closing the exact gap the "Method names are the vocabulary" technique above warns about. One member per family shipped where only one case existed (`PositionAttemptAction`, `MetVerdict`/`ImpossibleVerdict`); the challenge family shipped three (`CustomEdgeChallenge`, `UnderDeferChallenge`, `WorldKnowledgeChallenge`) because three were already load-bearing in the existing fixtures.

**The first cut had two gaps, closed in a same-day follow-up.** Both are now techniques above. First, `toJSON` and `withChallenges` lived only on the concrete classes: `AttemptAction` aliased `PositionAttemptAction`, and the `*ToJSON` helpers cast to concrete unions. Second, `result` reported success when nothing refused, rather than when every verdict `proceeds()`. A future `failed` verdict would have silently succeeded. Every test stayed green, because with only `met` and `impossible`, "doesn't refuse" and "proceeds" give the same answers. Full detail: [`taskPlanning/.../AGENT.commandAttemptPhase.planning.md`](taskPlanning/lambda/ephemera/dataSource/actions/AGENT.commandAttemptPhase.planning.md)'s slice 1.7.

**The class survived its first bus crossing without a leak (slice 2, 2026-09-29).** `CommandAttempt` got its first real callers --- built at each object-manipulation route's Identify+Plan join, serialized onto the published payload, reconstructed via `fromJSON` at the one place every route crosses the actions -> positions bus. Grepping for the plain-data type (`CommandAttemptData`) outside `fromJSON`/`toJSON` and the publish/consume sites found none: `publishedEvents.ts`'s `attempt?: CommandAttemptData` field and `positions/index.ts`'s single `reconstructAndAdjudicateAttempt` helper are the only places the data shape crosses a boundary; every call site past that point holds the class. The one new plain function this slice added (`adjudicateAttempt`, then a stub seam, since slice 3 the Coyote evaluator) takes and returns the class, not the data shape --- consistent with "the plain-data type appears only at the boundary," not a special case for a new kind of caller. **Slice 2.6 (2026-09-30)** moved the membership route's attempt ahead of selection. The class is now built through a named domain constructor (`CommandAttempt.create`), and it rides through candidate scoring and selection as a field of the grounded candidate, converted to data only by `toJSON()` at the publish site. That settles the slice-1.5 lesson that `fromJSON` was doubling as the domain constructor. The relational and rehost routes still build `CommandAttemptData` literals at their publish sites, which is still inside the boundary rule.

**A separate observation, not part of this container:** roughly a dozen stage-local verdict unions exist elsewhere in the pipeline (dry run, kernel apply, grounding), with `defer` repeated across several. Each answers a different stage's question, and nothing on the roadmap asks them to share a type.
