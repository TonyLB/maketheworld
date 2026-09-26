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

A table keyed by a closed union is a lightweight version of the first case, for families whose answers are data rather than behavior. [`interactionUnderTransfer.ts`](lambda/ephemera/dataSource/positions/ludicGraph/expandValidate/interactionUnderTransfer.ts)'s `CLOSED_RELATION_BEHAVIOR` is one example: a `Record<ClosedRelationKind, ...>` the compiler forces complete.

## Apply it at every level that grows

Declaring a family's questions doesn't make each member thread every sub-part through every answer. `withGloss` is on the component interface. But nothing forced `gloss` into each component's `merge`, `invert`, and `isEmpty`; copying `ShortName` did that. Fields are a family in practice, but they are wired into each component by hand, rather than implementing a shared field interface the component folds over. The gap sits exactly where the pattern stopped being applied.

## Techniques (not reasons to choose a class)

- **Private constructor, named static constructors.** Keep `fromJSON`/`toJSON` for the bus and storage boundary, and build through constructors named for the domain. [`EphemeraLudicGraph`](lambda/ephemera/dataSource/positions/ludicGraph/index.ts) (`empty`, `fromFieldPayload`, `fromPlayEnvelope`) is the model.
- **Method names are the vocabulary callers reason in, so name them in domain terms.** A method addressed by array positions (`recordVerdict(0, 0, ...)`) gives this benefit away.
- **Explain in the file.** Doc comments state what the class is, rather than pointing at planning-row IDs a reader would have to go and open.

## Costs

- **Classes don't cross boundaries.** Anything on the message bus, in Dynamo, or inside an Immer `produce()` draft needs `toJSON`/`fromJSON` at the edge. Retain plain copies past a reducer: Immer revokes draft proxies when the reducer returns (see `EphemeraLudicGraph.fromFieldPayload`'s comment).
- **Wiring is still manual where the family pattern isn't applied.** Adding `Gloss` touched 21 files, mostly mechanically. The reasoning was cheap; the typing was not.

## Worked example: the command-attempt pipeline

[`lambda/ephemera/dataSource/actions/commandAttempt/`](lambda/ephemera/dataSource/actions/commandAttempt/index.ts)'s `CommandAttempt` was the prototype that produced this convention. As shipped (2026-09-26), it is a container without its families: its methods hold bespoke logic (`renderProse`, `recordVerdict`) rather than delegating to members. The command-attempt pipeline has four candidate families that the container would compose. None has been refactored yet:

- **Actions.** Plan's step kinds.
- **Challenges.** Today only a relation-edge `defer`; more kinds are coming.
- **Verdicts and outcomes.** Roughly a dozen stage-local verdict unions exist today, with `defer` repeated across several.
- **Referents.** Ungrounded and grounded referents are already two unrelated types for one referent at two stages.
