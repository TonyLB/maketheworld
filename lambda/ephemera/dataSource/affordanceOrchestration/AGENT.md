# mtw.ephemera.affordanceOrchestration

## Status

**M4 ingress migration (landed).** This directory is the canonical home for the `mtw.ephemera.affordanceOrchestration` DataSource. Production adapters from **`RoomUpdate`** (reason: **`roster`**) and **`mtw.ephemera.objects` `Objects Changed`** (reason: **`objects`**) are wired. **`orchestrateAffordanceRequest`** is still a stub: it logs ingress and does **not** call **`ensureAffordanceTopology`**, emit stream outbounds, or drive terminal **`PublishMessage`** (that follows when **`affordanceCache`** + **`Affordances Pertain`** land).

**Initiative:** [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md). **Parent decisions:** [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (**D32-D38**, **D37** three-layer pipeline).

**Precedent:** [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) (pass-through orchestration layer).

## Getting Started

1. **Child plan** --- [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md) (affordance pipeline diagram, module layout, D32 intake/`ensure*` placement).
2. **Render analogue** --- [`../renderOrchestration/`](../renderOrchestration/) (`index.ts`, `publishedEvents.ts`, `subscribedEvents.ts`, `orchestrationHandler.ts`, `fanOutStateChangedToPassiveRenders.ts`).
3. **Tests** --- From [`lambda/ephemera/`](../../): `npm test -- --watchAll=false dataSource/affordanceOrchestration/`.

## Why this layer exists (D37)

| Layer | Owns | Does not own |
| --- | --- | --- |
| **`affordanceOrchestration`** | Ingress normalization; intake; **`ensureAffordanceTopology`** call (when wired); stream outbounds; future LLM slow path | Dynamo writes; **`PublishMessage`**; ephemeraWire compose |
| **`affordanceCache`** (planned) | Invalidation; colocated **`Affordance::`** persist; **`Affordances Pertain`** | Terminal publish |
| **`perception`** | Terminal **`PublishMessage`** on **`Affordances Pertain`** | Topology pull; hydrate policy |

## What this layer does today

1. Subscribes to internal **`api.ephemera`** streaming envelopes with header type **`Affordances Requested`** (`sendAffordancesRequested` in [`subscribedEvents.ts`](subscribedEvents.ts)).
2. Subscribes to **`mtw.ephemera.objects` `Objects Changed`** and fans out via [`fanOutAffordanceRefreshForRoom.ts`](fanOutAffordanceRefreshForRoom.ts) (direct **`orchestrateAffordanceRequest`**, mirror render **`State Changed`**).
3. Maps **`Affordances Requested`** ingress to **`AffordancesRequested`** and calls **`orchestrateAffordanceRequest`** ([`orchestrationHandler.ts`](orchestrationHandler.ts)) --- log only; no **`streamEvent`** yet.
4. Defines **five outbound** payload types in [`publishedEvents.ts`](publishedEvents.ts). **v1-active:** **`Slice Ready`**, **`Orchestration Error`**. **Future LLM:** **`Enrichment Started`**, **`Enrichment Complete`**, **`Enrichment Deferred`** (contract encoded in skipped tests).

**External adapters (outside this DataSource):**

| Trigger | Helper | Dispatch |
| --- | --- | --- |
| Internal bus **`type: 'RoomUpdate'`** | [`sendAffordanceRefreshRequestedForRoom.ts`](sendAffordanceRefreshRequestedForRoom.ts) | **`sendAffordancesRequested`** (reason: **`roster`**, default bus lane) |

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

**Not yet wired:** **`TopologyInvalidated`** fan-out (reason: **`topology`**).

## Interim behavior (until cache slice)

Roster and object changes **do not** emit affordance **`PublishMessage`** rows yet. Legacy **`publishRoomAffordancePerceptionMessages`** has no production callers; terminal publish moves to perception on **`Affordances Pertain`** in a later slice.

## Stream outbounds (contract)

| Outbound | v1 | Subscriber (planned) |
| --- | --- | --- |
| **`Slice Ready`** | Active types; emission deferred | **`affordanceCache`** handoff |
| **`Orchestration Error`** | Active types; emission deferred | Diagnostics / cache |
| **`Enrichment Started`** | Skipped tests | Future slow path |
| **`Enrichment Complete`** | Skipped tests | Future slow path |
| **`Enrichment Deferred`** | Skipped tests | Future slow path |

**Routing:** lean **`roomId`**, **`perspective`**, **`perspectiveKey`** on every outbound (mirror render **`componentId`** routing).

## Stream skeleton sequencing

Order for the affordance pass-through slice (aligned with render):

1. Land **types** + **skipped** contract tests ([`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), enrichment guards in [`publishedEvents.test.ts`](publishedEvents.test.ts)).
2. Wire **`orchestrateAffordanceRequest`** emissions (**`Slice Ready`**, **`Orchestration Error`**) and **un-skip** producer tests.
3. Scaffold **`affordanceCache`** subscription + thin integration test (render analogue: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts)).

## Tests and verification

**Primary tests:** [`publishedEvents.test.ts`](publishedEvents.test.ts), [`subscribedEvents.test.ts`](subscribedEvents.test.ts), [`orchestrationHandler.test.ts`](orchestrationHandler.test.ts), [`index.test.ts`](index.test.ts), [`fanOutAffordanceRefreshForRoom.test.ts`](fanOutAffordanceRefreshForRoom.test.ts), [`sendAffordanceRefreshRequestedForRoom.test.ts`](sendAffordanceRefreshRequestedForRoom.test.ts), [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts).

From [`lambda/ephemera/`](../../):

```bash
npm test -- --watchAll=false dataSource/affordanceOrchestration/
```

**Hygiene (grep):** no production path outside **`affordanceOrchestration`** ingress should call **`publishRoomAffordancePerceptionMessages`** directly:

```bash
rg 'publishRoomAffordancePerceptionMessages' lambda/ephemera --glob '!**/affordanceOrchestration/**'
```

Expected: definition in [`publishRoomAffordancePerceptionMessages.ts`](../perception/publishRoomAffordancePerceptionMessages.ts) only (retained for future **`Affordances Pertain`** terminal path).

## Key concepts

- **`reason`** gates whether **`ensureAffordanceTopology`** runs when wired (**topology** vs roster/objects-only refresh). See parent [ComponentStackMerge vs perception (D38)](../../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md#componentstackmerge-vs-perception-d38).
- **Two dispatch paths:** external triggers (**`RoomUpdate`**) enqueue **`Affordances Requested`**; in-DS subscribers (**`Objects Changed`**) call **`orchestrateAffordanceRequest`** directly (mirror render **`State Changed`**).
- **Outgoing types:** [`publishedEvents.ts`](publishedEvents.ts) (**`publisherStrategy: 'busOnly'`**); ephemera-local until a client boundary needs **`mtw-interfaces`**.

## Current constraints

- **`replayable: false`**; no EventBridge external contract in this scaffold.
- **`ensureAffordanceTopology`** lives under **`affordanceCache/`** when implemented; orchestration **calls** it (**D32**), does not implement hydrate inline.
