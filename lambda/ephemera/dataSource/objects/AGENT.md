*Status: **Shipped** --- bus-only **`mtw.ephemera.objects`**; first-class improvisation rows + **`ludicGraph`** placement; outbound **`Objects Changed`** is object-id existence (**I4**); placement-driven affordance refresh via **`mtw.ephemera.positions`** **`Object Moved`** -> **`mtw.ephemera.affordanceOrchestration`**; terminal **`PublishMessage`** via **`Affordances Pertain`** -> [`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts).*

## Overview

This package owns **runtime improvisational objects** for play: ephemeraDB rows per **`OBJECT#`** (component pair under **`ASSET#IMPROVISATION`** + **`Meta::Object`** play meta, plus optional **`EMBEDDING#IMPROMPTU`** semantic adjacency) and **`ludicGraph`** **`Object`** nodes for room placement. Human-facing labels come from the improvisation pair; Coyote correlation uses **`stableKey`** on **`Meta::Object`** (see [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) and **`mtw.ephemera.actions`**). Optional trope fields **`tropeAffinities`** / **`tropeAffinitiesFailed`** from Acme enrich live on **`Meta::Object`** ([`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), trope shapes in [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). It uses a dedicated **`dataSourceKey`** (**`mtw.ephemera.objects`**) in **symmetry** with **`mtw.ephemera.state`**: a **semantic domain** for object existence and ingress, **not** nested under a room aggregate.

**Steady state:** writers **must not** touch **`Meta::Room.objects`** (removed from room meta type).

## Four-way split (body / play meta / embedding / placement)

Each improvisational **`OBJECT#`** splits across four authorities (mirrors Character: blueprint pair vs **`Meta::Character`** vs graph membership, plus semantic adjacency on the objects lane):

| Concern | Storage | Owner |
| --- | --- | --- |
| **Merge body** (`shortName`, optional `SITUATION#DEFAULT` situations facet) | `(OBJECT#, ASSET#IMPROVISATION)` pair row | This lane ([`persistImprovisationObject.ts`](persistImprovisationObject.ts)) |
| **Play meta** (`stableKey`, trope fields) | `(OBJECT#, Meta::Object)` | This lane; read via **`internalCache.ObjectEphemeraMeta`** ([`objectEphemeraMeta.AGENT.md`](../../internalCache/objectEphemeraMeta.AGENT.md)) |
| **Short-name semantic vector** (impromptu scope) | `(OBJECT#, EMBEDDING#IMPROMPTU)` | This lane ([`embedding/`](embedding/)) |
| **Placement** (which host holds the object) | **`Object`** node on room or character **`ludicGraph`** + **`OBJECT#`** adjacency | **`mtw.ephemera.positions`** ([`../positions/AGENT.concepts.md`](../positions/AGENT.concepts.md#object-room-placement-nodes-only)) |

**Invariants:** one pair row and one **`Meta::Object`** row per spawned object; spawn/clear coordinators write or delete both in one transact (plus optional **`EMBEDDING#IMPROMPTU`** when embedding is supplied on spawn); every destroy is one kernel commit (**`executeComponentDestruction`**) that deletes **`Meta::Object`** itself (a conditioned `Delete`, via `destroyComponent`) and carries the pair and **`EMBEDDING#IMPROMPTU`** deletes as `existenceItems` (those two are unconditioned, so an absent embedding row is harmless); **`shortName`** never on **`Meta::Object`**. Type authority: [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) ADR comment block; embedding row: [`ephemeraEmbedding.ts`](../../../../packages/mtw-interfaces/ts/ephemeraEmbedding.ts).

**Render-cache teardown on delete:** the destroy commit above is authoritative for object existence, but Object is also a render-cache host ([`../renderCache/AGENT.md`](../renderCache/AGENT.md)) once it has been looked at --- [`destroyImprovisedObject`](persistImprovisationObject.ts) therefore also enumerates and clears that host's `CACHE#`/`Cache::`/`Link::` footprint as a **decoupled, best-effort follow-up** after the transact succeeds (not a fourth transact item; a Dynamo transact write caps at 100 items and a well-used object's perspective-row count is unbounded). See **Render-cache cleanup** below.

## Improvisation storage

EphemeraDB rows per **`OBJECT#`**:

| Row | Key | Module |
| --- | --- | --- |
| Merge body | `(OBJECT#, ASSET#IMPROVISATION)` | Written at spawn as an `existenceItems` `Put` built by [`persistImprovisationObject.ts`](persistImprovisationObject.ts) **`improvisationPairPutItem`** (riding the kernel's create commit); deleted by **`destroyImprovisedObject`** (an `existenceItems` `Delete`, riding the kernel's destroy commit). No update path: an edit of an improvised Object would be a kernel step, not a whole-row write outside it |
| Play meta | `(OBJECT#, Meta::Object)` | same coordinators (`stableKey`, trope fields only) |
| Semantic embedding (impromptu scope) | `(OBJECT#, EMBEDDING#IMPROMPTU)` | optional third **`Put`** on spawn or update when embed succeeds ([`embedding/objectEmbeddingPutItem.ts`](embedding/objectEmbeddingPutItem.ts)); always deleted with pair + meta |

**Coyote bulk clear (existence + graph):** [`clearCoyoteGameImprovisationObjects.ts`](clearCoyoteGameImprovisationObjects.ts) enumerates **`OBJECT#`** ids from Coyote **`gameRooms`** room graphs **and** from **`ludicGraph`** nodes on **active characters** in those rooms ([`collectActiveCharactersInCoyoteRooms`](../coyoteGame/utilities/collectActiveCharactersInCoyoteRooms.ts)), **then descends into object-hosted shards** via [`collectNestedObjectIds`](collectNestedObjectIds.ts) (relocated here from `actions/roomObjectCatalogForCharacter.ts` 2026-09-18, `ludicCacheRebuild` Slice 4 --- this is now its only caller) --- a nested object (a cup on a table) is a member of its host's own graph, not the room's, so the two flat scans miss it entirely and it survives the clear only to be stranded when its host's row is deleted (fixed 2026-09-03). This is *enumeration*, not a containment-cascade policy: a total clear has no "where does the cup go" question, so it does not settle what a single object's removal should do with its contents (still deferred). **The batch is then ordered contents-before-hosts** (`orderNestedContentsFirst`, post-order DFS over containment within the batch): phase 2 destroys each object's whole `Meta::Object` row, so a host destroyed first would take its contents' membership with it and strand the nested object (the kernel now refuses that order outright). Enumeration and ordering are two separate requirements; fixing only the first still leaves the object orphaned. Then two phases. **Phase 1:** every relational chain touching *any* object in the whole batch --- including a genuine crossing, whose port and far leg can live on a third object's own graph never independently enumerated above --- is discovered ([`findRelationalChainsTouching`](../positions/manipulation/relational/findRelationalChainsForRemoval.ts)) and dissolved in one atomic transact, before anything is removed. **Phase 2:** one [`destroyImprovisedObject`](persistImprovisationObject.ts) commit per object (not one overall: DynamoDB caps a transaction at 100 items, and a full clear can exceed that) --- [`executeComponentDestruction`](../positions/manipulation/membership/executeComponentDestruction.ts) removes the object from all its hosts (its own chain-aware sweep now finds nothing left, a safe no-op), then `destroyComponent` deletes **`Meta::Object`**, with the pair + **`EMBEDDING#IMPROMPTU`** rows in the same transaction (and, per **Render-cache cleanup** below, that object's render-cache footprint afterwards). The contents-first order is now enforced rather than merely needed: the kernel refuses to destroy a host that still holds an Object, so a wrong order fails loudly instead of stranding the nested one.

**Deferred (cross-host Exit/play-only edge references only):** Relational edges/crossing chains are now handled by phase 1 above; adjacency still does not index which graphs mention an `OBJECT#` only in a play-only (Exit) edge endpoint, so after clear another host may retain a stale Exit edge referencing a destroyed id until a future sweep or edge-reference index ships. See [`../positions/ludicGraph/AGENT.md`](../positions/ludicGraph/AGENT.md) **Known limitation (deferred)**.

**Spawn + place:** one kernel commit, from [`spawnOneImprovisationObject`](spawnImprovisationObjectsBatch.ts). It runs best-effort [`buildShortNameSemanticEmbedding`](embedding/buildShortNameSemanticEmbedding.ts) first, then calls [`executeComponentCreation`](../positions/manipulation/membership/executeComponentCreation.ts): `createComponent` writes the **`Meta::Object`** row born holding a hostless remainder, the first-placement move re-points it at the room, and the pair row (plus `EMBEDDING#IMPROMPTU` when the embed succeeded) rides the same transaction as `existenceItems`. The pair, meta and embedding caches are seeded in `afterPersist`, before **`Object Moved`** streams. **S1:** a failed placement writes nothing, so there is no compensation ([the contract's S1](../positions/AGENT.contract.md#object-room-membership-nodes-only)). Embed failure logs and proceeds without the embedding row; creation and placement are unaffected. **`Object Moved`** / **`RoomUpdate`** come from the positions kernel only. Batch **`add`** uses the same module (**S3** per-object isolation; partial **`createdIds`**).

**Room-scoped ingress coordinator:** [`applyObjectsChange.ts`](applyObjectsChange.ts) --- **`Objects Change`** **`add`** -> **`spawnImprovisationObjectsBatch`**; **`remove`** -> one [`destroyImprovisedObject`](persistImprovisationObject.ts) commit per id (placement cleared from all membership hosts, `Meta::Object` and the existence rows deleted together); returns **`createdIds`** / **`destroyedIds`** (and optional **`addFailures`**) for outbound **`Objects Changed`**.

**Cache invalidation:** [`invalidateImprovisationObjectCaches.ts`](invalidateImprovisationObjectCaches.ts) --- **`ImprovisationComponentData`**, **`ObjectEphemeraMeta`**, **`ObjectEmbedding`**, and **`AffordanceRoomDeliverable`** per affected room (it embeds object `shortName`). These writes touch no `Meta::Room` row and no graph, so it leaves **`ComponentEphemeraMeta`** and **`Positions`** alone --- the placement/removal commit already wrote the room graph through. This is in-memory Lambda cache only, not the persisted render-cache Dynamo rows --- see **Render-cache cleanup** below.

**Render-cache cleanup (on delete):** [`persistDeleteImprovisationObject`](persistImprovisationObject.ts), after its 3-item transact succeeds, calls [`queryAllRenderCacheDataCategoriesForComponent`](../renderCache/queryAllRenderCacheDataCategoriesForComponent.ts) (a read; enumerates every `CACHE#`/`Cache::` `DataCategory` the object host has) and, when non-empty, dispatches `sendDeleteCacheRecords` on the message bus (`mtw.ephemera.renderCache`'s **`Delete Cache Records`** command --- writes route through that DataSource, not direct Dynamo calls, per [`../renderCache/AGENT.md`](../renderCache/AGENT.md)). That handler also cleans up the corresponding Situation adjacency **`Link::`** rows ([`../renderCache/cleanupSituationAdjacencyForDeletedRecords.ts`](../renderCache/cleanupSituationAdjacencyForDeletedRecords.ts)). This is decoupled and best-effort: a failure here is logged (`console.error`) but does not fail the object delete --- a stray render-cache row is inert (never re-attached to a live object), unlike a stray placement, so no compensating-failure story is needed.

**Reads:** **`internalCache.ImprovisationComponentData`** ([`packages/mtw-gateways/ts/ephemera/improvisation/`](../../../../packages/mtw-gateways/ts/ephemera/improvisation/)); **`internalCache.ObjectEphemeraMeta`** ([`objectEphemeraMeta.AGENT.md`](../../internalCache/objectEphemeraMeta.AGENT.md)); **`internalCache.ObjectEmbedding`** ([`packages/mtw-gateways/ts/ephemera/objectEmbedding/`](../../../../packages/mtw-gateways/ts/ephemera/objectEmbedding/)) for **`EMBEDDING#IMPROMPTU`** vectors. **`ComponentAggregate`** and **`GenerationContext`** read improvisation merge bodies via composite **`internalCache.ComponentData`** when **`ASSET#IMPROVISATION`** is in the participation stack. Room perspectives append that layer with **`appendImprovisationToPerspective`** ([`packages/mtw-interfaces/ts/perspective.ts`](../../../../packages/mtw-interfaces/ts/perspective.ts)) when objects are in scope.

## Bus events

| Header `type` | Where | Role |
| --- | --- | --- |
| **`Objects Change`** | **`api.ephemera`** ingress (internal) | Imperative command; parallels **`State Change`**. Payload: **`componentId`** (room, v1) and **`{ add, remove }`**. |
| **`Objects Changed`** | **`mtw.ephemera.objects`** outbound (bus-only) | After successful persist; **I4** object-id existence fact: **`createdIds`** / **`destroyedIds`** ([`events.ts`](events.ts), **`streamObjectsChangedFact`**). **`createdIds`:** include an id only when its create-and-place commit succeeded (**S2**); failed spawns excluded. **`streamKey`:** room id for API batches; first destroyed id or first Coyote game room for RoadRunner bulk clear. |

Placement **`Object Moved`** facts are emitted by **`mtw.ephemera.positions`** apply coordinators, not duplicated from objects handlers.

## Orphan sweep (existence-without-placement)

Spawn cannot leave an orphan: its rows and its placement commit together. **Remove** cannot either, since [`applyObjectsChange`](applyObjectsChange.ts) destroys through one commit. The sweep is the backstop for defects (a bug, a manual data edit, a writer outside the kernel, or a host deleted with its contents still on it), not for a designed path. [`orphanedImprovisedObjectSweep`](../../../diagnostics/orphanedImprovisedObjectSweep) runs by direct invoke (full scan); confirmed orphans emit **`Orphaned Improvised Object Finding`** on **`mtw.diagnostics`**. Sweep contract: [`lambda/diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) **Orphaned improvised object sweep**. Objects lane consumes the finding for delete repair (see **Diagnostics repair** below).

## Diagnostics repair (orphan finding)

**Subscription:** `mtw.diagnostics` / **`Orphaned Improvised Object Finding`**.

| Event | Handler |
| --- | --- |
| `Orphaned Improvised Object Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`handleOrphanedImprovisedObjectFinding`](handleOrphanedImprovisedObjectFinding.ts) -> [`destroyImprovisedObject`](persistImprovisationObject.ts) |

**Repair model (Coyote Game v1):** delete-only --- remove `(OBJECT#, ASSET#IMPROVISATION)` pair, `Meta::Object`, and `EMBEDDING#IMPROMPTU` rows (and, per **Render-cache cleanup** above, that object's render-cache footprint --- inherited automatically, since this repair path also calls `destroyImprovisedObject`). **Must not** retry placement on finding; non-Coyote orphan contexts may need different repair later (product fork). **Idempotency:** at-least-once finding delivery **must** be safe: the handler re-reads the `Meta::Object` row first (the kernel's destroy fails on an absent row) and returns quietly when it is gone. An orphan that still holds contents is refused by the kernel and logged, not repaired. On delete failure, **must** `console.error` with `objectId`, `diagnosticRunId`, and delete error.

**Trust the finding:** handler does not re-run orphan classification; diagnostics sweep already confirmed litmus before emission.

## Ingress and API

**Ingress:** Internal **`api.ephemera`** header **`Objects Change`** --- **`sendObjectsChange`** in [`../apiEphemera.ts`](../apiEphemera.ts). Payload **`ObjectsChangeCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts): **`add`** is **`EphemeraMetaRoomObject[]`**, **`remove`** is **`OBJECT#...` ids**.

**Correlation:** **No** **`requestId`** / **`ReturnValue`** on ingress (internal-only; unlike **`State Change`**). **Authorization:** none for v1; only **internal** callers.

**Merge semantics (ingress v1):** **`remove`** --- destroy the Object: graph removal and row deletes in one kernel commit. **`add`** --- spawn+place per **`EphemeraMetaRoomObject`** row (caller supplies **`uuid`** as **`OBJECT#`** id, **`shortName`**, **`stableKey`**, optional trope fields).

**Persist:** [`applyObjectsChange.ts`](applyObjectsChange.ts) coordinates spawn, graph apply, and delete modules.

**Handler + outbound:** [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts). On success, **`streamObjectsChangedFact`** on **`mtw.ephemera.objects`** when **`createdIds.length > 0`** and/or **`destroyedIds.length > 0`** --- partial batch (**S3**): stream partial **`createdIds`** when at least one **`add`** succeeded even if others failed; log per-failure **`addFailures`** without suppressing the outbound fact for successes.

**Coyote Acme orders:** [`handleAcmeOrderAddObjects`](handleApiObjectsChange.ts) mints **`OBJECT#`** per enriched catalog line, calls **`spawnImprovisationObjectsBatch`**, streams partial **`createdIds`** when at least one row succeeds, logs per-failure **`addFailures`**. **RoadRunner clear:** [`clearCoyoteGameImprovisationObjects.ts`](clearCoyoteGameImprovisationObjects.ts) emits **`destroyedIds`**.

**Spawn-time `DEFAULT` situation prose (Phase 5, shipped):** the Acme order enrich Bedrock call ([`actions/enrich/acmeOrder/`](../actions/enrich/acmeOrder/)) generates optional `defaultSituation` flavor-text prose alongside `tropeAffinities`, one call per order (no second Bedrock call). `handleAcmeOrderAddObjects`'s `acmeOrderToSpawnArgs` maps that prose into a `SITUATION#DEFAULT` `situations` facet on the spawn row when present; `spawnOneImprovisationObject` writes it onto the pair row (`improvisationPairPutItem`) and the cache-seeded `StandardObject` (`improvisationPairComponent`), as it does the order's `gloss`. This routes the object through the same real `ensureAuthoredCatalog` render path Feature/Knowledge/Character use (see [`perception/AGENT.md`](../perception/AGENT.md) **Correlated Object description (policy)**) instead of the shortName-only fallback. Any future edit of an improvised Object (a kernel step; there is no edit path today) must preserve prior `situations` unless explicitly overridden --- a later trope-only edit must not erase spawn-time prose. Plain API `Objects Change` `add` (no Acme enrich in the loop) still has no source for this prose; the live-shortName fallback remains load-bearing for that path.

**Registration:** [`index.ts`](index.ts) --- **`EphemeraDataSource`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**, **`outboundBusDelivery: 'publish'`** (no EventBridge-visible replay contract for this DataSource in v1; same posture as **`mtw.ephemera.state`**). Outbounds use **`publish`** via the DataSource; boundary **`flushAndSettle`** at lambda exit quiesces concurrent subscribers.

## Ordering vs `mtw.ephemera.state`

**Intent:** **`objects`** runs **before** **`state`** in shared **`Meta::Room`** workflows so rules can treat object changes as **inputs** to derived state (e.g. an object toggles illumination and marks follow), not the reverse.

1. **`app.ts`:** side-effect import **`./dataSource/objects`** **above** **`./dataSource/state`** so **`subscribe()`** registration is objects first, state second.
2. **Callers** that emit both for one room in one interaction should send **`Objects Change`** before **`State Change`** when both land in the same lambda invocation.

This does **not** couple the two DataSources automatically; it is **ordering policy** for predictable composition.

## Player-visible delivery (affordances)

**`mtw.ephemera.affordanceOrchestration`** subscribes to **`mtw.ephemera.positions`** **`Object Moved`** and fans out **`orchestrateAffordanceRequest`** to all rooms in **`froms`** and non-null **`to`** via [`fanOutAffordanceRefreshForRoom.ts`](../affordanceOrchestration/fanOutAffordanceRefreshForRoom.ts). Terminal affordance **`PublishMessage`** per character follows **`Affordances Pertain`** ([`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts); see [`../perception/AGENT.md`](../perception/AGENT.md) **Server publish sites (multi-channel)**.

## Ephemera wire WML (producers)

**Not** asset / blueprint authoring: **`mtw-wml`** **`standardizeMode: 'ephemeraWire'`** allows **`<Object uuid=(id)><ShortName>label</ShortName></Object>`** under **`Room`**. **`uuid`** is canonical **`OBJECT#...`** in memory and **`StandardRoom.objects`** / **`toJSON`**; **`Objects Change`** **`add`** uses full **`EphemeraMetaRoomObject`** rows (WML authoring supplies **`uuid`** + **`shortName`** and must arrange a **`stableKey`** consistent with wire rules; server flows such as Acme enrich may add **`tropeAffinities`** / **`tropeAffinitiesFailed`**); **`remove`** uses **`OBJECT#...` ids**. Normative detail: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md).

## Follow-ups (not part of v1 scope)

- **`renderOrchestration`:** May subscribe to **`Objects Changed`** (or ingress) if object lists affect render keys or passive fan-out --- **not** required for the shipped objects/perception slice; add when product needs it.
- **`EMBEDDING#PERSPECTIVE#...` rows:** when perspective-scoped similarity is needed.
- **Non-room `componentId`**, additional **`Meta::*`** shapes, **replay** / external contract for **`mtw.ephemera.objects`**, **authorization**, **client correlation** --- future task plans or product decisions.

## Normative decisions (summary)

| Topic | Decision |
| --- | --- |
| **`dataSourceKey`** | **`mtw.ephemera.objects`** --- parallel to **`mtw.ephemera.state`**, not nested under a room-aggregate key. |
| **v1 storage** | Improvisation pair + **`Meta::Object`** + optional **`EMBEDDING#IMPROMPTU`** + **`ludicGraph`** **`Object`** nodes; **`Meta::Room.objects`** removed from room meta type. |
| **Impromptu embedding (spawn)** | Best-effort **`EMBEDDING#IMPROMPTU`** on every improvisational spawn; absence is valid; embed failure **must not** block object creation or placement. |
| **Existence rows (spawn)** | Pair always; **`EMBEDDING#IMPROMPTU`** only when the embed succeeds. Both are `existenceItems` on the kernel's create commit, beside the kernel-written **`Meta::Object`** row, so all land in one transaction. |
| **Delete transact** | Always 3 unconditional **`Delete`** items (pair, **`Meta::Object`**, **`EMBEDDING#IMPROMPTU`**) --- idempotent when embedding row absent. |
| **Delete render-cache cleanup** | Not part of the transact --- a decoupled, best-effort dispatch of `Delete Cache Records` (message bus) after the transact succeeds, since a render-cache host's row count is unbounded and can exceed a transact's item cap. Failure is logged, not fatal to the object delete. |
| **Embedding read path** | **`createObjectEmbeddingCacheHandler`** + **`internalCache.ObjectEmbedding`**; batch **`get(objectIds[])`** at parse ingress ([`attachEmbeddingsToCatalogEntries`](../actions/attachEmbeddingsToCatalogEntries.ts)); memo invalidate on object writes. |
| **Outbound `Objects Changed`** | **`createdIds`** / **`destroyedIds`** only (**I4**); no room-list snapshots. |
| **Spawn sequencing** | One transaction: `createComponent`, the first placement, and the objects lane's rows as `existenceItems` ([`executeComponentCreation`](../positions/manipulation/membership/executeComponentCreation.ts)). |
| **`createdIds` timing (S2)** | Include an id only when its create-and-place commit succeeded. |
| **Batch `add` isolation (S3)** | Per-object loop; partial **`createdIds`** + **`addFailures`**; one row's failure does not abort earlier successes or skip remaining rows. |
| **Orphan repair (O1)** | **`Orphaned Improvised Object Finding`** -> delete-only via **`destroyImprovisedObject`**; placement retry out of scope for Coyote v1. |
| **Ingress payload** | **`Objects Change`:** **`add: EphemeraMetaRoomObject[]`**, **`remove: OBJECT#...[]`** with **`componentId`** ([`localApiEvents.ts`](../localApiEvents.ts)). |
| **Bus helper** | **`sendObjectsChange`** (parallels **`sendStateChange`**). |
| **Outbound header** | **`Objects Changed`** (Title Case, past tense; matches **`State Changed`**). |

## Verification

From [`lambda/ephemera/AGENT.testing.md`](../../AGENT.testing.md):

```bash
cd lambda/ephemera
npm run test -- --watchAll=false
# Scope when iterating:
# npm run test dataSource/objects
```

**Spawn refactor test inventory (S1--S3 + embeddings):**

| File | Policies |
| --- | --- |
| [`embedding/buildShortNameSemanticEmbedding.test.ts`](embedding/buildShortNameSemanticEmbedding.test.ts) | Normalized input, mocked Bedrock, `SemanticEmbedding` Dynamo record shape |
| [`embedding/impromptuEmbeddingNeedsRefresh.test.ts`](embedding/impromptuEmbeddingNeedsRefresh.test.ts) | `sourceTextHash` + model metadata refresh decision |
| [`embedding/objectEmbeddingPutItem.test.ts`](embedding/objectEmbeddingPutItem.test.ts) | `EMBEDDING#IMPROMPTU` transact **`Put`** item builder |
| [`spawnImprovisationObjectsBatch.test.ts`](spawnImprovisationObjectsBatch.test.ts) | One create-and-place call per spawn (meta, target, pair and embedding rows as `existenceItems`; situations and gloss on the pair row); caches seeded only after persist; **S3** batch partial `createdIds`; payoff: through the real kernel commit, spawn is one transaction and the Object's one binding names the room's remainder, and a refused placement writes no `Meta::Object` row |
| [`handleOrphanedImprovisedObjectFinding.test.ts`](handleOrphanedImprovisedObjectFinding.test.ts) | Orphan finding triggers delete; invalid payload skipped; delete failure logged |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | **`Orphaned Improvised Object Finding`** envelope guard from `mtw.diagnostics` |
| [`index.test.ts`](index.test.ts) | `receiveEvents` dispatches orphan finding to repair handler |
| [`persistImprovisationObject.test.ts`](persistImprovisationObject.test.ts) | Pair-row and pair-component builders (situations, gloss); `destroyImprovisedObject` (existenceItems shape, cache invalidation in `afterPersist`, failed commit) and its render-cache cleanup dispatch (present, absent, and failure-tolerance cases) |
| [`applyObjectsChange.test.ts`](applyObjectsChange.test.ts) | Ingress coordinator; failed spawn id excluded from `createdIds`; **S2**/`S3` partial batch + mixed add/remove; embed wiring into `existenceItems` |
| [`handleApiObjectsChange.test.ts`](handleApiObjectsChange.test.ts) | API + Acme outbound partial `createdIds`; per-failure logging; all-fail no stream; embed wiring and the order's gloss reaching the pair row |

**Regression checks:**

- Tests under **`lambda/ephemera/dataSource/objects/`** and **`handleApiObjectsChange`** pass.
- **`mtw.ephemera.objects`** appears in **[`app.ts`](../../app.ts)** side-effect imports and as the DataSource **`dataSourceKey`** in [`index.ts`](index.ts).
- **[`app.ts`](../../app.ts):** **`./dataSource/objects`** import **above** **`./dataSource/state`**.

**Regression greps (two-step spawn; no kernel bypass):**

No live references to the retired cross-lane spawn bundle (historical **Removed:** notes in manipulation docs are OK):

```bash
rg -n "computePostApplyObjectRoomGraphs|postApplyGraphProjection|spawnAndPlaceImprovisationObject" \
  lambda/ephemera/
```

Spawn primitives and ingress coordinator wiring:

```bash
rg -n "executeComponentCreation|improvisationPairPutItem" \
  lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts

rg -n "spawnImprovisationObjectsBatch|spawnOneImprovisationObject" \
  lambda/ephemera/dataSource/objects/applyObjectsChange.ts \
  lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts
```

## Related documentation

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | dataSource directory index |
| [`../AGENT.multiChannel.contract.md`](../../AGENT.multiChannel.contract.md) | Shared **`Meta::Room`** row vs DataSource domains; affordance channel norms |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Perception delivery; **Server publish sites (multi-channel)** |
| [`../state/AGENT.md`](../state/AGENT.md) | Symmetry: **`mtw.ephemera.state`** |
| [`../../internalCache/componentEphemeraMeta.AGENT.md`](../../internalCache/componentEphemeraMeta.AGENT.md) | **`Meta::Room`** cache; invalidation after writes |
| [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) | Coyote hypothesis / plan-outcome prompts read graph + **`Meta::Object`** via **`CoyoteStagedObject`** snapshot |
| [`../actions/`](../actions/) ([**`AGENT.md`**](../actions/AGENT.md), `parseCommand.ts`, `publishedEvents.ts`, `enrich/acmeOrder/interpretAndFinalize.ts`, [`index.ts`](../actions/index.ts)) | Normative **`stableKey`** contract (**`actions/AGENT.md`**); two-step Acme parse (**intent** + **enrich**); Coyote-wide occupancy (**`collectCoyoteOccupiedStableKeys`**) + deterministic finalize (**`finalizeStableKeysDeterministic`**) before **`Acme Order`**; **`AcmeOrderPublishedPayload.orders`**, confidence combine rule |
| [`../../../../diagnostics/AGENT.md`](../../../diagnostics/AGENT.md) | Orphan sweep intake, litmus, and **`Orphaned Improvised Object Finding`** contract |
