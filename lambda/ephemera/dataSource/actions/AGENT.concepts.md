# `mtw.ephemera.actions` --- object manipulation pipeline concepts

This file records **mental models and vocabulary** for how a player command becomes KR-grounded, legal instruction execution in the object-manipulation pipeline (take / drop / relate). Normative rules: none yet --- see status note below. Instance code: [`AGENT.implementation.md`](./AGENT.implementation.md) (shipped pipeline, single-stage-conflated shape), [`enrich/objectManipulation/AGENT.md`](./enrich/objectManipulation/AGENT.md) (sandbox / synthesis instance).

**Status: Target.** This describes an intended three-stage decomposition, not the shipped pipeline's current module boundaries (see [Current conflation](#current-conflation-as-of-2026-07-12) below). Origin: Phase C sandbox design retrospective, 2026-07-12. Full trail: [`taskPlanning/.../AGENT.manipulationFrameAndRelational.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) (Phase C design debt), [`AGENT.planCompilerSandbox.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.planCompilerSandbox.planning.md) (sandbox build history this reframe grew out of).

---

## Three conceptual jobs

Every object-manipulation command, once the first-stage command parser has produced `objectSpan` data, decomposes into three independent jobs:

| Job | Question it answers | Needs KR (graph/catalog) state? | Current home |
| --- | --- | --- | --- |
| **Identify** | Which in-world UUID(s) does this `objectSpan` refer to, given current position/relationship context? | Yes | [`resolveObjectSpan.ts`](enrich/objectManipulation/resolveObjectSpan.ts), [`identityPlanCandidate.ts`](enrich/objectManipulation/identityPlanCandidate.ts), [`embeddingMatch/`](enrich/objectManipulation/embeddingMatch/) |
| **Plan** | What instruction-primitive family, at a high level, does this verb/frame require? (e.g. "seize" implies *some* `transferMembership` primitive) | **No** --- decidable from verb/frame alone | Not yet separated (see [Current conflation](#current-conflation-as-of-2026-07-12)) |
| **Synthesize** | Given a chosen ungrounded position planning primitive *and* KR grounding together, what is the complete, concrete, legal instruction set? (dissolve existing relationships if needed, expand the transfer target through carry mechanics if needed, validate legality) --- splits into **Grounding**, **Expansion**, and **Validation** sub-roles, see below | Yes --- needs **both** Identify's and Plan's output simultaneously | [`interactionUnderTransfer.ts`](../positions/positionGraph/expandValidate/interactionUnderTransfer.ts), [`applyTransferSet.ts`](../positions/positionGraph/expandValidate/applyTransferSet.ts), [`sandboxStep.ts`](enrich/objectManipulation/sandboxStep.ts), [`sandboxPlan.ts`](enrich/objectManipulation/sandboxPlan.ts) |

**Identify and Plan do not depend on each other's output.** Nothing about inferring "this utterance needs a `transferMembership`-shaped primitive" requires knowing *which* UUID the span resolves to, or where that object currently sits in the graph --- it only needs the verb frame. The two jobs are independent and can run in parallel (or even be reasoned about/cached independently of any particular game state). Only **Synthesize** is a genuine join: completing a grounded instruction (closing carry, deciding whether a relation must dissolve, deciding whether to defer for interaction assessment) is inherently a function of *both* the ungrounded primitive's shape *and* the live KR graph.

This is the concrete lesson underneath the reframe: earlier design work (Phase C sandbox, S1--S6) implicitly assumed Plan couldn't happen without KR grounding already in hand. That was expedient for a first draft, not a real constraint.

---

## Ungrounded position planning primitives vs. grounded primitives

**Ungrounded position planning primitive** (**ungrounded primitive**, for short): a KR-agnostic description of which position-graph instruction family a command needs, expressed over spans/labels, not resolved UUIDs. "Ungrounded" names the specific axis that varies (has this been resolved against KR state or not) --- deliberately not "abstract," which reads as a catch-all and drifts on a cold read. "Position" scopes the term to the domain these primitives manipulate (`EphemeraPositionGraph` / `mtw.ephemera.positions` membership and relational state), and "planning" scopes it to the **Plan** stage's output specifically, as opposed to Identify's candidates or Synthesize's grounded plan. E.g. "seize golf club" implies an ungrounded `transferMembership` primitive with `object: spanRef('golf club')`, `to: actorLocation` --- a referent, not yet an `EphemeraObjectId`.

**Grounded primitive:** the fully resolved Plan IR shape (parent-plan C1's `ParsePlanStep` union) with real `EphemeraObjectId`s, `EphemeraMembershipHostId`s, and --- critically --- a **complete** instruction set: carry-closed transfer sets, any required `dissolveRelation` steps already inserted (BD-8), ordered per BD-9's atomic-apply semantics.

**Not the same axis as "candidate":** Identify's output (a span resolved, ranked, or pooled to UUID(s), per [`SpanCandidatePool`](enrich/objectManipulation/spanResolution.ts)) is orthogonal to ungrounded-vs-grounded. A candidate can be uncertain (multiple ranked UUIDs) while still being grounded in the sense that matters here (each candidate *is* a real UUID with real graph position) --- "ungrounded" specifically means "not yet resolved to any UUID at all," a property of the **Plan** stage's output before Synthesize runs.

**Referent language (open):** ungrounded primitives need to express referents like "wherever the object with span `X` is currently located" or "the actor's current host," not just literal ids. The shape of this small referent sub-language has not been designed --- see the parent plan's Phase C design debt for tracking.

---

## Current conflation (as of 2026-07-12; resolved for the closure piece 2026-07-15)

The shipped/built code originally folded **Plan** and **Synthesize** together. `interactionUnderTransfer.ts`'s classification table (dissolve / carry / defer per relation kind) and `computeCarryClosure` answer "given an ungrounded primitive and current KR state, what is the complete concrete instruction set?" --- that is Synthesize's job. They used to sit in the same module family as `sandboxStep.ts` / `sandboxState.ts` / `sandboxPlan.ts`, whose actual job is narrower: given an **already-complete** grounded instruction (or sequence of them), check legality and thread resulting state. That's closer to pure validation than to synthesis.

**Resolved (2026-07-15), for a different reason than originally anticipated below:** working through why the membership-transfer persistence kernel needs to re-run this same closure/completeness check atomically at commit time (Expansion's output is exactly as perishable, under concurrent writes, as a Validation verdict --- both are functions of live relational-edge state) showed that `interactionUnderTransfer.ts`'s closure logic isn't just a naming artifact of sitting next to the sandbox --- it's genuinely needed by **two** callers in different layers (the compiler's `sandboxStep.ts`, and the persistence kernel). Rather than either layer importing from the other, both `interactionUnderTransfer.ts` and a newly-extracted `applyTransferSet.ts` (the transfer-set-completeness-check-and-mutate core previously inlined in `sandboxStep.ts`'s `applyTransferMembershipStep`) now live in [`positions/positionGraph/expandValidate/`](../positions/positionGraph/expandValidate/) --- a shared home for the "Expand + Validate" family neither the compiler nor the kernel owns, chosen (rather than a Synthesize-named module under `actions/`) specifically so the kernel can depend on it without a kernel-\>compiler import direction. `sandboxStep.ts`'s `applyTransferMembershipStep` is now a thin wrapper: its own locus/exit-edge check (`validateMembershipPlanDryRun`, genuinely compiler-only --- `defer` isn't actionable inside a DB transaction), then delegates to `applyTransferSet` for the rest. BD-16's not-yet-built `sameHost` repair table (the second named Expansion instance, below) is expected to land in the same `expandValidate/` directory when it's built, for the same reason.

---

## Synthesize's three sub-roles: Grounding, Expansion, and Validation

Synthesize is one *stage* (needs both Identify's and Plan's output simultaneously) but splits into three distinct *jobs* that must not be conflated, roughly in dependency order:

- **Grounding:** resolves each `Referent` in an ungrounded plan into its actual `EphemeraObjectId` / `EphemeraMembershipHostId`, combining Identify's per-span resolution with structural interpretation of composed referents --- `objectSpan` looks up Identify's resolved candidate for that span directly; `actingCharacter` resolves to the session's known character id; `currentHost(X)` requires first grounding `X`, then looking up *its* current host in the live KR graph. This is the join step that literally turns Plan's `UngroundedPlanStep[]` output into a grounded candidate (`ParsePlanStep`-shaped, though possibly still incomplete) --- the act the "ungrounded vs. grounded" vocabulary is named after. **Built (2026-07-13):** [`synthesize/groundReferent.ts`](enrich/objectManipulation/synthesize/groundReferent.ts) / [`groundChange.ts`](enrich/objectManipulation/synthesize/groundChange.ts) --- additive, unwired by any real command yet (see [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md#phase-c-sandbox-built-not-yet-wired-into-production) and the parent plan's Synthesize-stage-compiler checklist bullet for status).
- **Expansion:** given a grounded-but-possibly-**incomplete** plan plus KR context, produces the *additional steps* needed to satisfy a precondition or validity requirement the plan didn't already include --- growing it into something Validation can then check. Instances: `computeCarryClosure` ([`positions/positionGraph/expandValidate/interactionUnderTransfer.ts`](../positions/positionGraph/expandValidate/interactionUnderTransfer.ts), shipped --- BD-13; moved here 2026-07-15, see "Current conflation" above) and the `sameHost`-violation repair table (BD-16, **built 2026-07-15**: [`synthesize/expandSameHost.ts`](enrich/objectManipulation/synthesize/expandSameHost.ts) --- inserts a `transferMembership` step, subject to object's current host, when an `establishRelation`/`dissolveRelation` intent's subject and object don't already share one; `Custom`-kind violations defer to the LLM validator, BD-10. Landed in `synthesize/`, not `expandValidate/` --- see "Code home" below for why. Its host-equality check delegates to `EphemeraPositionGraph.bothObjectsOnGraph` (the same pure method `applyRelationalPatch` already uses for relational-patch legality) rather than comparing host ids independently, so a future commit-time re-verification (BD-15 slice 3) provably checks the same predicate this Expansion step relied on. Additive/unwired --- not yet invoked by `groundChange.ts`, per the still-open Grounding/Expansion interleaving question below).
- **Validation:** checks an already-**complete** grounded candidate for legality. Never grows a candidate --- a `carry`-classified boundary edge on an incomplete transfer set is `illegal`, not silently absorbed (see [Current conflation](#current-conflation-as-of-2026-07-12) above). Instance: the sandbox (`sandboxStep.ts` / `sandboxState.ts` / `sandboxPlan.ts`).

**Grounding and Expansion likely interleave, not run as two strict passes.** A step Expansion inserts (e.g. a new `transferMembership`) carries its own `Referent`s, which themselves need Grounding --- so in practice it's closer to "ground what you can, expand where a precondition needs it, ground the newly-inserted step's referents too" than a clean Grounding-then-Expansion-then-Validation pipeline. How that interleaving is actually orchestrated is **not decided** --- flagged here, not designed, per this section's own "don't over-design from limited examples" discipline below.

**Expansion's scope of authority is defined by its job, not by its first implementation.** Both known Expansion instances happen to share one technique --- a classification table keyed by relation kind, where enum kinds resolve deterministically and `Custom` defers to an LLM. That shape is a **pattern discovered twice**, not Expansion's definition. A future precondition may need a resolution mechanism that doesn't fit this shape at all --- one that consults more than two objects at once, ranks several valid repairs instead of returning a single one, or has no relation-kind axis to key off of. Don't assume "classify by kind, enum vs. `Custom`" is the whole space of techniques Expansion logic must take; grow the technique set the same way BD-14 grows `Assertion` predicates --- as concrete cases demand, not by generalizing from two examples.

**Code home (updated 2026-07-15):** Expansion's two known instances no longer share one location --- `computeCarryClosure`/`boundaryEdgeOutcomes` moved to `positions/positionGraph/expandValidate/` (see "Current conflation" above) because they're pure functions over already-fetched `EphemeraPositionGraph` objects, genuinely needed by two callers in different layers (the compiler's `expandTransferMembership.ts`, and the persistence kernel's `applyTransferSet.ts`). `expandSameHost.ts` stays in `enrich/objectManipulation/synthesize/`, alongside `expandTransferMembership.ts` and Grounding's `groundReferent.ts`/`groundChange.ts` --- all four are KR-callback orchestration (`getCurrentHost`/`getGraph` injected dependencies) with exactly one caller layer (the compiler) today, not pure graph-object functions with a second, kernel-side caller. Revisit if a persistence-layer caller for `expandSameHost`'s orchestration shape ever materializes (BD-15 slice 3 only needs the pure `bothObjectsOnGraph` check it already delegates to, not this wrapper itself). All four files are unwired by any real command yet, same status `computeCarryClosure` had before Slices 4a/4b converged Validation onto it.

---

## Fast-path implications

Because Identify, Plan, and Synthesize are independent jobs, "does this step need an LLM hop" is a **per-stage** question, not a whole-pipeline one:

| Stage | Deterministic fast path exists when | LLM needed when |
| --- | --- | --- |
| Identify | Exact-name catalog match (single candidate) | Ambiguous span, no exact match --- embedding rank + identity adjudication |
| Plan | Verb unambiguously implies one primitive family (closed verb/frame template, e.g. `take` / `drop` / `get`) | Verb or frame is open/ambiguous about which primitive family applies |
| Synthesize | No boundary relational edges touch the transfer set (nothing to dissolve/carry/defer) | A boundary edge classifies as `defer` (genuine interaction assessment, e.g. `Under` subject-move, `Custom`) |

This sharpens where LLM cost is actually spent, compared to treating "fast path vs. LLM" as one property of the whole command. It also reframes the existing proposer fast-path work (membership atomic pre-gates, minimal-verb classify skip) as **Identify+Plan** fast paths specifically --- see [`AGENT.implementation.md`](./AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents) for the shipped instance.

---

## Non-goals (for this file)

- Does not specify the ungrounded-primitive type shape or referent grammar --- open, tracked in the parent plan's Phase C design debt, not here (implementation fork, not settled vocabulary).
- Does not specify how Plan chooses between candidate primitive families when a verb is ambiguous (LLM vs. deterministic) --- future contract content once a Plan-stage module exists.
- Does not restate the interaction-under-transfer rule table itself (dissolve/carry/defer per relation kind) --- that's shipped, instance-owned content in [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md#phase-c-sandbox-built-not-yet-wired-into-production).

---

## Navigation

- Shipped pipeline instance (current conflated shape): [`AGENT.implementation.md`](./AGENT.implementation.md)
- Sandbox / Synthesize-stage instance: [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md)
- Design seams and output trust (general Ephemera pipeline vocabulary, complementary axis): [`../llm/AGENT.concepts.md`](../llm/AGENT.concepts.md)
- Open engineering forks (referent language, per-stage fast-path design): parent plan's Phase C design debt, [`taskPlanning/.../AGENT.manipulationFrameAndRelational.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md)
