# `mtw.ephemera.actions/enrich`

## Role

`actions/enrich/` defines post-discrimination enrichment flows that transform intent-level parse outcomes into terminal `ParseCommandResult` payloads.

Current implementation:

- [`acmeOrder/`](./acmeOrder/) - enriches `AcmeOrderIntent` into terminal **`AcmeOrder`** lines (or **`ParseCommandErrorResult`** when the Coyote-wide object placement count exceeds the cap **before** any Acme enrich Bedrock call), including catalog validation details, affinity proposals, and **`stableKey`** proposals.
- [`objectManipulation/`](./objectManipulation/) - enriches **`ObjectMembershipIntent`** into terminal **`ObjectManipulation`** (v1 atomic **`takeHold`** / **`drop`**) or **`ObjectRelateIntent`** through the native Parse-skeleton pipeline (Parse -> Plan match -> Identify -> Grounding -> Validation, iteration 3) into terminal **`EstablishRelation`** or **`ParseCommandErrorResult`** (nesting defer, BD-10 legality defer stub, resolve failure, or Parse parse/invoke failure). **Hop-purpose narrative:** [`objectManipulation/AGENT.md`](./objectManipulation/AGENT.md).

## Boundary

- **Input:** an intent-level outcome from `discriminateIntent` plus original command/context (for example **`occupiedStableKeys`**, **`hostRoomId`**, and enrich-model responses).
- **Output:** terminal parse payloads (for example **`AcmeOrder`**, **`EstablishRelation`**, or **`Error`** when the placement cap rejects enrich) or pass-through behavior handled by **`parseCommand`** orchestration.
- **Ownership:** enrich modules should stay focused on enrichment/normalization logic; `parseCommand` remains the orchestrator deciding when enrichment runs.
- **Lane:** enrich is primarily **deterministic computation** (Plan match, resolve, legality, compile) after classify and Parse **semantic-reasoning** hops. **Trust:** shipped parse paths use **trusted-output** through terminal compile. See [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md).

## Current files

- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - placement-count guard, Bedrock **`invokeBedrockAcmeOrderEnrich`**, and wiring to **`finalizeAcmeOrderFromEnrich`**.
- [`acmeOrder/buildPrompt.ts`](./acmeOrder/buildPrompt.ts) - builds Bedrock enrich prompt parts (**core** + **iconic** few-shots; iconic omitted when **`includeIconicFewShots: false`**, e.g. affinities harness live enrich).
- [`acmeOrder/interpretAndFinalize.ts`](./acmeOrder/interpretAndFinalize.ts) - interprets enrich output and finalizes **`ParseCommandAcmeOrderResult`**.
- [`acmeOrder/acmeOrderThinkingPersistence.ts`](./acmeOrder/acmeOrderThinkingPersistence.ts) - bootstrap / emit / finalize helpers for segment **`acmeOrderEnrich`** (`mtw.ephemera.actions` **`Thinking Result`** publisher).
- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - orchestrates thinking lifecycle when **`EnrichAcmeOrderDeps.messageBus`** is set (see **Thinking** below).
- [`objectManipulation/index.ts`](./objectManipulation/index.ts) - routes by **`enrichRoute`** from classify intent type; membership path: cardinality gate then **`compileMembershipAtomic`**; relational path: **`compileRelationalFromSkeleton`** (native Parse-skeleton pipeline, iteration 3).
- [`objectManipulation/relationalRoute.ts`](./objectManipulation/relationalRoute.ts) - preposition detection helper (unit-tested; **not** primary enrich router after B2.5).
- [`objectManipulation/parse/`](./objectManipulation/parse/) - **Parse** hop (iteration 3): `runParseStage` emits a `ParseSkeleton` (`parseToken.ts`), `stampStableRefKeys.ts` stamps per-occurrence `stableRefKey`s, `objectSpansFromSkeleton.ts` projects to a flat span list for the membership adapter. Replaced the retired classify-`objectSpans` + frame-extract split.
- [`objectManipulation/plan/matchRelationalTemplate.ts`](./objectManipulation/plan/matchRelationalTemplate.ts) - deterministic Plan-stage matcher: `ParseSkeleton` -> role-tagged `Referent`s + **`operationKind`**/`relationKind` from closed `V NP prep NP` templates.
- [`objectManipulation/manipulationFrame.ts`](./objectManipulation/manipulationFrame.ts) - **`ManipulationFrame`** type; **`enrichRoute`** + **`hostRoomId`** + optional `parseSkeleton` on **`ManipulationFrameBuildInput`**. (`ManipulationFrame` itself is now used only by the unwired Phase C sandbox compiler `plan/compileUngroundedPlan.ts`; the frame-extract builder + `ManipulationFrameExtractModelResponse` were removed with the frame-extract retirement.)
- [`objectManipulation/embeddingMatch/`](./objectManipulation/embeddingMatch/) - embedding identity fast path (shipped): `resolveObjectSpanByEmbedding`, `decideEmbeddingMatch`, `rankCatalogByCosineSimilarity`, locked `thresholds.ts`; wired into [`identityStage.ts`](./objectManipulation/identityStage.ts) (and, for the relational route, [`identifySkeletonSpans.ts`](./objectManipulation/identifySkeletonSpans.ts)); catalog vectors attached at parse ingress via [`attachEmbeddingsToCatalogEntries.ts`](../attachEmbeddingsToCatalogEntries.ts). Span Bedrock embed: [`../../objects/embedding/embedObjectSpan.ts`](../../objects/embedding/embedObjectSpan.ts).
- [`objectManipulation/compileRelationalFromSkeleton.ts`](./objectManipulation/compileRelationalFromSkeleton.ts) - relational compiler (iteration 3): composes `matchRelationalTemplate` -> `identifySkeletonSpans` -> `groundChange` -> `filterLegalRelationalCandidates`, terminal **`EstablishRelation`** / **`Abstain`** / **`Error`**.
- [`objectManipulation/identifySkeletonSpans.ts`](./objectManipulation/identifySkeletonSpans.ts) - runs the shared `identityStage` resolver over the skeleton's `objectSpan` tokens (room + held catalog, BD-15/16 slice 4b), rekeyed onto `stableRefKey`.
- [`objectManipulation/evaluateRelationalLegality.ts`](./objectManipulation/evaluateRelationalLegality.ts) - BD-10 legality: observes host graph via read-only **`EphemeraPositionGraph`** import from [`positions/positionGraph/`](../../positions/positionGraph/); node-on-graph, idempotent duplicate, conflicting topology -> **`complexRelational`** Error stub.
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

Module-level flow and **what each hop is for** (Coyote-style): [`objectManipulation/AGENT.md`](./objectManipulation/AGENT.md). This file keeps the file inventory above; do not duplicate the conceptual flow here.

## Notes

- **Thinking:** lifecycle owner **`enrichAcmeOrder`**; steady-state keys, **`verbose`**, and failure **`errorCode`** mapping: **Acme order enrich thinking** in [`../thinking/AGENT.md`](../thinking/AGENT.md). **`parseCommandCore`** forwards **`ParseCommandDeps.messageBus`** only (no duplicate lifecycle).
- Avoid importing `parseCommand` from enrich modules to prevent orchestration cycles.
- Shared pure helper types may live under `actions/enrich/` if future enrich branches need common contracts.
- **Tests:** unit helpers in [`acmeOrder/acmeOrderThinkingPersistence.test.ts`](./acmeOrder/acmeOrderThinkingPersistence.test.ts); end-to-end **`parseCommand` + `messageBus`** wiring in [`../parseCommand.test.ts`](../parseCommand.test.ts) (**`parseCommand Acme enrich thinking (messageBus)`**).
