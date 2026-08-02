# Object and Character as first-class render hosts (iteration 10)

**Status:** Scoped through conversation 2026-08-02. Phase 1 (mtw-wml situation facets), Phase 2 (mtw-gateways host-gate widening), and Phase 3 (Character as a render-cache host, `lambda/ephemera`) all shipped 2026-08-02. Phases 4--5 not started.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Ladder position: [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), iteration 10.

## Purpose

Perception commands can't be finished on Object or Character today, for two different reasons that share one root cause.

**Object** reaches the player, but only as a short name. Its content arrives through [`ensureObjectShortNameCacheRecord`](../../../../../lambda/ephemera/dataSource/renderCache/ensureObjectShortNameCacheRecord.ts) --- a deliberate, signature-matched drop-in standing in for the real [`ensureAuthoredCatalog`](../../../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts) (shipped as iteration 9's PK-6 stub). **Character** doesn't reach the player at all: it isn't in `EphemeraCacheComponentId`, and [`presentStepSequence`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/presentStepSequence.ts) throws on `referentKind: 'character'`.

The root cause is one gate: **[`componentExamples/input.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/input.ts)'s `isCacheHostEphemeraId` is `ROOM# | FEATURE# | KNOWLEDGE#` only**, and `validateAssembleComponentExamplesInput` throws on anything else. The example-assembly pipeline structurally rejects both kinds at its input, which is *why* Object needed a bespoke stub rather than merely lacking prose.

The pipeline itself generalizes: `assemble` works over `mergeParticipationOrder`, and improvisation objects already participate in merge via `ASSET#IMPROVISATION`. So this is an id-gate widening plus facet-shape work, **not** a new pipeline.

This iteration gives Object and Character situation-facet prose (the `<Example>`-authored `DEFAULT` slice) exactly as Room/Feature/Knowledge have it, and routes both through the real render-cache path.

## Design decisions (confirmed through conversation, 2026-08-02)

- **Structures first, state axis later.** `markState` stays hardcoded `[]` in [`intakeCacheOnlyHost`](../../../../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts), `SITUATION#DEFAULT`-only per **D9**, one render slot per component. This is a deliberate landing place, not a limitation to apologize for --- the representational and world-action complexity of tracking *different states* on an Object is a separate, later iteration.
- **`allowGeneration` stays `false`.** Generation is explicitly **not** deferred as a concept --- generating a `DEFAULT` example at Coyote-spawn time is a desirable content source. But that is *spawn-time* generation writing prose to the improvisation pair row, which then participates in merge and hydrates through the ordinary authored-catalog path. The content is authored-equivalent by render time, so the *render-time* generation path (`allowGeneration`, the thing Room uses for non-authored mark states) is untouched. Do not conflate the two.
- **Authored vs. generated is orthogonal to component kind, and the current split is transitional.** Objects are improvisation-spawned today and Characters are authored today, but Objects are destined for authoring and Characters can already be generated (Guest characters). Do **not** build kind-specific provenance assumptions into the facet shape --- the WML work is symmetric for both kinds, and only the *source* of the prose differs per case.
- **`assetWirePolicy` opens for `<Object>` in this iteration (RH-3).** [`assetWirePolicy.ts`](../../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts) currently rejects `<Object>` in asset mode entirely; that rejection was never load-bearing architecture, just a gap ahead of Object authoring. This iteration opens the gate to accept `<Object>` description/examples in asset mode.

## Explicit non-goals

- **Referent resolution.** Catalog population (`positionGraph.characterIds` scanning) is *not* here --- see "Deferred, not rung-sized" on the ladder. Note this means a `look <character>` **text command still won't resolve** after this iteration: it will have something to render and no way to name it. Trusted-UI clicks bypass that, which may be the cheaper first proof.
- **A state axis** (multiple situations per component, world-actions changing state).
- **Render-time generation** for these kinds.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and this ladder's index ([`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md)).
2. Read the **shipped** Feature/Knowledge path, which is the model to copy at every layer: [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md#correlated-feature--knowledge-description-policy), [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md), and the Object stub's own contrasting policy ([`perception/AGENT.md` --- Correlated Object description](../../../../../lambda/ephemera/dataSource/perception/AGENT.md#correlated-object-description-policy)).
3. Read [`components/feature.ts`](../../../../../packages/mtw-wml/ts/standardize/components/feature.ts)'s `_situations`/`SituationProseFacetList` handling --- the facet shape Object/Character need --- against [`components/object.ts`](../../../../../packages/mtw-wml/ts/standardize/components/object.ts) and [`components/character.ts`](../../../../../packages/mtw-wml/ts/standardize/components/character.ts), which have none today.
4. Read [`componentExamples/input.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/input.ts) (the gate) and [`assemble.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/assemble.ts) (what it gates).
5. **Note `EphemeraCacheComponentId` is duplicated across a package boundary** --- [`renderCache/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts), [`messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts), and its twin [`packages/mtw-gateways/ts/ephemera/renderCache/types.ts`](../../../../../packages/mtw-gateways/ts/ephemera/renderCache/types.ts). PK-6 hit this; widen in lockstep.
6. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); for `mtw-wml`, [`AGENT.testing.mtw-wml-typescript.md`](../../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). **All four affected packages run Jest** (`npm run test`), unlike `charcoal-client` (Vitest).
7. Baseline (should pass before edits):

```bash
cd packages/mtw-wml && npm run test -- --watchAll=false standardize/components/
cd packages/mtw-gateways && npm run test -- --watchAll=false componentExamples
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/renderCache/ dataSource/renderOrchestration/ dataSource/perception/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines as each sub-step lands. Nothing below is built yet.

- [X] **Phase 1. Situation facets on `StandardObject` and `StandardCharacter` (`mtw-wml`).** Done 2026-08-02.
  - [X] Add `_situations`/`SituationProseFacetList` support to both standardize classes and their `dataTypes/` shapes, mirroring [`feature.ts`](../../../../../packages/mtw-wml/ts/standardize/components/feature.ts). Both are additive --- neither kind has any facet support today.
  - [X] Confirm the WML content model admits the facet children for both tags, and that round-tripping holds (the `ephemeraWire` integration tests in `object.ephemeraWire.integration.test.ts` are the precedent). Object's schema-layer `typeCheckContents`/`finalize` (`schema/converters/components.ts`) were relaxed to admit `<Situation>` alongside the required `<ShortName>`; Character's converter was already unrestricted. `<Render>`'s parent whitelist was deliberately left untouched for both kinds (deferred; see [`AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) `StandardObject`/`StandardCharacter` entries) --- the `render` field exists at the data/standardize layer for JSON/ephemera-wire construction, but `<Render>` cannot yet be authored under `<Object>`/`<Character>` via WML text.
  - [X] Fixed pre-existing gap found while widening the gate: Object's `finalize` matched `ShortName` by direct tag equality only, so `<Replace><ShortName>.../</Replace><With><ShortName>.../</With>` editing of Object's shortName --- which every other component supports --- threw "Object tag must contain exactly one ShortName child". Now uses `splitTaggedChildren` (Remove/Replace-aware), matching the standardize layer's own matcher.
  - [X] Open `assetWirePolicy` to accept `<Object>` description/examples in asset mode (RH-3, resolved).
- [X] **Phase 2. Widen the example-assembly host gate (`mtw-gateways`).** Done 2026-08-02.
  - [X] `isCacheHostEphemeraId` + `validateAssembleComponentExamplesInput` admit `OBJECT#` and `CHARACTER#`.
  - [X] Set per-kind `resolveRoomLensMarkDefaults: false` for both (the option already defaults false for Feature/Knowledge per A4 --- Object/Character join that group, which is what keeps `markState` empty). No source change needed: `defaultResolveRoomLensMarkDefaults` is already `isEphemeraRoomId`-only; verified by test, not implemented.
  - [X] Verify `assemble` composes correctly over `ASSET#IMPROVISATION` merge participation for an improvisation Object. Also widened `isCacheHostWithSituationFacets` in [`perspectives.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/perspectives.ts) --- not named in the original bullet list but load-bearing: without it, an Object/Character host passes the `input.ts` gate and then silently assembles an empty set.
- [X] **Phase 3. Character as a render-cache host (`lambda/ephemera`).** Done 2026-08-02.
  - [X] Widen `EphemeraCacheComponentId` / `RenderComponentId` for `CHARACTER#` --- **all three declaration sites**, including the `mtw-gateways` twin. Done 2026-08-02. Also fixed four guard sites that were still `Room|Feature|Knowledge`-only and so silently excluded `OBJECT#` too (a Phase 2 gap, not just a Character one): `parseSituationAdjacencyDataCategory` and `isEphemeraCacheCatalogRow` in both `renderCache/baseClasses.ts` and its `mtw-gateways` twin, plus `asCacheHostId` in `renderCache/handleExampleInvalidated.ts` and `isEphemeraCacheComponentId` in `perception/localApiEvents.ts`. Fixed alongside Character since the edits are the same lines --- not scope creep, just closing a gap in-place. Also updated two pre-existing unit tests (`renderOrchestration/events.test.ts`, `renderOrchestration/publishedEvents.test.ts`) that had asserted `CHARACTER#` componentIds were *rejected* as render-host/outbound ids; that was exactly the invariant this widening intentionally changes, so those assertions were stale, not regressions.
  - [X] Add the Character branch to `intakeCacheOnlyHost` (hardcoded `markState: []`, `allowGeneration: false`). Done 2026-08-02 --- `intakeCacheOnlyHost` itself needed no change (already generic over the cache-only union); only `CacheOnlyComponentId` and `isCacheOnlyHost` in `requestIntake.ts` needed `EphemeraCharacterId`/`isEphemeraCharacterId` added.
  - [X] New `characterDescription` thread kind, `characterRenderWmlFromCacheRecord.ts`, and the `handleCharacter*` fan-in trio --- mirror the Feature/Object trio (single viewer, no `directResponse`). Done 2026-08-02: added [`characterRenderWmlFromCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/perception/characterRenderWmlFromCacheRecord.ts) (Feature/Knowledge-shaped, real `<Render>` prose --- Character has a `render` facet, unlike Object's shortName-only stub) and `handleCharacterRenderPertains`/`handleCharacterGenerationStarted`/`handleCharacterOrchestrationErrorOrDeferred` in `orchestrate.ts`, structurally mirroring the Object trio (single-kind guard, no discriminated-union narrowing). **Discovered blocker, fixed in the same change set:** `packages/mtw-wml/ts/schema/converters/components.ts`'s `Render.initialize` parent whitelist (`Room`/`Feature`/`Knowledge` only) predates this phase and does not include Character, even though `StandardCharacterData.render` has existed since Phase 1 for JSON/ephemera-wire construction --- Phase 1's own notes flagged this as deliberately deferred ("`<Render>` cannot yet be authored under `<Object>`/`<Character>` via WML text"), but the deferral didn't anticipate that Character's render-cache WML *builder* (this bullet) needs the emitted WML to actually reparse, not just construct. Added `isSchemaCharacter` to the whitelist; Object's own entry remains deferred since Object still has no real render path to exercise it.
  - [X] Perspective resolution (RH-1, resolved and now implemented): a character-directed look resolves against the *acting* character's own asset stack --- the same stack used for everything else that character perceives. Implemented in [`prepareCharacterRenderForCharacter.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/prepareCharacterRenderForCharacter.ts) (new file, 2026-08-02), which reuses `loadCharacterVisibleAssetIds` (exported from `prepareFeatureKnowledgeRenderForCharacter.ts`) directly --- no room lookup, no import-vertical intersection, since there is no target-room-vs-actor-room choice to make. `prepareObjectRenderForCharacter.ts`'s docstring was left as-is (out of scope for this pass; it accurately describes Object's own room-owned mechanism, which is unrelated to Character's).
  - [X] `presentStepSequence` stops throwing on `referentKind: 'character'`; `handleLookCommandRequestedForRenderOrchestration.ts` gains a Character branch. Done 2026-08-02: removed the throw, widened `LookCommandRequestedPublishedPayload.componentId` (and its guard) in `actions/publishedEvents.ts` to admit `EphemeraCharacterId`, and added a Character branch to `handleLookCommandRequestedForRenderOrchestration.ts` using the real `ensureAuthoredCatalog` (no override, unlike Object's stub swap) since Character is an "authored" cache-only kind, not a shortName stub.
  - [X] `routeTrustedUiAction.ts`'s guard admits Character --- needed for RH-4's end-to-end proof via trusted-UI click. Done 2026-08-02. **Scope correction found during implementation:** the guard was never "Room/Feature/Knowledge/Object minus Character" --- Object was never admitted either (it routes look separately, through Bedrock-parsed `matchLookTemplate`/`executeStepSequence`, not this trusted-UI guard). So this widened `routeTrustedUiAction.ts`'s `look` case alongside Object's continued absence, not into an Object-inclusive list. The guard's downstream type, `ParseCommandLookComponentResult` (`actions/baseClasses.ts`), is shared with the Bedrock-parsed object-directed look path, so this touched 3 places, not 1: the switch-case guard, the shared type's `componentId` union, and its runtime guard `isParseCommandLookComponentResult`. Also found and fixed a latent gap one layer up: `packages/mtw-interfaces/ts/ephemera.ts`'s `ActionAPILookMessage.EphemeraId` was typed `Room | Feature | Map` only --- missing Knowledge, even though `routeTrustedUiAction.ts` already accepted Knowledge at runtime. Widened to admit Knowledge and Character together (same-line fix, not scope creep). `actions/index.ts`'s look-dispatch needed no change --- its generic `else` branch already streams `Look Command Requested` for any non-Object componentId.
  - [X] **Client** --- `CharacterDescription`, `isPerceptionCharacterMetaData`, and both dispatch tiers verified working as-is (no change needed to `Message/index.tsx`'s routing, only to add `onClickLink` prop-threading once `CharacterDescription` grew a description body with links). Extended `CharacterDescription.tsx` to render facet prose (RH-2, resolved and now implemented): reused `ComponentDescription.tsx`'s established `resolveFeatureKnowledgeProse`/`Divider`+`RenderTreeContent` pattern via a parallel `resolveCharacterProse` helper, since `StandardCharacter.render`/`.situations` are structurally identical to `StandardFeature`/`StandardKnowledge`. Done 2026-08-02.
- [ ] **Phase 4. Retire the Object stub.**
  - [ ] Once Phases 1--2 land, Object rides the real `ensureAuthoredCatalog`; delete `ensureObjectShortNameCacheRecord.ts` and its injection at `orchestrateRenderRequest`'s `ensureAuthoredCatalog` seam.
  - [ ] Confirm the U+2060 placeholder in [`objectRenderWmlFromCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts) is still needed (it guards `<Object>`'s non-empty-`ShortName` content-model rule, which is independent of prose) --- **expected: keep it.**
  - [ ] Update the durable Object-description policy in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md#correlated-object-description-policy), which currently documents the stub as deliberate.
- [ ] **Phase 5. Spawn-time `DEFAULT` generation for Object (separable follow-on).**
  - [ ] Coyote/Acme spawn generates a `DEFAULT` situation prose slice and writes it to the improvisation pair row (the merge body, already documented as carrying "future WML fields" in [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)).
  - [ ] Only meaningful once Phase 1 gives Object somewhere to put it; can ship well after Phases 1--4.

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to implement upcoming slices. When one ships, record it in the relevant `AGENT.contract.md` / `AGENT.implementation.md` and remove the row.

None open. RH-1 through RH-4 all shipped 2026-08-02 (RH-1: `renderOrchestration/AGENT.md`'s Key Concepts; RH-2: `CharacterDescription.tsx` now renders facet prose; RH-3: `assetWirePolicy.ts` opened for `<Object>` in Phase 1; RH-4: proven via `routeTrustedUiAction.ts`'s trusted-UI Character-look path).

## Verification

```bash
cd packages/mtw-wml && npm run test -- --watchAll=false standardize/
cd packages/mtw-gateways && npm run test -- --watchAll=false
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/renderCache/ dataSource/renderOrchestration/ \
  dataSource/perception/ dataSource/positions/manipulation/kernel/
cd lambda/ephemera && npx tsc --noEmit
cd packages/mtw-gateways && npx tsc --noEmit
```

Plus end-to-end: a `look` at an Object with authored/generated `DEFAULT` prose renders that prose (not just the short name), and a Character look renders at all.

## Progress

| Milestone | Status |
| --- | --- |
| Scope + design confirmed through conversation | Done (2026-08-02) |
| Phase 1 (WML situation facets on Object/Character) | Done (2026-08-02) |
| Phase 2 (gateway host-gate widening) | Done (2026-08-02) |
| Phase 3 (Character as render-cache host) | Done (2026-08-02) |
| Phase 4 (retire the Object stub) | Not started |
| Phase 5 (spawn-time DEFAULT generation) | Not started, separable |
