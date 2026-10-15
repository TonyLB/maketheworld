# mtw.ephemera.affordanceOrchestration

## Status

**M4 orchestration + cache + perception terminal (landed).** Pass-through migration to **`publish`** + boundary **`flushAndSettle`** is complete (P3). This directory is the canonical home for the `mtw.ephemera.affordanceOrchestration` DataSource. Production adapters from **`RoomUpdate`** (reason: **`roster`**), **`mtw.ephemera.positions` `Ludic Cache Invalidated`** (reason: **`objects`**), and **`mtw.assets.componentTopology` `TopologyInvalidated`** (reason: **`topology`**) are wired. **`orchestrateAffordanceRequest`** calls **`ensureAffordanceTopology`** when needed and emits **`Slice Ready`** / **`Orchestration Error`**. Terminal **`PublishMessage`** is emitted by **`mtw.ephemera.perception`** on **`Affordances Pertain`** (**D38**, [`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts)).

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
2. Subscribes to **`mtw.ephemera.positions` `Ludic Cache Invalidated`** and fans out via [`fanOutAffordanceRefreshForRoom.ts`](fanOutAffordanceRefreshForRoom.ts) (direct **`orchestrateAffordanceRequest`**, mirror render **`State Changed`**), reason **`objects`**. This is the room live-update trigger; `Object Moved` no longer fans out rooms (it only bumps non-room catalogs, below).
3. Subscribes to **`mtw.assets.componentTopology` `TopologyInvalidated`** (room-scoped only): **`await handleTopologyInvalidated`** (AFF-CACHE-4), then **`fanOutAffordanceRefreshForRoom`** with reason **`topology`** (area-scoped v1 no-op).
4. Subscribes to **`mtw.connections` `Character Registered`** (session orientation affordance channel: [`../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts`](../connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) registers **`sessionOrientationAffordances`**, then **`await orchestrateAffordanceRequest`** in the same `receiveEvents` invocation; guards in [`../connectionsCharacterRegistered/subscribedEvents.ts`](../connectionsCharacterRegistered/subscribedEvents.ts)).
5. Maps **`Affordances Requested`** ingress to **`AffordancesRequested`** and calls **`orchestrateAffordanceRequest`** ([`orchestrationHandler.ts`](orchestrationHandler.ts)) --- **`ensureAffordanceTopology`** when catalog stale or reason **`topology`**; emits **`Slice Ready`** / **`Orchestration Error`** via **`streamEvent`**.
6. Defines **five outbound** payload types in [`publishedEvents.ts`](publishedEvents.ts). **v1-active:** **`Slice Ready`**, **`Orchestration Error`**. Outbounds use **`outboundBusDelivery: 'publish'`** on the DataSource; boundary **`flushAndSettle`** at lambda exit quiesces concurrent subscribers (no producer-side scoped flush).

### Ingress styles

| Style | When | Examples |
| --- | --- | --- |
| **Direct `orchestrateAffordanceRequest`** | Producer is already inside affordanceOrchestration `receiveEvents` (or shares `streamEvent` in the same invocation) | Session orientation affordances, Ludic Cache Invalidated fan-out, TopologyInvalidated fan-out |
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

### `mtw.ephemera.positions` **`Ludic Cache Invalidated`**

Handled in [`index.ts`](index.ts) **`receiveEvents`**: **`fanOutAffordanceRefreshForRoom`** with reason **`objects`** for each id in `roomIds` (one **`orchestrateAffordanceRequest`** per distinct occupant perspective). **The rule: when a room's `ludicCache` is invalidated, an occupied room rebuilds and re-renders its affordances.** The occupancy check lives in `resolveAffordanceRefreshGroupsForRoom` (an empty room yields no groups, so no rebuild). The room set is the cache's own invalidation set (`roomsInvalidatedByHosts`: every room reachable upward from each written host), so a deep move, a rename or a relational change refreshes the room too, not only the move's endpoints. The fact is published after the stored marker is bumped, so the header's read of the stored row always finds it stale and rebuilds; this consumer is an async push, off any command's response path. Rules: [`positions/AGENT.contract.md` --- Ludic cache staleness and rebuild](../positions/AGENT.contract.md#ludic-cache-staleness-and-rebuild).

### `mtw.ephemera.positions` **`Object Moved`**

**Rooms no longer refresh from this event.** A room refresh is driven by its cache's invalidation (above), not by the move's `froms`/`to`; `Object Moved` is kept here only for the non-room catalog bump below. **Rooms are still the only host kind with a live-update channel**: Feature/Character/Object are pull, not push --- a player sees their render only by looking, and gets no standing subscription to changes thereafter (this module's whole job is the room live-update channel; it has no analogue for the other three kinds and should not grow one for this).

**The pull-side gap is closed (nestedObjectLook, shipped 2026-09-22).** [`nonRoomHostsAffectedByObjectMoved.ts`](nonRoomHostsAffectedByObjectMoved.ts) reduces the same published `froms`/`to` down to the non-Room hostable kinds among them (`EphemeraObjectId | EphemeraFeatureId | EphemeraCharacterId`), and [`bumpNonRoomHostCatalogsForObjectMoved.ts`](bumpNonRoomHostCatalogsForObjectMoved.ts) bumps each affected host's `Cache::${perspectiveKey}` catalog rows --- reusing `renderCache`'s own `conditionalInvalidateCatalogRow`/`queryCatalogRowsForComponent`, mirroring [`handleExampleInvalidated.ts`](../renderCache/handleExampleInvalidated.ts)'s bump-only/no-push shape (see [`renderCache/AGENT.md`](../renderCache/AGENT.md) for the producer-side symmetry). This is the whole of the `Object Moved` branch in [`index.ts`](index.ts); the room refresh is a separate reaction to a different fact (`Ludic Cache Invalidated`). A cached `look <object>` no longer serves stale nested contents across repeated looks after a hosted member moves in or out.

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

**Hygiene (grep):** no production path should bypass **`handleAffordancesPertain`** on **`Affordances Pertain`** for terminal affordance **`PublishMessage`** rows (production path is **`affordanceOrchestration`** ingress -> **`affordanceCache`** -> **`Affordances Pertain`**).

## Key concepts

- **`reason`** gates whether **`ensureAffordanceTopology`** runs when catalog is already hydrated:

| **`Affordances Requested` reason** | **`ensureAffordanceTopology`** | Compose |
| --- | --- | --- |
| **`topology`** | Run when catalog stale | Yes --- exits may have changed |
| **`roster`** | Skip when catalog already hydrated | Yes --- roster changed |
| **`objects`** | Skip when catalog already hydrated | Yes --- the room's `ludicCache` was invalidated |

- **`AffordanceRoomDeliverable`** is **not** an ingress center --- terminal compose runs in perception on **`Affordances Pertain`** only ([`../perception/handleAffordancesPertain.ts`](../perception/handleAffordancesPertain.ts)).
- **Two dispatch paths:** external triggers (**`RoomUpdate`**) enqueue **`Affordances Requested`**; in-DS subscribers (**`Ludic Cache Invalidated`**, **`TopologyInvalidated`**) call **`fanOutAffordanceRefreshForRoom`** -> **`orchestrateAffordanceRequest`** directly (mirror render **`State Changed`**).
- **A roster change refreshes on `RoomUpdate` and never on `Ludic Cache Invalidated`, deliberately.** A bystander move (arrival, departure, connect, disconnect) writes no room graph and bumps no cache marker, because the room's cache holds no character; `RoomUpdate` (reason **`roster`**) is the only signal. A character rename takes the same path (`dataSource/characterComponentUpdated.ts` invalidates `CharacterMeta` and the room memos, then publishes `RoomUpdate` per room the character stands in). `Ludic Cache Invalidated` (reason **`objects`**) means the room's structure or an object's name changed.
- **What the header reads:** the three cache rows in one `getItems` (`LudicCache::`, `LudicCacheVersion::`, and `LudicCache::Characters` via `withCharacters: true`), then per-character `CharacterMeta` and `CharacterSessions` to hydrate the roster. The header reads no `Meta::Room`.
- **Outgoing types:** [`publishedEvents.ts`](publishedEvents.ts) (**`publisherStrategy: 'busOnly'`**); ephemera-local until a client boundary needs **`mtw-interfaces`**.

## Current constraints

- **`replayable: false`**; no EventBridge external contract in this scaffold.
- **`ensureAffordanceTopology`** lives under **`affordanceCache/`**; orchestration **calls** it (**D32**), does not implement hydrate inline. **Nav (**D34**): [`getRoomExitTargetsForCharacter`](../actions/roomExitTargetsForCharacter.ts) calls it directly (sync bypass; no bus orchestration or publish).
