# `mtw.ephemera.actions/enrich`

## Role

`actions/enrich/` defines post-discrimination enrichment flows that transform intent-level parse outcomes into terminal `ParseCommandResult` payloads.

Current implementation:

- [`acmeOrder/`](./acmeOrder/) - enriches `AcmeOrderIntent` into terminal **`AcmeOrder`** lines (or **`ParseCommandErrorResult`** when the Coyote-wide object placement count exceeds the cap **before** any Acme enrich Bedrock call), including catalog validation details, affinity proposals, and **`stableKey`** proposals.
- [`objectManipulation/`](./objectManipulation/) - enriches **`ObjectManipulationIntent`** into terminal **`ObjectManipulation`** (v1 atomic **`takeHold`** / **`drop`**) or **`ParseCommandErrorResult`** (complex disposition stub, unimplemented atomic **`operationKind`**, resolve failure, or enrich parse/invoke failure). Relational commands route through dedicated frame extract (Phase B B1); membership atomics use **`compileMembershipAtomic`**.

## Boundary

- **Input:** an intent-level outcome from `discriminateIntent` plus original command/context (for example **`occupiedStableKeys`** and enrich-model responses).
- **Output:** terminal parse payloads (for example **`AcmeOrder`**, or **`Error`** when the placement cap rejects enrich) or pass-through behavior handled by **`parseCommand`** orchestration.
- **Ownership:** enrich modules should stay focused on enrichment/normalization logic; `parseCommand` remains the orchestrator deciding when enrichment runs.

## Current files

- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - placement-count guard, Bedrock **`invokeBedrockAcmeOrderEnrich`**, and wiring to **`finalizeAcmeOrderFromEnrich`**.
- [`acmeOrder/buildPrompt.ts`](./acmeOrder/buildPrompt.ts) - builds Bedrock enrich prompt parts (**core** + **iconic** few-shots; iconic omitted when **`includeIconicFewShots: false`**, e.g. affinities harness live enrich).
- [`acmeOrder/interpretAndFinalize.ts`](./acmeOrder/interpretAndFinalize.ts) - interprets enrich output and finalizes **`ParseCommandAcmeOrderResult`**.
- [`acmeOrder/acmeOrderThinkingPersistence.ts`](./acmeOrder/acmeOrderThinkingPersistence.ts) - bootstrap / emit / finalize helpers for segment **`acmeOrderEnrich`** (`mtw.ephemera.actions` **`Thinking Result`** publisher).
- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - orchestrates thinking lifecycle when **`EnrichAcmeOrderDeps.messageBus`** is set (see **Thinking** below).
- [`objectManipulation/index.ts`](./objectManipulation/index.ts) - relational route at entry; membership path: cardinality gate then **`compileMembershipAtomic`**.
- [`objectManipulation/relationalRoute.ts`](./objectManipulation/relationalRoute.ts) - expanded relational preposition detection; routes to frame extract vs membership path.
- [`objectManipulation/manipulationFrame.ts`](./objectManipulation/manipulationFrame.ts) - **`ManipulationFrame`** + **`ManipulationFrameExtractModelResponse`**; builder from frame-extract LLM output.
- [`objectManipulation/frameExtract/`](./objectManipulation/frameExtract/) - dedicated frame-extract Bedrock hop (BD-4): prompt, interpret, **`runFrameExtractStage`**.
- [`objectManipulation/compileRelationalStub.ts`](./objectManipulation/compileRelationalStub.ts) - B1 compiler stub; calls **`normalizeRelationSpan`** (B2); nesting defer -> **`nestingRelational`** Error; enum/custom still terminal **`complexRelational`** Error until B3 grounding.
- [`objectManipulation/relationKind.ts`](./objectManipulation/relationKind.ts) - **`HostRelationalEdgeKind`**, **`NormalizedRelation`**, **`NormalizeRelationOutcome`** types (BD-2 / BD-3).
- [`objectManipulation/normalizeRelationSpan.ts`](./objectManipulation/normalizeRelationSpan.ts) - deterministic **`relationSpan`** -> enum | **`Custom`** + label | nesting defer (B2).
- [`objectManipulation/compileMembershipAtomic.ts`](./objectManipulation/compileMembershipAtomic.ts) - membership-atomic orchestrator: merged identity, pre-gates, agreement gate, complexity LLM defer.
- [`objectManipulation/verbMembershipAgreement.ts`](./objectManipulation/verbMembershipAgreement.ts) - **`verbClass`** vs **`operationKind`** agreement gate and PA-4 confidence cap helper.
- [`objectManipulation/catalogMerge.ts`](./objectManipulation/catalogMerge.ts) - merge room + held catalogs with **`catalogScope`** tagging.
- [`objectManipulation/identityStage.ts`](./objectManipulation/identityStage.ts) - per-span deterministic resolve + optional identity LLM.
- [`objectManipulation/interpretIdentity.ts`](./objectManipulation/interpretIdentity.ts) - identity LLM JSON parse (`objectId` allowed).
- [`objectManipulation/unaryCollapse.ts`](./objectManipulation/unaryCollapse.ts) - single-target collapse; held-only -> **`unimplementedVerb`** Error.
- [`objectManipulation/buildPrompt.ts`](./objectManipulation/buildPrompt.ts) - identity vs complexity prompt builders; membership context on complexity stage only.
- [`objectManipulation/interpretAndFinalize.ts`](./objectManipulation/interpretAndFinalize.ts) - complexity-stage JSON validation and **`finalizeComplexityFromEnrich`**.
- [`objectManipulation/resolveObjectSpan.ts`](./objectManipulation/resolveObjectSpan.ts) - deterministic catalog grounding (**D5** / **D7**).
- [`objectManipulation/cardinalityGate.ts`](./objectManipulation/cardinalityGate.ts) - deterministic **`multiObject`** short-circuit when **`rawObjectSpans.length > 1`** (membership path only).
- [`objectManipulation/membershipObservation.ts`](./objectManipulation/membershipObservation.ts) - **`getMembershipContainers`** + sole-host **`getPositionGraph`**; edge-touch predicate.
- [`objectManipulation/membershipFrame.ts`](./objectManipulation/membershipFrame.ts) - **`MembershipManipulationFrame`** type and builder (classify **`verbClass`** + enrich context; **`compileMembershipAtomic`** input).
- [`objectManipulation/complexityPreGates.ts`](./objectManipulation/complexityPreGates.ts) - complexity pre-gate evaluator (rules 0--3).
- [`objectManipulation/complexityClasses.ts`](./objectManipulation/complexityClasses.ts) - shared **`complexityClass`** guards and terminal Error copy (**`multiPresent`**, etc.).

### Object manipulation enrich sequence

```text
relational route? (expanded prepositions in command)
  -> yes: frame extract LLM -> normalizeRelationSpan -> compileRelationalStub -> Error (nesting defer or B3+ EstablishRelation)
  -> no: cardinality gate
       -> multiObject Error OR compileMembershipAtomic
            -> merge catalogs (room + held; held fetched at parse ingress, not classify)
            -> identity stage (deterministic resolve; identity LLM on NoMatch/AmbiguousMatch)
            -> unary collapse
            -> membership observation
            -> complexity pre-gates
            -> agreement gate (verbClass vs operationKind) on atomic path
            -> atomic takeHold/drop short-circuit OR complexity LLM + finalize
```

**Distinction:** Relational preposition route uses **frame extract** (dedicated hop). Membership defer when exit edges touch the object still uses **complexity LLM** and may return **`relationalPlacement`** --- separate from the frame-extract path.

## Notes

- **Thinking:** lifecycle owner **`enrichAcmeOrder`**; steady-state keys, **`verbose`**, and failure **`errorCode`** mapping: **Acme order enrich thinking** in [`../thinking/AGENT.md`](../thinking/AGENT.md). **`parseCommandCore`** forwards **`ParseCommandDeps.messageBus`** only (no duplicate lifecycle).
- Avoid importing `parseCommand` from enrich modules to prevent orchestration cycles.
- Shared pure helper types may live under `actions/enrich/` if future enrich branches need common contracts.
- **Tests:** unit helpers in [`acmeOrder/acmeOrderThinkingPersistence.test.ts`](./acmeOrder/acmeOrderThinkingPersistence.test.ts); end-to-end **`parseCommand` + `messageBus`** wiring in [`../parseCommand.test.ts`](../parseCommand.test.ts) (**`parseCommand Acme enrich thinking (messageBus)`**).
