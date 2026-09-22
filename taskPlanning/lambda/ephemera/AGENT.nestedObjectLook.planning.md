# Nested object look: render an object's hosted contents on `look <object>`

**Status:** Not started, seeded 2026-09-22. This plan exists because the WML wire-alignment work for `ludicGraph` (`AGENT.componentLudicGraphAlignment.planning.md`, shipped and deleted 2026-09-21) was explicitly done as a foundation for this capability, and left forward-pointing notes in [`positions/AGENT.ludicNetwork.md`](../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md), [`perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md), and [`affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md) rather than a tracked row. This file is that row.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Why this initiative exists

**The payoff, stated once:** after `put cup on table`, `look table` shows the cup. Today `StandardObjectData.ludicGraph` exists on the wire (shipped) but `objectRenderWmlFromCacheRecord.ts` never populates it, so an object's own hosted shard --- the whole reason `On`-hosting (`CD2h`, [`AGENT.abstractionLayers.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order)) physically moves the cup into the table's own graph --- is invisible at the one layer a player interacts with.

**Two gaps, not one, and they are independent:**

1. **Delivery.** No producer reads an object's own hosted `ludicGraph` shard and writes it into the `StandardObjectData` row perception serializes. This is additive: the field, the type, and the wire round-trip already exist.
2. **Invalidation.** `renderCache`'s `Cache::${perspectiveKey}` catalog rows bump on authored blueprint edits ([`handleExampleInvalidated.ts`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts)) but nothing bumps them when `Object Moved` changes what a container physically holds. Until gap 1 ships this is latent (nothing reads nested contents, so nothing can go stale); once gap 1 ships, a cached `look table` can serve a table that no longer has the cup, or does have it and did not before.

**Scope decided 2026-09-22: this plan covers `On`, `In`, and `PartOf`.** `CD4` in `AGENT.abstractionLayers.planning.md` (re-enabling `On` authoring) remains a separate row, owned there, not here --- but this plan takes on the analogous authoring work for `In`/`PartOf`, since nothing else currently tracks it.

**Correcting a premise `CD2h`'s own row still carries as of 2026-09-22: the hosting *mechanism* is not `On`-only.** Tracing the code (not just the task-plan text) for this plan found that the later `mutationStack` refactor (shipped through 2026-09-09) generalized `compilePositionKernelOp`'s `containment` field to `'On' | 'In' | 'PartOf'` throughout the whole chain --- `executeMembershipTransfer`, `orchestrateObjectMove`, `buildObjectMoveOp`, `planObjectMoveTransfer` all already accept and correctly execute any of the three kinds; a caller passing `containment: 'In'` today would work. `CD2h`'s "`In`/`PartOf` remain open" note pre-dates that refactor and is stale on this specific point --- flag it there when this plan's Phase 5 lands (see below).

**What is actually still missing for `In`/`PartOf` is narrower: authoring, not hosting.** Two independent gaps, both at the ingress layer, confirmed directly in code:

- **`In` has a recognized phrase but a hard-error route.** [`normalizeRelationSpan.ts`](../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/normalizeRelationSpan.ts) already maps `in`/`inside`/`into` to `nestingDeferKind: 'In'`, and [`classifySkeletonFamily.ts`](../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/classifySkeletonFamily.ts) forwards it as `{ type: 'relationalDefer', kind: 'In', ... }`. But [`parseCommand.ts:93`](../../../lambda/ephemera/dataSource/actions/parseCommand.ts#L93) only routes `family.kind === 'On'` into `compileObjectRehostFromSkeleton`; every other kind --- `In` included --- returns `relationalErrorMessages.nestingRelational`, an explicit "not supported" error. And [`compileObjectRehostFromSkeleton.ts:106`](../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileObjectRehostFromSkeleton.ts#L106) hardcodes `containment: 'On'` rather than forwarding the matched kind, so even a caller that reached it would lose the distinction.
- **`PartOf` has no player phrase at all.** No entry in `normalizeRelationSpan.ts` maps any span to `'PartOf'` --- this is a genuine vocabulary question ("attach the strap to the bag"? "make the strap part of the bag"?), not a wiring gap like `In`'s.

## What already exists to build on

1. **The wire shape, shipped.** [`StandardObjectData.ludicGraph`](../../../packages/mtw-wml/ts/standardize/components/dataTypes/object.ts) is `StandardLudicGraphData` (`{ rootId?, nodes?, edges?, ports? }`, [`ludicGraph.ts`](../../../packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts)). `nodes` is `LudicGraphNodeListData` --- a list of `StandardReferenceData` component references (plus a `Presence` arm not relevant here). This is a **references** list, not embedded content: rendering the cup means resolving the referenced node's own shortName, not walking a subgraph inline.
2. **The delivery row.** [`objectRenderWmlFromCacheRecord.ts`](../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts) builds `StandardObjectData` today with `tag`/`universalKey`/`shortName`/`render` only. Adding `ludicGraph` is a fourth field on the same object literal, per the note left in [`perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md) --- "not a new delivery channel."
3. **The ephemera-side source.** [`EphemeraLudicGraphCacheData.getLudicGraph`](../../../lambda/ephemera/internalCache/ludicGraphCache.ts#L49) reads a host's own hosted shard. `objectRenderChannelWmlForObjectId`/`objectRenderWmlFromCacheRecord` will need this injected the way `renderCache`/`RenderCacheContext` are already threaded through the perception call chain --- check the existing call sites before adding a new parameter shape.
4. **ShortName resolution for referenced nodes.** [`resolveObjectShortName`](../../../lambda/ephemera/dataSource/objects/objectShortName.ts#L45) is the existing live-resolve path `objectRenderWmlFromCacheRecord.ts` already uses for the object's own name; a nested node's `StandardReferenceData` needs the same treatment, once per referenced node, not a new resolution mechanism.
5. **The invalidation precedent.** [`handleExampleInvalidated.ts`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts)'s component-scoped path is the shape to mirror: query `Cache::` catalog rows for a host, `conditionalInvalidateCatalogRow` each one. **Bump-only, no push** --- [`affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md#mtwephemerapositions-object-moved)'s own note is explicit that Object is a pull kind and this must not extend the room-scoped push pipeline (`fanOutAffordanceRefreshForRoom`), which is the wrong mechanism here.
6. **The Object Moved event today is room-filtered, not object-filtered.** [`roomsAffectedByObjectMoved.ts`](../../../lambda/ephemera/dataSource/affordanceOrchestration/roomsAffectedByObjectMoved.ts) reduces `froms`/`to` down to `EphemeraRoomId`s only, for the affordance push fan-out. The renderCache bump needs the complementary reduction --- `froms`/`to` down to `EphemeraObjectId`s (and, since hosting is not Object-exclusive, potentially `EphemeraFeatureId`/`EphemeraCharacterId` hosts too) --- as a **new, separate** filter feeding the bump path, not a widening of the existing room filter.
7. **Client rendering, already unstubbed for prose.** [`charcoal-client/src/components/Message/AGENT.md`](../../../charcoal-client/src/components/Message/AGENT.md#object-descriptions) --- Object look already renders `shortName` + `<Render>` prose via `ComponentDescription`/`resolveComponentProse`. Nested contents are a **new** section on that same component, not a new dispatch path.
8. **Referent search already reaches inside hosted objects** --- `CC3` (`AGENT.abstractionLayers.planning.md`) landed 2026-08-19, so a player can already refer to a hosted cup by name in commands. This plan is about *display*, not referent resolution; do not re-litigate `CC3`'s territory. **Unverified assumption to confirm in Phase 1, not re-derive:** `CC3` was written against `On`-hosting only (the only kind live at the time). Confirm it reads the graph generically (by physical presence in the shard) rather than filtering on relation kind, since if it does not, a hosted `In`/`PartOf` member could be renderable by this plan's Phase 1 yet unreachable by referent search --- a real gap, and `CC3`'s territory, not this plan's, to fix if found.
9. **The kernel-side authoring mechanism is already kind-generic** (see "Why this initiative exists" above) --- `compilePositionKernelOp`'s `containment` field and everything downstream of it. What Phase 4 below adds is ingress routing and, for `PartOf`, vocabulary --- not new mutation machinery.

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md) --- `npm run test -- --watchAll=false`, not `npm test`, from `lambda/ephemera`. Client-side work follows `charcoal-client`'s own testing doc (see [`charcoal-client/AGENT.development.md`](../charcoal-client/AGENT.development.md) if present, otherwise the nearest `AGENT.md` testing section).

**Inherited hazard:** `lambda/ephemera`'s `*.integration.test.ts` files sit outside the tsconfig include and mock by path, so `npx tsc --noEmit` cannot catch a break there --- run the full Jest suite after any rename, not just `tsc`.

Baseline (should pass before edits, from `lambda/ephemera`):

```bash
npm run test -- --watchAll=false \
  dataSource/perception/ \
  dataSource/renderCache/ \
  dataSource/affordanceOrchestration/ \
  internalCache/ludicGraphCache.test.ts
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes. Nothing below is built yet, so all lines start `[ ]`.

- [ ] **Phase 1. Delivery: populate `StandardObjectData.ludicGraph`, one level, all hosted kinds.** Nesting depth decided (ND-1: one level --- `look table` shows "cup," not "cup (containing a spoon)"; a second `look` reaches the next level, matching how referent search already surfaces things incrementally).
  - [ ] Thread `EphemeraLudicGraphCacheData` (or its already-injected equivalent) into `objectRenderChannelWmlForObjectId`/`objectRenderWmlFromCacheRecord`, read the object's own hosted shard, map its nodes to `StandardReferenceData` entries. Do **not** filter by relation kind --- `getLudicGraph` reads physical presence in the shard, which is kind-agnostic by construction (a node is there or it isn't); read whatever it returns.
  - [ ] Confirm the `CC3` assumption in "What already exists" item 8 --- does referent search's graph read filter by kind anywhere? If it does, that is a pre-existing `CC3` gap this phase's own testing will surface (an `In`-hosted fixture visible to this plan's render but not to referent search), not something to silently work around here.
  - [ ] Resolve each referenced node's shortName via `resolveObjectShortName` (or the sibling resolver for non-Object hosted kinds), matching the existing single-object resolution pattern rather than inventing a batch API unless N+1 reads prove a real cost.
  - [ ] Unit tests: empty hosted graph (field omitted, not a placeholder), one hosted object under each of `On`/`In`/`PartOf` (construct the fixture directly via the kernel --- `executeMembershipTransfer`'s `containment` argument already accepts all three --- rather than waiting on Phase 4's player-facing authoring).
- [ ] **Phase 2. Invalidation: bump `Cache::` catalog rows on `Object Moved`, wired from `affordanceOrchestration`.** Location decided (ND-3: `affordanceOrchestration`'s existing `Object Moved` handler, not a new `renderCache` subscription --- keeps one producer of "something reacted to `Object Moved`," matching how that handler already owns both room-scoped push and this bump as sibling effects of the same event).
  - [ ] Write the object/feature/character-host analog of `roomsAffectedByObjectMoved.ts` (a pure reducer, same shape, different id-kind filter --- reduces `froms`/`to` to non-Room hostable kinds instead of Room-only).
  - [ ] Wire it into the existing `Object Moved` case in `affordanceOrchestration`'s `index.ts` as an *additional* effect alongside (not inside) `fanOutAffordanceRefreshForRoom` --- two sibling effects of one event, not one absorbing the other.
  - [ ] Reuse `conditionalInvalidateCatalogRow`/`queryCatalogRowsForComponent` from `renderCache`, mirroring `handleExampleInvalidated.ts`'s component-scoped path exactly --- bump-only, no catalog row creation, no push. This is `affordanceOrchestration` taking a dependency on `renderCache`'s primitives, not the reverse --- confirm that direction is already legal (check existing imports) before wiring.
  - [ ] Unit/integration test: move an object into a container, confirm the container's `Cache::` `catalogVersion` bumps; move an object out, same; a room-only move (no object host involved) leaves object catalogs untouched.
- [ ] **Phase 3. Client: render nested contents in Object look.**
  - [ ] Extend `ComponentDescription` (or the Object-specific rendering it delegates to) to read `StandardObject.ludicGraph.nodes` and render referenced shortNames as a new section, mirroring the existing description-body pattern rather than introducing a separate component.
  - [ ] Empty/absent `ludicGraph` renders nothing extra --- no "Contents: (none)" placeholder, matching the existing "no prose" fallback discipline.
  - [ ] Component test: object with no nested contents, object with one, object with several.
- [ ] **Phase 4. Authoring: route `In` through to the mutation kernel. `PartOf` is explicitly out of scope (ND-4 below).**
  - [ ] Widen [`parseCommand.ts`](../../../lambda/ephemera/dataSource/actions/parseCommand.ts#L93)'s `family.kind === 'On'` check to also accept `'In'`, routing to `compileObjectRehostFromSkeleton` instead of `relationalErrorMessages.nestingRelational`.
  - [ ] Change `compileObjectRehostFromSkeleton.ts:106` to forward the matched `family.kind` as `containment` instead of hardcoding `'On'`.
  - [ ] Integration test per kind: `put cup on table` / `put ball in box` each produce a real hosted node, confirmed by Phase 1's own read path --- this is the point at which this plan's payoff test (below) can run without bypassing authoring.
  - [ ] `PartOf` fixtures for Phase 1/3's tests stay kernel-constructed (`executeMembershipTransfer`'s `containment: 'PartOf'`, direct call, no player command) --- there is no player-facing route to build one in this plan, per ND-4.
- [ ] **Phase 5. Durable docs, and retire this plan.** Correct `perception/AGENT.md`'s forward-note (it currently describes this as future work) to state what shipped; add the invalidation convention to `renderCache/AGENT.md` alongside `handleExampleInvalidated.ts`'s existing description; correct `affordanceOrchestration/AGENT.md`'s `Object Moved` section (its "still-open gap" framing becomes a description of what exists); update `charcoal-client/src/components/Message/AGENT.md`'s Object descriptions section; **correct `AGENT.abstractionLayers.planning.md`'s `CD2h` row** --- note that the hosting mechanism generalized to `In`/`PartOf` via the `mutationStack` refactor before this plan touched it, and that this plan closed the remaining ingress/authoring gap. Then delete this file.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement upcoming slices. When one ships, record it in the relevant `AGENT.contract.md`/`AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| ND-1 | Nesting depth shown on one `look`. | Phase 1, 3 | **Decided 2026-09-22: one level.** |
| ND-3 | Where the invalidation bump lives. | Phase 2 | **Decided 2026-09-22: `affordanceOrchestration`'s `Object Moved` handler.** |
| ND-4 | **Does `PartOf` get a fast-path player command in this plan?** | Phase 4 | **Decided 2026-09-22: no.** There is no deterministic phrase for `PartOf`, and per the user, there realistically shouldn't be one --- `PartOf` is expected to emerge from *reasoning* (abstracting a whole from its parts, or improvising parts of a whole), not from a fixed verb template like `On`/`In`. This matches a standing, contested prediction already in this initiative's corpus --- [**the relation-kind register**](../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md#the-relation-kind-register)'s note that *"improvisation licence attaches to `PartOf` and not to `In`"* (recorded as contested, not settled, against AB-45 and C17). `PartOf` authoring is therefore **not** this plan's job --- it belongs to whatever initiative eventually builds that reasoning-driven abstraction/improvisation path, tracked in `AGENT.abstractionLayers.planning.md`, not here. This plan reads and renders `PartOf` nodes (Phase 1/3) whenever one exists, by whatever means it got created; it does not create a way to create one. |

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false \
  dataSource/perception/ \
  dataSource/renderCache/ \
  dataSource/affordanceOrchestration/ \
  internalCache/ludicGraphCache.test.ts

# Full suite before marking a phase done --- integration tests are NOT covered by tsc
npm run test -- --watchAll=false

npx tsc --noEmit
```

Client-side, from `charcoal-client` (confirm exact command against that package's own testing doc before relying on this):

```bash
npm run test -- --watchAll=false src/components/Message/
```

Grep checks once Phase 1/2 land, from the repo root:

```bash
# ludicGraph should now be populated somewhere in the Object render path, not just typed
grep -rn "ludicGraph" lambda/ephemera/dataSource/perception/*.ts | grep -v "\.test\.ts"

# The bump-only invalidation path should call the same primitive handleExampleInvalidated.ts uses,
# not a hand-rolled catalog write
grep -rn "conditionalInvalidateCatalogRow" --include="*.ts" lambda/ephemera | grep -v node_modules | grep -v "\.test\.ts"
```

**Payoff test (per [`taskPlanning/AGENT.md`](../../AGENT.md)'s rule that a phase's test must terminate at the observable output):** after Phase 4 lands, an end-to-end integration test that issues the real player command (`put cup on table`), then asserts the **rendered `look table` output** --- not an intermediate `StandardObjectData` or cache row --- names the cup. Phase 1's own tests may construct the hosted fixture directly via the kernel ahead of Phase 4, but this plan is not done until the payoff test runs the real command.
