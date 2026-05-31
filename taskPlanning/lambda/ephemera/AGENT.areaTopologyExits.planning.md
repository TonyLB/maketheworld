# Area topology exits (ephemera lambda) - planning

**Status:** In progress (M4). Milestone 4 consumer for parent initiative.

**Parent initiative:** [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (normative **D11**, **D18**, **D30**, **D32-D38** --- do not re-decide Area WML or assets invalidation here).

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

**Dispose** after M4 ships; move steady-state norms into [`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md), [`lambda/ephemera/dataSource/affordanceCache/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md), and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

---

## Purpose

Wire Ephemera **affordance-channel exits** and **navigation** to **Area topology projection** at a character perspective, using the **render-analog three-layer pipeline** (**D37**):

1. Register **`internalCache.ComponentTopology`** (**`createComponentTopologyCacheHandler`**).
2. Add **`mtw.ephemera.affordanceOrchestration`** --- **`Affordances Requested`** ingress, **`orchestrateAffordanceRequest`**, **`ensureAffordanceTopology`** preflight (**D32**).
3. Add **`mtw.ephemera.affordanceCache`** --- colocated **`Affordance::${perspectiveKey}`** rows (**D33**); **`TopologyInvalidated`** catalog bump; **`Affordances Pertain`** outbound.
4. **`mtw.ephemera.perception`** --- terminal **`PublishMessage`** per occupant on **`Affordances Pertain`**; compose via **`ComponentStackMerge`** (**D38**).
5. Refactor **`ComponentStackMerge`** (**D30**) to compose ephemeraWire from hydrated topology + ephemera-only fields.
6. Align **`getRoomExitTargetsForCharacter`** with the same exit list (**D34**).

**Assets side (verification only):** [`mtw.assets.componentTopology`](../../../lambda/assets/componentTopology/index.ts) already publishes **`TopologyInvalidated`**. No assets code changes expected unless integration tests expose gaps.

---

## Getting Started

1. [`taskPlanning/AGENT.md`](../../AGENT.md) --- task plan conventions.
2. Parent pipeline + caching: [`AGENT.areaTopologyExits.planning.md`](../../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (**Caching architecture**, **Affordance pipeline (M4)**, **ComponentStackMerge vs perception (D38)**).
3. **Render pipeline precedent (required):** [`renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md) (**`Render Requested`** -> **`ensureAuthoredCatalog`** -> **`Render Pertains`** -> perception).
4. **`affordanceCache` hydrate module precedent:** [`renderCache/ensureAuthoredCatalog.ts`](../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts), [`handleExampleInvalidated.ts`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts).
5. Gateways topology pull: [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Component topology read surfaces**).
6. Today affordance path (migration source): [`componentStackMerge.ts`](../../../lambda/ephemera/internalCache/componentStackMerge.ts), [`publishRoomAffordancePerceptionMessages.ts`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts), [`roomUpdate/index.ts`](../../../lambda/ephemera/roomUpdate/index.ts).
7. Nav path: [`roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) --- sync **`ensureAffordanceTopology`** + **`AffordanceCache.getAffordanceRow`** (**D34**, shipped).
8. Multi-channel contract: [`AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md).

**Test command authority:** `cd lambda/ephemera && npm test`. Gateways: `cd packages/mtw-gateways && npm test -- ts/assets/components/componentTopology/`.

---

## Affordance pipeline (normative, D37)

Mirror render pass-through. **No legacy trigger may call `publishRoomAffordancePerceptionMessages` directly once orchestration ships.**

```text
Ingress                         affordanceOrchestration           affordanceCache              perception
-----                           -----------------------           -------------              ----------

RoomUpdate (roster)     ----\
Objects Changed         ----+--> Affordances Requested  -----> ensureAffordanceTopology (D32)
TopologyInvalidated     ----/    orchestrateAffordanceRequest       when stale + reason needs topology
  -> catalog bump first          intake (reason: roster | objects | topology)
                                 stream: Slice Ready | Orchestration Error (v1)
                                       |
                                       v
                                 persist slice + catalog ready
                                       |
                                       v
                                 Affordances Pertain  ---------> handleAffordancesPertain
                                                                    ComponentStackMerge.get (D38)
                                                                    PublishMessage per occupant
```

**Layer rules:**

| Layer | Owns | Does not own |
| --- | --- | --- |
| **`affordanceOrchestration`** | Ingress normalization; intake; **`ensureAffordanceTopology`** call; stream outbounds; future LLM slow path | Dynamo writes; **`PublishMessage`**; ephemeraWire compose |
| **`affordanceCache`** | **`handleTopologyInvalidated`**; colocated **`Affordance::`** row persist (**D33**); **`Affordances Pertain`** | Terminal publish; roster / **`objects`** |
| **`perception`** | **`Affordances Pertain`** subscriber; terminal **`PublishMessage`** | Topology pull; hydrate policy |
| **`ComponentStackMerge`** | Compose memo on terminal path (**D38**) | Bus ingress; **`ensure*`** |

**Invalidation handler must not call `ComponentTopology.get`.** Diagnostics heal (if added later) bumps catalog only --- no eager hydrate.

---

## Locked decisions (parent register)

| ID | Status | Summary |
| --- | --- | --- |
| **D32** | [X] | **`ensureAffordanceTopology`** in **`orchestrateAffordanceRequest`** after intake, before cache handoff. Nav calls exported ensure + slice read only. |
| **D33** | [X] | Colocated **`Affordance::${perspectiveKey}`** row: version metadata + embedded **`ProjectedRoomTopology.exits`**. No separate **`TOPOLOGY#`** body row in M4. |
| **D34** | [X] | Nav sync bypass: **`getRoomExitTargetsForCharacter`** -> **`ensureAffordanceTopology`** + **`AffordanceCache.get`**; no **`Affordances Requested`** / publish. Limitations documented in parent **D34**. |
| **D35** | [X] | Invalidation layer participation: bump only **`Affordance::`** rows whose **`assetStack`** includes **`editAssetId`** (mirror **`handleExampleInvalidated`**). Area-scoped events with no **`roomIds`**: v1 no-op. |
| **D36** | [X] | Hydrate single-flight: **`ensureAffordanceTopology`** wraps stale path in coalesce **`singleFlight`** keyed **`roomId::perspectiveKey`**; all callers (orchestration, nav) share one pool; follower **`retrieval`** polls catalog (mirror **`ensureAuthoredCatalog`**). |
| **D37** | [X] | Three-layer pipeline: **`affordanceOrchestration`** + **`affordanceCache`** + perception terminal publish. |
| **D38** | [X] | **`ComponentStackMerge`** stays **`internalCache`** compose memo; perception terminal only. |

---

## Navigation sync path (D34)

**Normative:** [`getRoomExitTargetsForCharacter`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) --- **`ensureAffordanceTopology`** then **`internalCache.AffordanceCache.get`** (or documented read helper returning **`ProjectedRoomTopology.exits`**). **Not** **`Affordances Requested`**.

**Accepted limitations (document in action + `affordanceCache/AGENT.md`):**

1. **Synchronous command path** --- may await hydrate (and **D36** single-flight) in the same lambda invocation; no bus orchestration.
2. **No affordance publish** --- resolving **`go east`** does not refresh other occupants' affordance-channel headers.
3. **Deterministic slice only (v1)** --- future LLM enrichment row(s), if added, are not consulted for nav until product revisits.

---

## Planned module layout

| Piece | Path (create in M4) |
| --- | --- |
| Orchestration DataSource | [`lambda/ephemera/dataSource/affordanceOrchestration/index.ts`](../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) |
| Orchestration handler | `orchestrationHandler.ts` (`orchestrateAffordanceRequest`) |
| Ingress helpers | `sendAffordanceRefreshRequested.ts`, `subscribedEvents.ts`, `publishedEvents.ts` |
| Cache DataSource | [`lambda/ephemera/dataSource/affordanceCache/index.ts`](../../../lambda/ephemera/dataSource/affordanceCache/index.ts) |
| Invalidation | `handleTopologyInvalidated.ts` |
| Hydrate preflight | `ensureAffordanceTopology.ts` | Called from orchestration (**D32**) and nav (**D34**); wraps stale path in singleFlight (**D36**); **not** from **`AffordanceCache.get`** |
| Single-flight hydrate | `singleFlightAffordanceTopologyHydrate.ts` | Mirror [`singleFlightAuthoredCatalogHydrate.ts`](../../../lambda/ephemera/dataSource/renderCache/singleFlightAuthoredCatalogHydrate.ts) (**D36**) |
| Cache inbound | `handleAffordanceOrchestrationInbound.ts` |
| Cache outbound | `handleAffordancesPertain.ts` (or inline in index `receiveEvents`) |
| Catalog / persist | `affordanceCatalogRow.ts`, `hydrateAffordanceTopology.ts` (names TBD) | Single conditional put of colocated **`Affordance::`** row (**D33**) |
| Gateway package | [`packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) |
| InternalCache handler | [`lambda/ephemera/internalCache/affordanceCache.ts`](../../../lambda/ephemera/internalCache/affordanceCache.ts) |
| Perception terminal | [`perception/orchestrateAffordances.ts`](../../../lambda/ephemera/dataSource/perception/orchestrateAffordances.ts) (name TBD) |
| Navigation | [`roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) | Sync **`ensureAffordanceTopology`** + **`AffordanceCache.get`** (**D34**) |
| ComponentTopology registration | [`lambda/ephemera/internalCache/index.ts`](../../../lambda/ephemera/internalCache/index.ts) |

**v1 orchestration outbounds (active):** **`Slice Ready`**, **`Orchestration Error`**.

**Skipped tests (future LLM enrichment):** **`Enrichment Started`**, **`Enrichment Complete`**, **`Enrichment Deferred`** --- encode contract before behavior (mirror render pass-through discipline).

**`ensureAffordanceTopology` sketch (pseudocode --- not implemented):**

```typescript
// orchestrateAffordanceRequest (D32) and getRoomExitTargetsForCharacter (D34)
// D36: same singleFlight wrapper for all callers (mirror ensureAuthoredCatalog)
async function ensureAffordanceTopology(roomId, perspectiveKey, mergeParticipationOrder) {
  const catalog = await loadOrCreateCatalogRow(roomId, perspectiveKey, /* perspective */)
  if (!isCatalogRowStale(catalog)) return

  await runWithSingleFlightAffordanceTopologyHydrate({
    category: EPHEMERA_AFFORDANCE_TOPOLOGY_HYDRATE_CATEGORY,
    argumentHash: affordanceTopologyHydrateSingleFlightKey(roomId, perspectiveKey),
    computation: async () => {
      const current = await getCatalogRow(roomId, perspectiveKey)
      if (current === undefined || !isCatalogRowStale(current)) return
      internalCache.ComponentTopology.invalidate(
        componentTopologyPerspectiveCacheKey({ roomUniversalKey: roomId, mergeParticipationOrder })
      )
      const projected = await internalCache.ComponentTopology.get({ roomUniversalKey: roomId, mergeParticipationOrder })
      await hydrateAffordanceTopologyRow({ roomId, perspectiveKey, projected, incomingCatalogVersion: current.catalogVersion })
      await markCatalogHydratedAtVersion(roomId, perspectiveKey, current.catalogVersion)
    },
    retrieval: async () => {
      const current = await getCatalogRow(roomId, perspectiveKey)
      if (current === undefined || isCatalogRowStale(current)) {
        throw new Error('AFFORDANCE_TOPOLOGY_HYDRATE_FOLLOWER_NOT_READY')
      }
    },
  })
}
```

---

## Invalidation matrix (D11)

| Event | Handler | Topology catalog | Orchestration ingress |
| --- | --- | --- | --- |
| **`TopologyInvalidated`** | **`handleTopologyInvalidated`** | Per **`roomId`**: query **`Affordance::`** rows; bump only where **`assetStack`** includes **`editAssetId`** (**D35**). Area-scoped (**no `roomIds`**): no-op. | **`Affordances Requested`** (**reason: topology**) fan-out per listed **`roomId`** only |
| **`RoomUpdate`** | adapter -> orchestration | No | **`Affordances Requested`** (**reason: roster**) |
| **`Objects Changed`** | adapter -> orchestration | No | **`Affordances Requested`** (**reason: objects**) |

Orchestration **reason** gates whether **`ensureAffordanceTopology`** runs (see parent [ComponentStackMerge vs perception (D38)](../../packages/mtw-wml/AGENT.areaTopologyExits.planning.md#componentstackmerge-vs-perception-d38)).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`.

- [X] **Lock D32-D38** in parent + this file.
- [X] Scaffold **`mtw.ephemera.affordanceOrchestration`** (DataSource shell, skipped outbound tests, **`orchestrateAffordanceRequest`** stub).
- [X] Migrate ingress adapters: **`roomUpdate`**, **`perception` `Objects Changed`** -> **`Affordances Requested`** (remove direct publish).
- [X] Register **`internalCache.ComponentTopology`**.
- [X] **D30:** **`ComponentStackMerge`** -> **`ComponentAggregate`** for **`shortName`**; read topology from **`AffordanceCache`**; layered overlay tests.
- [X] Scaffold **`mtw.ephemera.affordanceCache`** + subscribe **`TopologyInvalidated`** + orchestration outbounds.
- [X] Implement **`handleTopologyInvalidated`** (catalog bump only).
- [X] Implement **`ensureAffordanceTopology`** + Dynamo persist + **`internalCache.AffordanceCache`** memo.
- [X] Wire orchestration -> cache -> **`Affordances Pertain`** (sync v1 path).
- [X] **`perception`:** subscribe **`Affordances Pertain`**; terminal publish via **`ComponentStackMerge`** (**D38**).
- [X] **D34:** Wire nav sync path (**`ensureAffordanceTopology`** + **`AffordanceCache.get`**); document limitations.
- [ ] Topology fan-out on **`TopologyInvalidated`** -> **`Affordances Requested`**.
- [ ] Affordance publish smoke + nav **`ambiguousMatch`** regression.
- [ ] **`packages/mtw-gateways`** affordanceCache types + durable **`AGENT.md`** files (gateway module landed; **`packages/mtw-gateways/AGENT.md`** subsection added).

---

## Verification

```bash
cd lambda/ephemera
npm test -- --watchAll=false dataSource/affordanceOrchestration/
npm test -- --watchAll=false internalCache/componentStackMerge.test.ts internalCache/affordanceCache.test.ts dataSource/affordanceCache/
npm test -- --watchAll=false dataSource/actions/roomExitTargetsForCharacter.test.ts

cd packages/mtw-gateways
npm test -- --watchAll=false ts/assets/components/componentTopology/ ts/ephemera/affordanceCache/
```

Expand as modules land: affordanceCache hydrate, orchestration-to-cache integration, perception **`Affordances Pertain`** handler (shipped), nav sync path **D34** (shipped).

**Hygiene (grep):** After migration, no production path outside **`affordanceOrchestration`** ingress should call **`publishRoomAffordancePerceptionMessages`** directly.

---

## Progress

| Step | Status |
| --- | --- |
| Child plan (this file) | Done |
| D32-D38 locked | Done |
| `affordanceOrchestration` scaffold | Done |
| Ingress adapters (RoomUpdate / Objects Changed) | Done |
| `ComponentTopology` on InternalCache | Done |
| D30 ComponentStackMerge refactor | Done |
| `affordanceCache` DataSource + hydrate | Done |
| Perception `Affordances Pertain` handler | Done |
| Nav shared topology path (D34 implementation) | Done |
