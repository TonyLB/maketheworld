# mtw.ephemera.affordanceOrchestration

## Status

**M4 orchestration + cache + perception terminal (landed).** Pass-through migration to **`publish`** + boundary **`flushAndSettle`** is complete (P3). This directory is the canonical home for the `mtw.ephemera.affordanceOrchestration` DataSource. Production adapters from **`RoomUpdate`** (reason: **`roster`**), **`mtw.ephemera.objects` `Objects Changed`** (reason: **`objects`**), and **`mtw.assets.componentTopology` `TopologyInvalidated`** (reason: **`topology`**) are wired. **`orchestrateAffordanceRequest`** calls **`ensureAffordanceTopology`** when needed and emits **`Slice Ready`** / **`Orchestration Error`**. Terminal **`PublishMessage`** is emitted by **`mtw.ephemera.perception`** on **`Affordances Pertain`** (**D38**, [`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts)).

**Steady-state docs:** [`../affordanceCache/AGENT.md`](../affordanceCache/AGENT.md), [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md) (**Area topology and affordance exits**), [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md). **Precedent:** [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) (pass-through orchestration layer).

## Getting Started

1. **Topology source** --- [`packages/mtw-gateways/ts/assets/components/componentTopology/`](../../../../packages/mtw-gateways/ts/assets/components/componentTopology/) + **`projectRoomExits`** in **`mtw-wml`**; hydrate via **`ensureAffordanceTopology`** -> **`ComponentTopology.get`** -> **`ProjectedRoomTopology.exits`**.
2. **Render analogue** --- [`../renderOrchestration/`](../renderOrchestration/) (`index.ts`, `publishedEvents.ts`, `subscribedEvents.ts`, `orchestrationHandler.ts`, `fanOutStateChangedToPassiveRenders.ts`).
3. **Tests** --- From [`lambda/ephemera/`](../../): `npm test -- --watchAll=false dataSource/affordanceOrchestration/`.

## Why this layer exists (D37)

| Layer | Owns | Does not own |
| --- | --- | --- |
| **`affordanceOrchestration`** | Ingress normalization; intake; **`ensureAffordanceTopology`** call; stream outbounds; future LLM slow path | Dynamo writes; **`PublishMessage`**; ephemeraWire compose |
| **`affordanceCache`** | Invalidation; colocated **`Affordance::`** persist; **`Affordances Pertain`** (`outboundBusDelivery: 'publish'`, P4) | Terminal publish |
| **`perception`** | Terminal **`PublishMessage`** on **`Affordances Pertain`** | Topology pull; hydrate policy |

## What this layer does today

1. Subscribes to internal **`api.ephemera`** streaming envelopes with header type **`Affordances Requested`** (`sendAffordancesRequested` -> **`publish`** in [`subscribedEvents.ts`](subscribedEvents.ts)).
2. Subscribes to **`mtw.ephemera.objects` `Objects Changed`** and fans out via [`fanOutAffordanceRefreshForRoom.ts`](fanOutAffordanceRefreshForRoom.ts) (direct **`orchestrateAffordanceRequest`**, mirror render **`State Changed`**).
3. Subscribes to **`mtw.assets.componentTopology` `TopologyInvalidated`** (room-scoped only): **`await handleTopologyInvalidated`** (AFF-CACHE-4), then **`fanOutAffordanceRefreshForRoom`** with reason **`topology`** (area-scoped v1 no-op).
4. Subscribes to **`mtw.connections` `Character Registered`** (session orientation affordance channel: [`../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts`](../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) registers **`sessionOrientationAffordances`**, then **`await orchestrateAffordanceRequest`** in the same `receiveEvents` invocation; guards in [`../connectionsCharacterRegistered/subscribedEvents.ts`](../connectionsCharacterRegistered/subscribedEvents.ts)).
5. Maps **`Affordances Requested`** ingress to **`AffordancesRequested`** and calls **`orchestrateAffordanceRequest`** ([`orchestrationHandler.ts`](orchestrationHandler.ts)) --- **`ensureAffordanceTopology`** when catalog stale or reason **`topology`**; emits **`Slice Ready`** / **`Orchestration Error`** via **`streamEvent`**.
6. Defines **five outbound** payload types in [`publishedEvents.ts`](publishedEvents.ts). **v1-active:** **`Slice Ready`**, **`Orchestration Error`**. Outbounds use **`outboundBusDelivery: 'publish'`** on the DataSource; boundary **`flushAndSettle`** at lambda exit quiesces concurrent subscribers (no producer-side scoped flush).

### Ingress styles

| Style | When | Examples |
| --- | --- | --- |
| **Direct `orchestrateAffordanceRequest`** | Producer is already inside affordanceOrchestration `receiveEvents` (or shares `streamEvent` in the same invocation) | Session orientation affordances, Objects Changed fan-out, TopologyInvalidated fan-out |
| **Bus `Affordances Requested` kick** (`sendAffordancesRequested` -> `publish`) | External or cross-module producers not already in the orchestration handler graph | `RoomUpdate` / `sendAffordanceRefreshRequestedForRoom`, integration harnesses |

**External adapters (outside this DataSource):**

| Trigger | Helper | Dispatch |
| --- | --- | --- |
| Internal bus **`type: 'RoomUpdate'`** | [`sendAffordanceRefreshRequestedForRoom.ts`](sendAffordanceRefreshRequestedForRoom.ts) | **`sendAffordancesRequested`** -> **`publish`** (reason: **`roster`**) |
| **`mtw.assets.componentTopology` `TopologyInvalidated`** | [`index.ts`](index.ts) **`receiveEvents`** | **`handleTopologyInvalidated`** then **`fanOutAffordanceRefreshForRoom`** (reason: **`topology`**, room-scoped only) |

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

Handled in [`index.ts`](index.ts) **`receiveEvents`**: **`await handleTopologyInvalidated`** (AFF-CACHE-4), then room-scoped fan-out with reason **`topology`**; area-scoped events (no **`roomIds`**) are a v1 no-op (**D35**). **`affordanceCache`** may still receive the same event on its own subscription (idempotent catalog bump).

### `mtw.connections` **`Character Registered`**

Handled in [`index.ts`](index.ts) **`receiveEvents`**: [`handleCharacterRegisteredOrientation`](../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) with channel **`affordances`** (parallel with render orchestration on the same event). Registers **`sessionOrientationAffordances`** thread with **`characterId`** targets, then **`await orchestrateAffordanceRequest`** with routing identity only.

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

**Primary tests:** [`publishedEvents.test.ts`](publishedEvents.test.ts), [`subscribedEvents.test.ts`](subscribedEvents.test.ts), [`orchestrationHandler.test.ts`](orchestrationHandler.test.ts), [`index.test.ts`](index.test.ts), [`fanOutAffordanceRefreshForRoom.test.ts`](fanOutAffordanceRefreshForRoom.test.ts), [`sendAffordanceRefreshRequestedForRoom.test.ts`](sendAffordanceRefreshRequestedForRoom.test.ts), [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), [`../passThroughAffordanceOrchestrationToCache.integration.test.ts`](../passThroughAffordanceOrchestrationToCache.integration.test.ts), [`../characterRegisteredOrientation.integration.test.ts`](../characterRegisteredOrientation.integration.test.ts) (`Character Registered` ingress -> affordance channel -> `CHARACTER#` terminal).

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

- **`reason`** gates whether **`ensureAffordanceTopology`** runs when catalog is already hydrated:

| **`Affordances Requested` reason** | **`ensureAffordanceTopology`** | Compose |
| --- | --- | --- |
| **`topology`** | Run when catalog stale | Yes --- exits may have changed |
| **`roster`** | Skip when catalog already hydrated | Yes --- roster changed |
| **`objects`** | Skip when catalog already hydrated | Yes --- **`objects`** changed |

- **`AffordanceRoomDeliverable`** is **not** an ingress center --- terminal compose runs in perception on **`Affordances Pertain`** only ([`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts)).
- **Two dispatch paths:** external triggers (**`RoomUpdate`**) enqueue **`Affordances Requested`**; in-DS subscribers (**`Objects Changed`**, **`TopologyInvalidated`**) call **`fanOutAffordanceRefreshForRoom`** -> **`orchestrateAffordanceRequest`** directly (mirror render **`State Changed`**).
- **Outgoing types:** [`publishedEvents.ts`](publishedEvents.ts) (**`publisherStrategy: 'busOnly'`**); ephemera-local until a client boundary needs **`mtw-interfaces`**.

## Current constraints

- **`replayable: false`**; no EventBridge external contract in this scaffold.
- **`ensureAffordanceTopology`** lives under **`affordanceCache/`**; orchestration **calls** it (**D32**), does not implement hydrate inline. **Nav (**D34**): [`getRoomExitTargetsForCharacter`](../actions/roomExitTargetsForCharacter.ts) calls it directly (sync bypass; no bus orchestration or publish).
