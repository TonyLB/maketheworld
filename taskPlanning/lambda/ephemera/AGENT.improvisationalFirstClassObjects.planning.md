# Improvisational first-class objects (planning)

**Status:** Not started. **Next:** Phase 0 --- lock storage row shape, perspective append rules, and `StandardObject` minimal fields before implementation.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md).

## Purpose

Capture a **task-scoped** plan to promote runtime **`<Object>`** entities from the bespoke **`Meta::Room.objects`** flat list into **first-class improvisational components**:

- **`ASSET#IMPROVISATION`** as the **logical last merge layer** in participation order (overlay on canon / personal blueprint layers).
- **Physical storage in `ephemeraDB`** (play-state authority), not the assets DynamoDB table.
- **`StandardObject`** (stub-first) in **`mtw-wml`**, with **`OBJECT#`** promoted into **`ComponentUUID`**.
- **Composite reads** so **`ComponentData` + improvisation** participates in **`ComponentAggregate`** merges without forking merge math.
- **Placement** via **`positionGraph`** (room membership today; relational edges deferred), replacing room-embedded object lists as the source of truth.

This file is disposable after the initiative completes. Steady-state architecture belongs in package **`AGENT*.md`** files next to code (especially [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), [`lambda/ephemera/dataSource/objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md), [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md)).

## Goal (target steady state)

| Concern | Today (v1 shipped) | Target |
| --- | --- | --- |
| **Existence** | Rows on **`Meta::Room.objects`** (`EphemeraMetaRoomObject[]`) | **`StandardObject`** body stored under improvisational layer; **`Meta::Object`** on ephemera for play extensions as needed |
| **Storage table** | ephemeraDB (embedded on room meta) | ephemeraDB **`(OBJECT#, Meta::Object)`** or pair-shaped rows compatible with component fetch; **not** assetDB |
| **Merge participation** | N/A (not `StandardComponent`) | Append **`ASSET#IMPROVISATION`** last in **`perspective.assetStack`** when improvisation layer is active |
| **Placement** | Implicit (parent room list) | **`Meta::Room.positionGraph`** **`OBJECT`** nodes (+ future edges); positions lane owns graph mutations |
| **WML wire** | Nested **`<Object>`** under **`<Room>`** (ephemeraWire only) | Top-level **`StandardObject`** in affordance/render **`StandardForm`**; room-nested wire during transition if needed |
| **Coyote** | Acme -> **`handleAcmeOrderAddObjects`** -> room list | Acme -> create **`OBJECT#`** + improvisation row + graph node in delivery room |

**Non-goals for early phases:** asset blueprint authoring of objects; relational edges (`On`, `In`, inventory containers); client UI for object editing; global object catalog outside Coyote demo scope unless needed for tests.

## Architecture decisions (working --- lock in Phase 0)

These reflect design discussion; unresolved forks live in [**Open decisions**](#open-decisions-implementation---plan-only).

1. **`ASSET#IMPROVISATION` is logical, not proof of assetDB residence.** Participation-order merge treats it like any other layer; rows live in **ephemeraDB**.
2. **Split existence vs placement.** Component body (+ Coyote **`stableKey`** / trope fields) vs **where** the object is (**`positionGraph`**). Same pattern as character roster display vs graph nodes ([`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md)).
3. **Ephemera owns writes.** **`mtw.ephemera.objects`** and **`mtw.ephemera.positions`** (or a coordinated transaction) persist improvisation rows and graph updates. **Do not** route through **`cacheAsset`** or assets-table S3 sync.
4. **Read parallelism via composite gateway.** Extend **`ComponentDataParticipationLoader`**: canon/personal layers from **assetDB** (existing handler); **`ASSET#IMPROVISATION`** layer from **ephemeraDB** improvisation reader. **`authoritativeFromParticipationOrder`** unchanged.
5. **Coyote-first consumer.** First vertical slice: Acme order delivery, hypothesis staged-object snapshots, affordance WML compose. General **`Objects Change`** ingress migrates on the same persistence path.
6. **Precedent:** Coyote **authored** overlay asset ([`AGENT.CoyoteGame.implementation.md`](../../AGENT.CoyoteGame.implementation.md)) uses assetDB merge shape; **improvisation** uses the same merge *algebra* with different *provenance* and *table*.

## Scope and boundaries

### In scope

- **`mtw-interfaces`:** `Meta::Object` type(s), `EphemeraPlayPositionGraph` node union extension for **`Object`**, improvisation constants (`ASSET#IMPROVISATION`), type guards.
- **`mtw-wml`:** Stub **`StandardObject`** / **`StandardObjectData`**; promote **`OBJECT#`** in **`ComponentUUID`** / schema; **`ephemeraWire`** ingest/emit; asset mode continues to reject authored objects until a later product decision.
- **`mtw-gateways`:** Improvisation component read handler; **`createCompositeComponentDataCacheHandler`** (name TBD) wiring asset + ephemera readers; gateway ownership row in [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md).
- **`lambda/ephemera`:** Persistence modules, **`internalCache`** registration, **`mtw.ephemera.objects`** handler refactor, perspective append helper, **`AffordanceRoomDeliverable`** migration, Coyote snapshot loaders, tests.
- **`lambda/ephemera/dataSource/positions`:** Room graph **`OBJECT`** node apply (slice 5+ v1: nodes only, no in-room edges).
- **Dual-read / dual-write transition** for **`Meta::Room.objects`** until consumers migrate (explicit sunset in Phase 6).

### Explicit deferrals

- Asset Workbench authoring of **`<Object>`** in blueprint assets.
- Character inventory graphs and **container-scale** `positionGraph`.
- Relational edges (box on table).
- **`renderOrchestration`** subscription to object changes (not required for Coyote affordance slice; see [`objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md) follow-ups).
- EventBridge replay contract for **`mtw.ephemera.objects`** outbound events.

## Current anchor points

| Concern | Location |
| --- | --- |
| Room object list persist + bus | [`lambda/ephemera/dataSource/objects/`](../../lambda/ephemera/dataSource/objects/) |
| Acme -> objects | [`handleAcmeOrderAddObjects.ts`](../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) |
| Room meta type | [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraMetaRoomObject`, `EphemeraPlayPositionGraph`) |
| Ephemera vs asset component reads | [`componentData.AGENT.md`](../../lambda/ephemera/internalCache/componentData.AGENT.md), [`componentEphemeraMeta.AGENT.md`](../../lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md) |
| Aggregate merge | [`packages/mtw-gateways/ts/assets/components/aggregate/`](../../packages/mtw-gateways/ts/assets/components/aggregate/) |
| Perspective assembly | [`fanOutStateChangedToPassiveRenders.ts`](../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts), [`kickRoomHeaderBroadcast.ts`](../../lambda/ephemera/dataSource/perception/kickRoomHeaderBroadcast.ts) |
| Affordance room WML compose | [`affordanceRoomDeliverable.ts`](../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) |
| Play graph (characters only v1) | [`positions/membership/positionGraphMerge.ts`](../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts), [`positions/AGENT.contract.md`](../../lambda/ephemera/dataSource/positions/AGENT.contract.md) |
| Coyote staged object text | [`coyoteRoomObjectSnapshot.ts`](../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) |
| WML Object (not StandardComponent today) | [`packages/mtw-wml/ts/standardize/components/room.ts`](../../packages/mtw-wml/ts/standardize/components/room.ts), [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) |
| Positions target model (objects in graph) | [`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (**Target mental model**) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) for checkbox and verification conventions.
2. Read the shipped objects lane: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md).
3. Read positions graph roles and the **objects vs flat list** target note: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (Target mental model + **Objects and `mtw.ephemera.objects`**).
4. Read component read split: [`lambda/ephemera/internalCache/componentData.AGENT.md`](../../lambda/ephemera/internalCache/componentData.AGENT.md) vs [`componentEphemeraMeta.AGENT.md`](../../lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md).
5. Read gateway ownership norms: [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md) (**Component data**, **aggregate**, ephemera positions pattern as analogy for ephemera-owned rows + gateway reader).
6. Trace one Acme delivery: [`actions/index.ts`](../../lambda/ephemera/dataSource/actions/index.ts) -> **`handleAcmeOrderAddObjects`** -> **`Objects Changed`** -> affordance fan-out.
7. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../lambda/ephemera/AGENT.testing.md). Run from **`lambda/ephemera/`**:
   - Baseline: `npm run test -- --watchAll=false dataSource/objects/handleApiObjectsChange.test.ts`
   - Gateway (when touched): `cd packages/mtw-gateways && npm test`
   - WML (when touched): `cd packages/mtw-wml && npm test`

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in durable **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and **`AGENT.concepts.md`** only for graduated vocabulary) and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **I1** | **Ephemera row shape:** `Meta::Object` single row per `OBJECT#` vs mirror asset pair shape `(EphemeraId: OBJECT#, DataCategory: ASSET#IMPROVISATION)` in ephemeraDB for mechanical reuse of `standardComponentPairFromAssetDbGetItemsRow` | Phase 2 gateway reader | Open |
| **I2** | **Coyote-only fields:** store `stableKey`, `tropeAffinities`, `tropeAffinitiesFailed` on `StandardObject` JSON, on `Meta::Object` extensions, or split (body vs play meta) | Phase 2 types, hypothesis loaders | Open |
| **I3** | **Perspective append policy:** always append `ASSET#IMPROVISATION` when any objects exist in scope vs Coyote-demo rooms only vs session-scoped improvisation asset id | Phase 4 orchestration | Open |
| **I4** | **`Objects Changed` payload:** evolve to object-id / graph-diff semantics vs keep room-scoped `priorObjects`/`newObjects` during dual-write | Phase 5 bus contract | Open |
| **I5** | **Object adjacency index:** reverse lookup row(s) for `OBJECT#` -> host room (mirror character `POSITION#ROOM#`) vs derive only from room graph scans | Phase 4 positions, drift repair | Open |
| **I6** | **Affordance WML during transition:** top-level `StandardObject` components vs continue room-nested `<Object>` children until client merge updates | Phase 5 perception | Open |

## Progress

| Phase | Summary | Status |
| --- | --- | --- |
| 0 | Lock decisions I1--I6; anchor inventory; compatibility story | Not started |
| 1 | `StandardObject` stub + `OBJECT#` in `ComponentUUID` | Not started |
| 2 | ephemeraDB improvisation persistence + cache handler | Not started |
| 3 | Composite `ComponentData` (+ improvisation) for aggregate | Not started |
| 4 | `positionGraph` `OBJECT` nodes + placement apply | Not started |
| 5 | Coyote/objects lane migration off `Meta::Room.objects` | Not started |
| 6 | Consumer migration + dual-write sunset | Not started |
| 7 | Durable docs + delete this plan | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] **Phase 0 --- contracts and inventory**
  - [ ] Resolve **I1** (row shape) and **I2** (Coyote field placement); document in [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) sketch or ADR comment block pending implementation.
  - [ ] Resolve **I3** (perspective append) and **I5** (adjacency index); align with [`positions/AGENT.contract.md`](../../lambda/ephemera/dataSource/positions/AGENT.contract.md) slice boundaries.
  - [ ] List all **`Meta::Room.objects`** read/write sites (grep + table in this file or linked temp analysis); classify: migrate in Phase 5 vs tolerate dual-read through Phase 6.
  - [ ] Define **`ASSET#IMPROVISATION`** constant and synthetic zone label (no `Meta::Asset` row in assetDB required for v1).
  - [ ] Define dual-write / dual-read window: which paths write both room list and improvisation rows until sunset.

- [ ] **Phase 1 --- `StandardObject` stub (`mtw-wml` + interfaces)**
  - [ ] Add **`Object`** to **`SchemaComponent`** / **`ComponentUUID`** / **`defaultComponentFromTag`** / **`standardComponentFactory`** (minimal fields: **`shortName`**; optional Coyote extensions per **I2**).
  - [ ] **`StandardObject`** class stub: `fromJSON`, `toJSON`, `schema`, `merge` (likely replace-or-additive for improvisation-only instances).
  - [ ] **`ephemeraWire`:** allow top-level **`<Object uuid=(...)>`** in `StandardForm`; keep asset **`validate()`** rejecting non-empty authored object inventories until product opens blueprint authoring.
  - [ ] Tests: round-trip stub object; asset mode rejection unchanged; aggregate default stub for `OBJECT#` id ([`assemble.ts`](../../packages/mtw-gateways/ts/assets/components/aggregate/assemble.ts) parity).

- [ ] **Phase 2 --- ephemeraDB improvisation storage**
  - [ ] Implement persist helpers: create / update / delete improvisation object rows (spawn, clear-all for Coyote **`Await RoadRunner`**).
  - [ ] Add **`internalCache.ImprovisationComponentData`** (name TBD) or extend **`ComponentEphemeraMeta`** with object kind --- register on [`internalCache/index.ts`](../../lambda/ephemera/internalCache/index.ts).
  - [ ] Add **`mtw-gateways`** ephemera improvisation read module (pair fetch for `(OBJECT#, ASSET#IMPROVISATION)`); document ownership row in [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md).
  - [ ] Invalidation contract: object spawn/move/destroy invalidates improvisation cache, affected room **`AffordanceRoomDeliverable`**, **`ComponentEphemeraMeta`** / positions memo as needed.

- [ ] **Phase 3 --- composite `ComponentData` (+ improvisation)**
  - [ ] Implement **`createCompositeComponentDataCacheHandler`**: delegate non-improvisation asset ids to existing **`ComponentDataCache`** (assetDB); delegate **`ASSET#IMPROVISATION`** to ephemera improvisation reader.
  - [ ] Wire ephemera **`InternalCache.ComponentData`** (or aggregate slice) to composite handler; verify **`ComponentAggregate.get`** returns merged **`StandardObject`** when improvisation layer is last in participation order.
  - [ ] Add **`appendImprovisationToPerspective(assetStack)`** helper (respect **I3**); unit tests for perspective key stability when improvisation layer present vs absent.

- [ ] **Phase 4 --- `positionGraph` placement (nodes only)**
  - [ ] Extend **`EphemeraPlayPositionGraphNode`** union with **`tag: 'Object'`**, **`universalKey: EphemeraObjectId`**; relax **`edges`** guard only as needed for empty edges (slice 5+ relational edges still deferred).
  - [ ] Positions API: **place object in room** / **remove object from room** graph (pure end-state apply pattern aligned with [`updatePositionGraphs`](../../lambda/ephemera/dataSource/positions/membership/updatePositionGraphs.ts)).
  - [ ] Implement **I5** (adjacency index or scan policy) and diagnostics posture for duplicate placement drift.
  - [ ] Coordinate transact bundle: improvisation row create + graph node add (+ optional dual-write to **`Meta::Room.objects`** during transition).

- [ ] **Phase 5 --- migrate `mtw.ephemera.objects` + Coyote**
  - [ ] Refactor **`handleAcmeOrderAddObjects`**: mint `OBJECT#`, persist improvisation row, apply graph placement, emit **`Objects Changed`** (shape per **I4**).
  - [ ] Refactor **`handleApiObjectsChangeCommand`** / **`mergePersistMetaRoomObjects`** to target improvisation + graph (or thin wrapper calling new modules).
  - [ ] Update **`loadCoyoteRoomObjectsByRoom`** / **`formatCoyoteStagedObjectsByRoom`** to read from improvisation index + graph (not **`Meta::Room.objects`**).
  - [ ] Update **`collectCoyoteOccupiedStableKeys`** / **`countCoyotePlacedObjectsAcrossRooms`** for new storage.
  - [ ] Refactor **`AffordanceRoomDeliverable`**: build objects from composite aggregate or improvisation query + graph projection (**I6**).

- [ ] **Phase 6 --- consumer migration and sunset**
  - [ ] Remove dual-write to **`Meta::Room.objects`** when affordance, hypothesis, and tests no longer depend on room list.
  - [ ] Deprecate **`EphemeraMetaRoomObject`** on room meta (or keep empty with guard); update **`isEphemeraMetaRoom`** validation.
  - [ ] Client affordance merge: verify **Contents:** line still works if wire shape changes (**I6**); coordinate with charcoal-client only if server wire changes.
  - [ ] Graduate **Target mental model** bullets in [`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) to **Shipped** where implemented; add **`AGENT.contract.md`** obligations for object graph nodes.

- [ ] **Phase 7 --- durable docs and cleanup**
  - [ ] Update [`objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md), [`internalCache/AGENT.md`](../../lambda/ephemera/internalCache/AGENT.md), [`packages/mtw-wml` component docs](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md).
  - [ ] Update [`AGENT.CoyoteGame.md`](../../AGENT.CoyoteGame.md) / implementation doc: objects are no longer "not first-class."
  - [ ] Delete this planning file (git retains history).

## Verification

Run from repo root paths below after each phase that touches the area.

| Area | Command |
| --- | --- |
| Ephemera objects lane | `cd lambda/ephemera && npm run test -- --watchAll=false dataSource/objects/` |
| Ephemera positions (Phase 4+) | `cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/` |
| Ephemera affordance compose (Phase 5+) | `cd lambda/ephemera && npm run test -- --watchAll=false internalCache/affordanceRoomDeliverable.test.ts` |
| Coyote snapshots (Phase 5+) | `cd lambda/ephemera && npm run test -- --watchAll=false dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.test.ts` |
| Gateways (Phase 2--3) | `cd packages/mtw-gateways && npm test` |
| WML (Phase 1) | `cd packages/mtw-wml && npm test` |
| Interfaces (Phase 0--2) | `cd packages/mtw-interfaces && npm test` |

**Integration smoke (manual / future harness):** Acme order in Coyote demo room -> object appears in affordance-channel WML -> hypothesis pipeline sees staged object line -> **`Await RoadRunner`** clears improvisation rows and graph nodes.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Perspective / cache key churn when improvisation appended | Append only when layer non-empty; document **`computePerspectiveKey`** impact; invalidate render/affordance caches on object bus events (existing **`Objects Changed`** fan-out). |
| Dual-write drift between room list and graph | Short transition only; tests assert parity; single coordinator function for spawn/clear. |
| `cacheAsset` or assets diagnostics touching improvisation | ephemeraDB-only storage; no `Meta::Asset` in assetDB for improvisation in v1. |
| Aggregate merge with stub canon layers + real improvisation layer | Golden test: `OBJECT#` with participation order `[canon..., ASSET#IMPROVISATION]` yields improvisation `shortName`. |
| Positions contract slice creep (edges, inventory) | Phase 4 explicitly **nodes only**; edges stay in positions **Target** until a follow-on plan. |

## When this plan finishes

Move lasting material into:

- [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (graduated object graph vocabulary)
- [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (normative graph node rules)
- [`lambda/ephemera/dataSource/objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md) (steady-state objects lane)
- [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md) (improvisation read gateway ownership)
- [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardObject**)

Then delete this file per [`taskPlanning/AGENT.md`](../../AGENT.md).
