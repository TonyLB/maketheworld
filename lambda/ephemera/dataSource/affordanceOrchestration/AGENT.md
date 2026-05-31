# mtw.ephemera.affordanceOrchestration

## Status

**M4 orchestration + cache + perception terminal (landed).** This directory is the canonical home for the `mtw.ephemera.affordanceOrchestration` DataSource. Production adapters from **`RoomUpdate`** (reason: **`roster`**), **`mtw.ephemera.objects` `Objects Changed`** (reason: **`objects`**), and **`mtw.assets.componentTopology` `TopologyInvalidated`** (reason: **`topology`**) are wired. **`orchestrateAffordanceRequest`** calls **`ensureAffordanceTopology`** when needed and emits **`Slice Ready`** / **`Orchestration Error`**. Terminal **`PublishMessage`** is emitted by **`mtw.ephemera.perception`** on **`Affordances Pertain`** (**D38**, [`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts)).

**Initiative:** [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md). **Parent decisions:** [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (**D32-D38**, **D37** three-layer pipeline).

**Precedent:** [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) (pass-through orchestration layer).

## Getting Started

1. **Child plan** --- [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md) (affordance pipeline diagram, module layout, D32 intake/`ensure*` placement).
2. **Render analogue** --- [`../renderOrchestration/`](../renderOrchestration/) (`index.ts`, `publishedEvents.ts`, `subscribedEvents.ts`, `orchestrationHandler.ts`, `fanOutStateChangedToPassiveRenders.ts`).
3. **Tests** --- From [`lambda/ephemera/`](../../): `npm test -- --watchAll=false dataSource/affordanceOrchestration/`.

## Why this layer exists (D37)

| Layer | Owns | Does not own |
| --- | --- | --- |
| **`affordanceOrchestration`** | Ingress normalization; intake; **`ensureAffordanceTopology`** call; stream outbounds; future LLM slow path | Dynamo writes; **`PublishMessage`**; ephemeraWire compose |
| **`affordanceCache`** | Invalidation; colocated **`Affordance::`** persist; **`Affordances Pertain`** | Terminal publish |
| **`perception`** | Terminal **`PublishMessage`** on **`Affordances Pertain`** | Topology pull; hydrate policy |

## What this layer does today

1. Subscribes to internal **`api.ephemera`** streaming envelopes with header type **`Affordances Requested`** (`sendAffordancesRequested` in [`subscribedEvents.ts`](subscribedEvents.ts)).
2. Subscribes to **`mtw.ephemera.objects` `Objects Changed`** and fans out via [`fanOutAffordanceRefreshForRoom.ts`](fanOutAffordanceRefreshForRoom.ts) (direct **`orchestrateAffordanceRequest`**, mirror render **`State Changed`**).
3. Subscribes to **`mtw.assets.componentTopology` `TopologyInvalidated`** (room-scoped only) and fans out via **`fanOutAffordanceRefreshForRoom`** with reason **`topology`** (area-scoped v1 no-op).
4. Maps **`Affordances Requested`** ingress to **`AffordancesRequested`** and calls **`orchestrateAffordanceRequest`** ([`orchestrationHandler.ts`](orchestrationHandler.ts)) --- **`ensureAffordanceTopology`** when catalog stale or reason **`topology`**; emits **`Slice Ready`** / **`Orchestration Error`** via **`streamEvent`**.
5. Defines **five outbound** payload types in [`publishedEvents.ts`](publishedEvents.ts). **v1-active:** **`Slice Ready`**, **`Orchestration Error`**. **Future LLM:** **`Enrichment Started`**, **`Enrichment Complete`**, **`Enrichment Deferred`** (contract encoded in skipped tests).

**External adapters (outside this DataSource):**

| Trigger | Helper | Dispatch |
| --- | --- | --- |
| Internal bus **`type: 'RoomUpdate'`** | [`sendAffordanceRefreshRequestedForRoom.ts`](sendAffordanceRefreshRequestedForRoom.ts) | **`sendAffordancesRequested`** (reason: **`roster`**, default bus lane) |
| **`mtw.assets.componentTopology` `TopologyInvalidated`** | [`index.ts`](index.ts) **`receiveEvents`** | **`fanOutAffordanceRefreshForRoom`** (reason: **`topology`**, room-scoped only) |

Wiring: [`app.ts`](../../app.ts) side-effect imports `./dataSource/affordanceOrchestration` ([`index.ts`](index.ts)).

## Ingress

### `api.ephemera` **`Affordances Requested`**

| Field | Type |
| --- | --- |
| `roomId` | `EphemeraRoomId` |
| `perspective` | `Perspective` |
| `reason` | `'roster' \| 'objects' \| 'topology'` |

### `mtw.ephemera.objects` **`Objects Changed`**

Handled in [`index.ts`](index.ts) **`receiveEvents`**: **`fanOutAffordanceRefreshForRoom`** with reason **`objects`** (one **`orchestrateAffordanceRequest`** per distinct occupant perspective).

### `mtw.assets.componentTopology` **`TopologyInvalidated`**

Handled in [`index.ts`](index.ts) **`receiveEvents`**: room-scoped events fan out with reason **`topology`**; area-scoped events (no **`roomIds`**) are a v1 no-op (**D35**). **`affordanceCache`** catalog bump runs at message-bus priority **4** before orchestration fan-out at priority **5**.

## Stream outbounds (contract)

| Outbound | v1 | Subscriber |
| --- | --- | --- |
| **`Slice Ready`** | Active | **`affordanceCache`** handoff |
| **`Orchestration Error`** | Active | Diagnostics / cache |
| **`Enrichment Started`** | Skipped tests | Future slow path |
| **`Enrichment Complete`** | Skipped tests | Future slow path |
| **`Enrichment Deferred`** | Skipped tests | Future slow path |

**Routing:** lean **`roomId`**, **`perspective`**, **`perspectiveKey`** on every outbound (mirror render **`componentId`** routing).

## Stream skeleton sequencing

Order for the affordance pass-through slice (aligned with render):

1. Land **types** + **skipped** contract tests ([`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), enrichment guards in [`publishedEvents.test.ts`](publishedEvents.test.ts)).
2. Wire **`orchestrateAffordanceRequest`** emissions (**`Slice Ready`**, **`Orchestration Error`**) and **un-skip** producer tests.
3. Scaffold **`affordanceCache`** subscription + thin integration test (render analogue: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts); affordance: [`../passThroughAffordanceOrchestrationToCache.integration.test.ts`](../passThroughAffordanceOrchestrationToCache.integration.test.ts)).

## Tests and verification

**Primary tests:** [`publishedEvents.test.ts`](publishedEvents.test.ts), [`subscribedEvents.test.ts`](subscribedEvents.test.ts), [`orchestrationHandler.test.ts`](orchestrationHandler.test.ts), [`index.test.ts`](index.test.ts), [`fanOutAffordanceRefreshForRoom.test.ts`](fanOutAffordanceRefreshForRoom.test.ts), [`sendAffordanceRefreshRequestedForRoom.test.ts`](sendAffordanceRefreshRequestedForRoom.test.ts), [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), [`../passThroughAffordanceOrchestrationToCache.integration.test.ts`](../passThroughAffordanceOrchestrationToCache.integration.test.ts).

From [`lambda/ephemera/`](../../):

```bash
npm test -- --watchAll=false dataSource/affordanceOrchestration/
```

**Hygiene (grep):** no production path outside **`affordanceOrchestration`** ingress should call **`publishRoomAffordancePerceptionMessages`** directly:

```bash
rg 'publishRoomAffordancePerceptionMessages' lambda/ephemera --glob '!**/affordanceOrchestration/**'
```

Expected: definition in [`publishRoomAffordancePerceptionMessages.ts`](../perception/publishRoomAffordancePerceptionMessages.ts) only (legacy export; production path is **`handleAffordancesPertain`** on **`Affordances Pertain`**).

## Key concepts

- **`reason`** gates whether **`ensureAffordanceTopology`** runs when wired (**topology** vs roster/objects-only refresh). See parent [ComponentStackMerge vs perception (D38)](../../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md#componentstackmerge-vs-perception-d38).
- **Two dispatch paths:** external triggers (**`RoomUpdate`**) enqueue **`Affordances Requested`**; in-DS subscribers (**`Objects Changed`**, **`TopologyInvalidated`**) call **`fanOutAffordanceRefreshForRoom`** -> **`orchestrateAffordanceRequest`** directly (mirror render **`State Changed`**).
- **Outgoing types:** [`publishedEvents.ts`](publishedEvents.ts) (**`publisherStrategy: 'busOnly'`**); ephemera-local until a client boundary needs **`mtw-interfaces`**.

## Current constraints

- **`replayable: false`**; no EventBridge external contract in this scaffold.
- **`ensureAffordanceTopology`** lives under **`affordanceCache/`**; orchestration **calls** it (**D32**), does not implement hydrate inline. **Nav (**D34**): [`getRoomExitTargetsForCharacter`](../actions/roomExitTargetsForCharacter.ts) calls it directly (sync bypass; no bus orchestration or publish).
