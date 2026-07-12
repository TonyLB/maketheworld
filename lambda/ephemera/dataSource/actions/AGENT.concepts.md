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
| **Synthesize** | Given a chosen abstract primitive *and* KR grounding together, what is the complete, concrete, legal instruction set? (dissolve existing relationships if needed, expand the transfer target through carry mechanics if needed, validate legality) | Yes --- needs **both** Identify's and Plan's output simultaneously | [`interactionUnderTransfer.ts`](enrich/objectManipulation/interactionUnderTransfer.ts), [`sandboxStep.ts`](enrich/objectManipulation/sandboxStep.ts), [`sandboxPlan.ts`](enrich/objectManipulation/sandboxPlan.ts) |

**Identify and Plan do not depend on each other's output.** Nothing about inferring "this utterance needs a `transferMembership`-shaped primitive" requires knowing *which* UUID the span resolves to, or where that object currently sits in the graph --- it only needs the verb frame. The two jobs are independent and can run in parallel (or even be reasoned about/cached independently of any particular game state). Only **Synthesize** is a genuine join: completing a grounded instruction (closing carry, deciding whether a relation must dissolve, deciding whether to defer for interaction assessment) is inherently a function of *both* the abstract primitive's shape *and* the live KR graph.

This is the concrete lesson underneath the reframe: earlier design work (Phase C sandbox, S1--S6) implicitly assumed Plan couldn't happen without KR grounding already in hand. That was expedient for a first draft, not a real constraint.

---

## Abstract vs. grounded primitives

**Abstract primitive:** a KR-agnostic description of which instruction-primitive family a command needs, expressed over spans/labels, not resolved UUIDs. E.g. "seize golf club" implies an abstract `transferMembership` primitive with `object: spanRef('golf club')`, `to: actorLocation` --- a referent, not yet an `EphemeraObjectId`.

**Grounded primitive:** the fully resolved Plan IR shape (parent-plan C1's `ParsePlanStep` union) with real `EphemeraObjectId`s, `EphemeraMembershipHostId`s, and --- critically --- a **complete** instruction set: carry-closed transfer sets, any required `dissolveRelation` steps already inserted (BD-8), ordered per BD-9's atomic-apply semantics.

**Not the same axis as "candidate":** Identify's output (a span resolved, ranked, or pooled to UUID(s), per [`SpanCandidatePool`](enrich/objectManipulation/spanResolution.ts)) is orthogonal to abstract-vs-grounded. A candidate can be uncertain (multiple ranked UUIDs) while still being grounded in the sense that matters here (each candidate *is* a real UUID with real graph position) --- "abstract" specifically means "not yet resolved to any UUID at all," a property of the **Plan** stage's output before Synthesize runs.

**Referent language (open):** abstract primitives need to express referents like "wherever the object with span `X` is currently located" or "the actor's current host," not just literal ids. The shape of this small referent sub-language has not been designed --- see the parent plan's Phase C design debt for tracking.

---

## Current conflation (as of 2026-07-12)

The shipped/built code folds **Plan** and **Synthesize** together. `interactionUnderTransfer.ts`'s classification table (dissolve / carry / defer per relation kind) and `computeCarryClosure` answer "given an abstract primitive and current KR state, what is the complete concrete instruction set?" --- that is Synthesize's job. They currently sit in the same module family as `sandboxStep.ts` / `sandboxState.ts` / `sandboxPlan.ts`, whose actual job is narrower: given an **already-complete** grounded instruction (or sequence of them), check legality and thread resulting state. That's closer to pure validation than to synthesis.

This is a naming/module-boundary observation, not a defect: nothing here needs to be rewritten for the reframe to hold. The sandbox's [own governing decision](enrich/objectManipulation/AGENT.md#phase-c-sandbox-built-not-yet-wired-into-production) --- that it **validates** transfer-set completeness but never **expands** one itself, returning `illegal` rather than silently closing carry --- is exactly consistent with "closure belongs to Synthesize, not to the validator." When the abstract-primitive type family (Plan stage) is actually built, `interactionUnderTransfer.ts` / `computeCarryClosure` are the natural candidates to move under a Synthesize-named module, with the sandbox's own files shrinking to the pure-validation slice.

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

- Does not specify the abstract-primitive type shape or referent grammar --- open, tracked in the parent plan's Phase C design debt, not here (implementation fork, not settled vocabulary).
- Does not specify how Plan chooses between candidate primitive families when a verb is ambiguous (LLM vs. deterministic) --- future contract content once a Plan-stage module exists.
- Does not restate the interaction-under-transfer rule table itself (dissolve/carry/defer per relation kind) --- that's shipped, instance-owned content in [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md#phase-c-sandbox-built-not-yet-wired-into-production).

---

## Navigation

- Shipped pipeline instance (current conflated shape): [`AGENT.implementation.md`](./AGENT.implementation.md)
- Sandbox / Synthesize-stage instance: [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md)
- Design seams and output trust (general Ephemera pipeline vocabulary, complementary axis): [`../llm/AGENT.concepts.md`](../llm/AGENT.concepts.md)
- Open engineering forks (referent language, per-stage fast-path design): parent plan's Phase C design debt, [`taskPlanning/.../AGENT.manipulationFrameAndRelational.planning.md`](../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md)
