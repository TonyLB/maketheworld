# Object and Character as first-class render hosts (iteration 10)

**Status:** Scoped through conversation 2026-08-02, not started.

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
- **`assetWirePolicy`'s Object rejection is a transitional gap, not a boundary to defend.** [`assetWirePolicy.ts`](../../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts) rejects `<Object>` in asset mode entirely. That gate can stay closed for this iteration (improvisation-pair prose doesn't route through asset mode), but it should not be treated as load-bearing architecture --- it closes when Object authoring lands.

## Explicit non-goals

- **Referent resolution.** Catalog population (`positionGraph.characterIds` scanning) is *not* here --- see "Deferred, not rung-sized" on the ladder. Note this means a `look <character>` **text command still won't resolve** after this iteration: it will have something to render and no way to name it. Trusted-UI clicks bypass that, which may be the cheaper first proof.
- **A state axis** (multiple situations per component, world-actions changing state).
- **Render-time generation** for these kinds.
- **Trusted-UI object/character clicks** (`routeTrustedUiAction.ts`'s guard) --- one-line change, tracked separately.

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

- [ ] **Phase 1. Situation facets on `StandardObject` and `StandardCharacter` (`mtw-wml`).**
  - [ ] Add `_situations`/`SituationProseFacetList` support to both standardize classes and their `dataTypes/` shapes, mirroring [`feature.ts`](../../../../../packages/mtw-wml/ts/standardize/components/feature.ts). Both are additive --- neither kind has any facet support today.
  - [ ] Confirm the WML content model admits the facet children for both tags, and that round-tripping holds (the `ephemeraWire` integration tests in `object.ephemeraWire.integration.test.ts` are the precedent).
  - [ ] Decide whether `assetWirePolicy` changes at all this phase (default: **no** --- leave Object asset-mode-rejected; the prose path for Object is the improvisation pair, not an asset file).
- [ ] **Phase 2. Widen the example-assembly host gate (`mtw-gateways`).**
  - [ ] `isCacheHostEphemeraId` + `validateAssembleComponentExamplesInput` admit `OBJECT#` and `CHARACTER#`.
  - [ ] Set per-kind `resolveRoomLensMarkDefaults: false` for both (the option already defaults false for Feature/Knowledge per A4 --- Object/Character join that group, which is what keeps `markState` empty).
  - [ ] Verify `assemble` composes correctly over `ASSET#IMPROVISATION` merge participation for an improvisation Object.
- [ ] **Phase 3. Character as a render-cache host (`lambda/ephemera`).**
  - [ ] Widen `EphemeraCacheComponentId` / `RenderComponentId` for `CHARACTER#` --- **all three declaration sites**, including the `mtw-gateways` twin.
  - [ ] Add the Character branch to `intakeCacheOnlyHost` (hardcoded `markState: []`, `allowGeneration: false`).
  - [ ] New `characterDescription` thread kind, `characterRenderWmlFromCacheRecord.ts`, and the `handleCharacter*` fan-in trio --- mirror the Feature/Object trio (single viewer, no `directResponse`).
  - [ ] Perspective resolution: decide the analogue of [`prepareObjectRenderForCharacter.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/prepareObjectRenderForCharacter.ts)'s "acting character's current room" rule for a character target.
  - [ ] `presentStepSequence` stops throwing on `referentKind: 'character'`; `handleLookCommandRequestedForRenderOrchestration.ts` gains a fifth branch.
  - [ ] **Client is largely already built** --- `CharacterDescription`, `isPerceptionCharacterMetaData`, and both dispatch tiers exist. Verify rather than build; extend `CharacterDescription` for facet prose if it should show more than a name.
- [ ] **Phase 4. Retire the Object stub.**
  - [ ] Once Phases 1--2 land, Object rides the real `ensureAuthoredCatalog`; delete `ensureObjectShortNameCacheRecord.ts` and its injection at `orchestrateRenderRequest`'s `ensureAuthoredCatalog` seam.
  - [ ] Confirm the U+2060 placeholder in [`objectRenderWmlFromCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts) is still needed (it guards `<Object>`'s non-empty-`ShortName` content-model rule, which is independent of prose) --- **expected: keep it.**
  - [ ] Update the durable Object-description policy in [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md#correlated-object-description-policy), which currently documents the stub as deliberate.
- [ ] **Phase 5. Spawn-time `DEFAULT` generation for Object (separable follow-on).**
  - [ ] Coyote/Acme spawn generates a `DEFAULT` situation prose slice and writes it to the improvisation pair row (the merge body, already documented as carrying "future WML fields" in [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)).
  - [ ] Only meaningful once Phase 1 gives Object somewhere to put it; can ship well after Phases 1--4.

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to implement upcoming slices. When one ships, record it in the relevant `AGENT.contract.md` / `AGENT.implementation.md` and remove the row.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| RH-1 | Character perspective rule --- what asset stack does a character-directed look resolve against? Object uses the *acting* character's current room; a character target could use the target's room, the actor's room, or the target's own asset participation | Phase 3 | Open |
| RH-2 | Does `CharacterDescription` (client) render facet prose, or stay name-only? It is currently name-only and throws on non-Character metaData | Phase 3 | Open --- decide once there is real prose to show |
| RH-3 | Does `assetWirePolicy` open for `<Object>` in this iteration, or stay closed until Object authoring proper? Default assumption: **stays closed** | Phase 1 | Open, low stakes |
| RH-4 | Ordering vs. referent resolution --- after this iteration a `look <character>` text command still cannot resolve (no catalog population). Do we prove Character end-to-end via a trusted-UI click first, or wait for the catalog rung? | None (sequencing only) | Open |

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
| Phase 1 (WML situation facets on Object/Character) | Not started |
| Phase 2 (gateway host-gate widening) | Not started |
| Phase 3 (Character as render-cache host) | Not started |
| Phase 4 (retire the Object stub) | Not started |
| Phase 5 (spawn-time DEFAULT generation) | Not started, separable |
