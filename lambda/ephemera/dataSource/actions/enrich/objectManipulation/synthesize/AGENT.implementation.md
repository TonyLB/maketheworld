# Synthesize executor (`synthesize/`)

This file records **where** Synthesize's Grounding -> Expansion -> Validation executor lives and how its pieces fit together --- not the reasoning behind each design choice (that lives in the files' own doc comments, which is where it belongs: next to the code it constrains) and not vocabulary (**Grounding**/**Expansion**/**Validation**, **Change**/**Assertion** --- see [`../../AGENT.concepts.md`](../../AGENT.concepts.md)).

Parent docs:

- Synthesize sub-role vocabulary, Expansion write-up: [`../../AGENT.concepts.md`](../../AGENT.concepts.md)
- Pipeline context (where this executor is invoked from on each live route): [`../AGENT.md`](../AGENT.md) --- "Phase C sandbox" section records the retirement of this executor's ad hoc predecessors
- What consumes this executor's output (`ExecutorParsePlanStep[]` -> `KernelStep[]` -> commit): [`../../../../positions/manipulation/AGENT.implementation.md`](../../../../positions/manipulation/AGENT.implementation.md)

## Worklist execution model

A live route seeds an ordered list of `Change`/`Assertion` instructions (one per grounded candidate, per BD-32's scope --- multi-candidate fan-out and selection stay in the caller), then `runExecutor` drives them to fixpoint by priority: ground the first `ungrounded` instruction; else operand-expand the first `grounded`-but-not-`operandExpanded` one (a no-op except for the two primitives with a closable operand set --- `transferMembership`, `isolatedFromRelations`); else fire command-expansion on the frontmost `operandExpanded` instruction, which either retires it directly into the output list (an atomic effect: `transferMembership`, `establishRelation`, `dissolveRelation`) or retires it having minted zero or more child instructions pushed to the front (a generator: `sameHost`, `isolatedFromRelations`).

Two invariants worth knowing before touching this, both enforced by `runExecutor`'s priority order rather than any per-instruction bookkeeping: draining every `operandExpanded`-eligible instruction before any command-expansion fires means every consumer of a shared closure reads one saturated set, not a partial one; and a command-expansion's minted children are causally downstream (they didn't exist when their parent fired), so pushing them to the front and re-entering at operand-expansion is always sound. The concrete mechanics --- the `GroupId`/`groupIdByObject` dedup that lets two instructions sharing an operand set reuse one closure computation, and the per-primitive dispatch table itself --- are documented where they're implemented, not restated here.

## Files

| File | Role |
| --- | --- |
| [`executor.ts`](executor.ts) | The worklist driver (`runExecutor`) and seeding helpers (`seedFromUngroundedSteps`, `seedTransferMembership`/`introduceRepairTransferMembership` --- the BD-34 constructor pairing a `transferMembership` with its `isolatedFromRelations` sibling by construction) |
| [`executorTypes.ts`](executorTypes.ts) | `WorklistInstruction`'s progress-tagged states, `ExpansionEnvironment`/`GroupId`, `ExecutorParsePlanStep` (the grounded output shape --- `parsePlanStep.ts`'s relational steps minus `hostRoomId`, per BD-33's assert-and-throw) |
| [`expansionEnvironment.ts`](expansionEnvironment.ts) | The shared closure ledger (`createExpansionEnvironment`, `lookupOrComputeClosure`) one worklist run threads through every operand-expansion |
| [`groundReferent.ts`](groundReferent.ts) | Grounding for a single `Referent`: ranked candidate pools per `stableRefKey` into a settled id (or the joint candidate space `groundChange` fans out over) |
| [`groundChange.ts`](groundChange.ts) | Grounding for a `Change`: Cartesian product across its `Referent`s, same-object combinations kept (BD-23) |
| [`groundAssertion.ts`](groundAssertion.ts) | Grounding for an `Assertion` (`sameHost`/`containedBy`/`isolatedFromRelations`) |
| [`expandSameHost.ts`](expandSameHost.ts) | BD-16's `sameHost` command-expansion: confirms or repairs (inserts a `transferMembership`) when a relational `Change`'s subject/object don't already share a host |
| [`filterLegalRelationalCandidates.ts`](filterLegalRelationalCandidates.ts) | Validation for the relational route: `evaluateRelationalLegality.ts`'s checks plus cycle detection over `groundChange`'s joint candidate space |
| [`detectRelationalCycle.ts`](detectRelationalCycle.ts) | Directed-cycle check one relation kind's edges, simulated post-candidate --- catches a self-relation as a one-node cycle rather than a bespoke `subjectId === targetId` rule |

Kernel-layer step vocabulary (`KernelStep`, entity-kind-general `transferMembership`) and the `fromExecutorStep` adapter bridging this folder's `ExecutorParsePlanStep` to it live in [`../../../../positions/manipulation/kernel/kernelStep.ts`](../../../../positions/manipulation/kernel/kernelStep.ts) --- outside this folder, since the kernel serves every membership-transfer route, not just the two that reach it through this executor.
