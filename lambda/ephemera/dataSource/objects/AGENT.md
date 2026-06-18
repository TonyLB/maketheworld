*Status: **Shipped** --- bus-only **`mtw.ephemera.objects`**; first-class improvisation rows + **`positionGraph`** placement; outbound **`Objects Changed`** is object-id existence (**I4**); placement-driven affordance refresh via **`mtw.ephemera.positions`** **`Object Moved`** -> **`mtw.ephemera.affordanceOrchestration`**; terminal **`PublishMessage`** via **`Affordances Pertain`** -> [`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts).*

## Overview

This package owns **runtime improvisational objects** for play: dual ephemeraDB rows per **`OBJECT#`** (component pair under **`ASSET#IMPROVISATION`** + **`Meta::Object`** play meta) and **`positionGraph`** **`Object`** nodes for room placement. Human-facing labels come from the improvisation pair; Coyote correlation uses **`stableKey`** on **`Meta::Object`** (see [`../coyoteGame/AGENT.md`](../coyoteGame/AGENT.md) and **`mtw.ephemera.actions`**). Optional trope fields **`tropeAffinities`** / **`tropeAffinitiesFailed`** from Acme enrich live on **`Meta::Object`** ([`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), trope shapes in [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). It uses a dedicated **`dataSourceKey`** (**`mtw.ephemera.objects`**) in **symmetry** with **`mtw.ephemera.state`**: a **semantic domain** for object existence and ingress, **not** nested under a room aggregate.

**Steady state:** writers **must not** touch **`Meta::Room.objects`** (removed from room meta type).

## Three-way split (body / play meta / placement)

Each improvisational **`OBJECT#`** splits across three authorities (mirrors Character: blueprint pair vs **`Meta::Character`** vs graph membership):

| Concern | Storage | Owner |
| --- | --- | --- |
| **Merge body** (`shortName`, future WML fields) | `(OBJECT#, ASSET#IMPROVISATION)` pair row | This lane ([`persistImprovisationObject.ts`](persistImprovisationObject.ts)) |
| **Play meta** (`stableKey`, trope fields) | `(OBJECT#, Meta::Object)` | This lane; read via **`internalCache.ObjectEphemeraMeta`** ([`objectEphemeraMeta.AGENT.md`](../../internalCache/objectEphemeraMeta.AGENT.md)) |
| **Placement** (which room hosts the object) | **`Object`** node on room **`positionGraph`** + **`OBJECT#`** adjacency | **`mtw.ephemera.positions`** ([`../positions/AGENT.concepts.md`](../positions/AGENT.concepts.md#object-room-placement-phase-4-nodes-only)) |

**Invariants:** one pair row and one **`Meta::Object`** row per spawned object; spawn/clear coordinators write or delete both in one transact; **`shortName`** never on **`Meta::Object`**. Type authority: [`ephemeraMeta.ts`](../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) ADR comment block.

## Improvisation storage

Dual ephemeraDB rows per **`OBJECT#`**:

| Row | Key | Module |
| --- | --- | --- |
| Merge body | `(OBJECT#, ASSET#IMPROVISATION)` | [`persistImprovisationObject.ts`](persistImprovisationObject.ts) **`persistSpawnImprovisationObject`** / **`persistUpdateImprovisationObject`** / **`persistDeleteImprovisationObject`** |
| Play meta | `(OBJECT#, Meta::Object)` | same coordinators (`stableKey`, trope fields only) |

**Coyote bulk clear (existence + graph):** [`clearCoyoteGameImprovisationObjects.ts`](clearCoyoteGameImprovisationObjects.ts) enumerates **`OBJECT#`** ids from Coyote **`gameRooms`** graphs, removes graph placement, then **`persistClearCoyoteGameImprovisationObjects`** deletes pair + **`Meta::Object`** rows.

**Spawn + place:** [`spawnAndPlaceImprovisationObject.ts`](spawnAndPlaceImprovisationObject.ts) --- atomic transact: improvisation pair + **`Meta::Object`** + room graph **`Object`** node + adjacency. Emits **`Object Moved`** on **`mtw.ephemera.positions`**. Acme and API ingress call this via [`applyObjectsChange.ts`](applyObjectsChange.ts) / [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts).

**Room-scoped ingress coordinator:** [`applyObjectsChange.ts`](applyObjectsChange.ts) --- **`Objects Change`** **`add`** -> spawn+place per row; **`remove`** -> graph removal + row delete; returns **`createdIds`** / **`destroyedIds`** for outbound **`Objects Changed`**.

**Cache invalidation:** [`invalidateImprovisationObjectCaches.ts`](invalidateImprovisationObjectCaches.ts) --- **`ImprovisationComponentData`**, **`ObjectEphemeraMeta`**, **`ComponentEphemeraMeta`**, **`Positions`**, optional **`AffordanceRoomDeliverable`** per affected room.

**Reads:** **`internalCache.ImprovisationComponentData`** ([`packages/mtw-gateways/ts/ephemera/improvisation/`](../../../../packages/mtw-gateways/ts/ephemera/improvisation/)); **`internalCache.ObjectEphemeraMeta`** ([`objectEphemeraMeta.AGENT.md`](../../internalCache/objectEphemeraMeta.AGENT.md)). **`ComponentAggregate`** and **`GenerationContext`** read improvisation merge bodies via composite **`internalCache.ComponentData`** when **`ASSET#IMPROVISATION`** is in the participation stack. Room perspectives append that layer with **`appendImprovisationToPerspective`** ([`packages/mtw-interfaces/ts/perspective.ts`](../../../../packages/mtw-interfaces/ts/perspective.ts)) when objects are in scope.

## Bus events

| Header `type` | Where | Role |
| --- | --- | --- |
| **`Objects Change`** | **`api.ephemera`** ingress (internal) | Imperative command; parallels **`State Change`**. Payload: **`componentId`** (room, v1) and **`{ add, remove }`**. |
| **`Objects Changed`** | **`mtw.ephemera.objects`** outbound | After successful persist; **I4** object-id existence fact: **`createdIds`** / **`destroyedIds`** ([`events.ts`](events.ts), **`streamObjectsChangedFact`**). **`streamKey`:** room id for API batches; first destroyed id or first Coyote game room for RoadRunner bulk clear. |

Placement **`Object Moved`** facts are emitted by **`mtw.ephemera.positions`** apply coordinators, not duplicated from objects handlers.

## Ingress and API

**Ingress:** Internal **`api.ephemera`** header **`Objects Change`** --- **`sendObjectsChange`** in [`../apiEphemera.ts`](../apiEphemera.ts). Payload **`ObjectsChangeCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts): **`add`** is **`EphemeraMetaRoomObject[]`**, **`remove`** is **`OBJECT#...` ids**.

**Correlation:** **No** **`requestId`** / **`ReturnValue`** on ingress (internal-only; unlike **`State Change`**). **Authorization:** none for v1; only **internal** callers.

**Merge semantics (ingress v1):** **`remove`** --- delete improvisation rows after graph removal. **`add`** --- spawn+place per **`EphemeraMetaRoomObject`** row (caller supplies **`uuid`** as **`OBJECT#`** id, **`shortName`**, **`stableKey`**, optional trope fields).

**Persist:** [`applyObjectsChange.ts`](applyObjectsChange.ts) coordinates spawn, graph apply, and delete modules.

**Handler + outbound:** [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts). On success, **`streamObjectsChangedFact`** on **`mtw.ephemera.objects`** when any ids created/destroyed.

**Coyote Acme orders:** [`handleAcmeOrderAddObjects`](handleApiObjectsChange.ts) calls **`spawnAndPlaceImprovisationObject`** per enriched catalog line (mint **`OBJECT#`**, filter tropes by delivery room), then one **`Objects Changed`** with **`createdIds`**. **RoadRunner clear:** [`clearCoyoteGameImprovisationObjects.ts`](clearCoyoteGameImprovisationObjects.ts) emits **`destroyedIds`**.

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
- **Non-room `componentId`**, additional **`Meta::*`** shapes, **replay** / external contract for **`mtw.ephemera.objects`**, **authorization**, **client correlation** --- future task plans or product decisions.

## Normative decisions (summary)

| Topic | Decision |
| --- | --- |
| **`dataSourceKey`** | **`mtw.ephemera.objects`** --- parallel to **`mtw.ephemera.state`**, not nested under a room-aggregate key. |
| **v1 storage** | Improvisation pair + **`Meta::Object`** + **`positionGraph`** **`Object`** nodes; **`Meta::Room.objects`** removed from room meta type. |
| **Outbound `Objects Changed`** | **`createdIds`** / **`destroyedIds`** only (**I4**); no room-list snapshots. |
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

**Regression checks:**

- Tests under **`lambda/ephemera/dataSource/objects/`** and **`handleApiObjectsChange`** pass.
- **`mtw.ephemera.objects`** appears in **[`app.ts`](../../app.ts)** side-effect imports and as the DataSource **`dataSourceKey`** in [`index.ts`](index.ts).
- **[`app.ts`](../../app.ts):** **`./dataSource/objects`** import **above** **`./dataSource/state`**.

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
