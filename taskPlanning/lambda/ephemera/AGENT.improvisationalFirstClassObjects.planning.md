# Improvisational first-class objects (planning)

**Status:** Phase 6 complete. **Next:** Phase 7 durable docs + cleanup. **Locked:** **I1**--**I6**.

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
| **Existence** | Rows on **`Meta::Room.objects`** (`EphemeraMetaRoomObject[]`) | **Two rows per `OBJECT#`:** merge body on **`(OBJECT#, ASSET#IMPROVISATION)`**; Coyote play meta on **`(OBJECT#, Meta::Object)`** |
| **Storage table** | ephemeraDB (embedded on room meta) | ephemeraDB pair row + **`Meta::Object`** meta row per object; **not** assetDB |
| **Merge participation** | N/A (not `StandardComponent`) | Always append **`ASSET#IMPROVISATION`** last in **`perspective.assetStack`** when any improvisational objects exist in scope (**I3**) |
| **Placement** | Implicit (parent room list) | **`Meta::Room.positionGraph`** **`OBJECT`** nodes + **`POSITION#ROOM#...`** adjacency (**I5**); positions lane owns graph mutations and **`Object Moved`** facts (**I4**) |
| **WML wire** | Nested **`<Object>`** under **`<Room>`** (ephemeraWire only) | **Normative affordance shape** (**I6**): room-nested **`<Object>`** --- affordances are **of the room**; nesting expresses in-room placement; **`StandardObject`** is merge/storage only, projected to **`StandardRoom.objects[]`** at compose |
| **Coyote** | Acme -> **`handleAcmeOrderAddObjects`** -> room list | Acme -> create **`OBJECT#`** + improvisation pair row + **`Meta::Object`** (stableKey / tropes) + graph node in delivery room |

**Non-goals for early phases:** asset blueprint authoring of objects; relational edges (`On`, `In`, inventory containers); client UI for object editing; global object catalog outside Coyote demo scope unless needed for tests; **top-level `<Object>` siblings under `<Asset>` on affordance wire** (**I6** --- rejected by design, not a deferred migration).

## Architecture decisions (working --- lock in Phase 0)

These reflect design discussion; unresolved forks live in [**Open decisions**](#open-decisions-implementation---plan-only). Locked **I1**--**I6** are in [**Decided (Phase 0)**](#decided-phase-0).

1. **`ASSET#IMPROVISATION` is logical, not proof of assetDB residence.** Participation-order merge treats it like any other layer; rows live in **ephemeraDB**.
2. **Split body vs play meta vs placement.** Merge body (**`shortName`**, future WML fields) on **`(OBJECT#, ASSET#IMPROVISATION)`**; Coyote **`stableKey`** / trope fields on **`Meta::Object`**; **where** the object is on **`positionGraph`** + **`POSITION#ROOM#...`** adjacency (**I5**). Same three-way split as character blueprint pair vs **`Meta::Character`** vs graph membership ([`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md)).
3. **Ephemera owns writes.** **`mtw.ephemera.objects`** and **`mtw.ephemera.positions`** (or a coordinated transaction) persist improvisation rows and graph updates. **Do not** route through **`cacheAsset`** or assets-table S3 sync.
4. **Read parallelism via ephemera composite `ComponentData`.** Extend **`ComponentDataParticipationLoader`** on ephemera **`internalCache`**: canon/personal layers from **assetDB** (existing **`ComponentDataCache`**); **`ASSET#IMPROVISATION`** layer from **ephemeraDB** improvisation reader. **`authoritativeFromParticipationOrder`** unchanged. **Not** a new **`mtw-gateways`** surface --- assets/diagnostics keep assetDB-only **`ComponentData`**.
5. **Coyote-first consumer.** First vertical slice: Acme order delivery, hypothesis staged-object snapshots, affordance WML compose. General **`Objects Change`** ingress migrates on the same persistence path.
6. **Precedent:** Coyote **authored** overlay asset ([`AGENT.CoyoteGame.implementation.md`](../../AGENT.CoyoteGame.implementation.md)) uses assetDB merge shape; **improvisation** uses the same merge *algebra* with different *provenance* and *table*.

## Scope and boundaries

### In scope

- **`mtw-interfaces`:** **`EphemeraMetaObject`** (`Meta::Object` play meta: **`stableKey`**, trope fields); extend **`ephemeraPositionAdjacency`** for **`OBJECT#`** PK; `EphemeraPlayPositionGraph` node union extension for **`Object`**; improvisation constants (`ASSET#IMPROVISATION`); type guards.
- **`mtw-wml`:** Stub **`StandardObject`** / **`StandardObjectData`** (**`shortName`** only for v1 --- no Coyote fields on merge JSON); promote **`OBJECT#`** in **`ComponentUUID`** / schema; **`ephemeraWire`** ingest/emit; asset mode continues to reject authored objects until a later product decision.
- **`mtw-gateways`:** Improvisation component read handler (`createImprovisationComponentDataCacheHandler`); gateway ownership row in [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md). **No** composite **`ComponentData`** router here.
- **`lambda/ephemera`:** Persistence modules, **`internalCache`** registration (including Phase 3 **ephemera-only** composite **`ComponentData`** router over assetDB + improvisation readers), **`mtw.ephemera.objects`** handler refactor, perspective append helper, **`AffordanceRoomDeliverable`** migration, Coyote snapshot loaders, tests.
- **`lambda/ephemera/dataSource/positions`:** Room graph **`OBJECT`** node apply (slice 5+ v1: nodes only, no in-room edges).
- **Clean cutover** off **`Meta::Room.objects`** (empty legacy data; no dual-write / dual-read window --- see [**Migration cutover (Phase 0)**](#migration-cutover-phase-0)).

### Explicit deferrals

- Asset Workbench authoring of **`<Object>`** in blueprint assets.
- Character inventory graphs and **container-scale** `positionGraph`.
- Relational edges (box on table).
- **`renderOrchestration`** subscription to object changes (not required for Coyote affordance slice; see [`objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md) follow-ups).
- EventBridge replay contract for **`mtw.ephemera.objects`** or **`Object Moved`** outbound events.

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
| Placement fact pattern (`Character Moved`) | [`positions/publishedEvents.ts`](../../lambda/ephemera/dataSource/positions/publishedEvents.ts), [`membership/buildCharacterMovedFact.ts`](../../lambda/ephemera/dataSource/positions/membership/buildCharacterMovedFact.ts) |
| Coyote staged object text | [`coyoteRoomObjectSnapshot.ts`](../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) |
| WML (not StandardComponent today) | [`packages/mtw-wml/ts/standardize/components/object.ts`](../../packages/mtw-wml/ts/standardize/components/object.ts), [`room.ts`](../../packages/mtw-wml/ts/standardize/components/room.ts), [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) |
| Positions target model (objects in graph) | [`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (**Target mental model**) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) for checkbox and verification conventions.
2. Read the shipped objects lane: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md).
3. Read positions graph roles and the **objects vs flat list** target note: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (Target mental model + **Objects and `mtw.ephemera.objects`**).
4. Read component read split: [`lambda/ephemera/internalCache/componentData.AGENT.md`](../../lambda/ephemera/internalCache/componentData.AGENT.md) vs [`componentEphemeraMeta.AGENT.md`](../../lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md).
5. Read gateway ownership norms: [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md) (**Component data**, **aggregate**, ephemera positions pattern as analogy for ephemera-owned rows + gateway reader).
6. Trace one Acme delivery: [`actions/index.ts`](../../lambda/ephemera/dataSource/actions/index.ts) -> **`handleAcmeOrderAddObjects`** -> (today) **`Objects Changed`** -> affordance fan-out; target: positions **`Object Moved`** on graph apply (**I4**).
7. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../lambda/ephemera/AGENT.testing.md). Run from **`lambda/ephemera/`**:
   - Baseline: `npm run test -- --watchAll=false dataSource/objects/handleApiObjectsChange.test.ts`
   - Gateway (when touched): `cd packages/mtw-gateways && npm test`
   - WML (when touched): `cd packages/mtw-wml && npm test`

## Decided (Phase 0)

Record here until implementation ships into **`AGENT.contract.md`** / **`AGENT.implementation.md`**; then remove this section per [`taskPlanning/AGENT.md`](../../AGENT.md).

### I1 --- Dual ephemera rows per `OBJECT#`

**Both** row shapes; distinct roles (not either/or):

| Row | Key | Role |
| --- | --- | --- |
| **Improvisation pair** | `(EphemeraId: OBJECT#, DataCategory: ASSET#IMPROVISATION)` | **`StandardObject`** merge body --- mechanical reuse of **`standardComponentPairFromAssetDbGetItemsRow`** via ephemeraDB improvisation reader |
| **Play meta** | `(EphemeraId: OBJECT#, DataCategory: Meta::Object)` | Ephemera-only extensions that **do not** participate in asset-stack merge (see **I2**) |

**Invariants:** one pair row and one **`Meta::Object`** row per spawned object; spawn/clear coordinators write both in the same transact when both apply; never duplicate **`shortName`** on **`Meta::Object`**.

### I2 --- Coyote fields on `Meta::Object`

**`stableKey`**, **`tropeAffinities`**, and **`tropeAffinitiesFailed`** live on **`EphemeraMetaObject`** (`Meta::Object`), **not** on **`StandardObject`** / improvisation pair JSON. Hypothesis loaders, occupancy keyed by **`stableKey`**, and Coyote snapshot formatters read **`Meta::Object`** (or a dedicated cache handler), not aggregate merge output.

**Wire / affordance:** player-visible **`shortName`** comes from improvisation pair / **`ComponentAggregate`**; Coyote machine fields stay server-side on **`Meta::Object`**.

### I3 --- Always append improvisation layer

When **any** improvisational objects exist in the render/merge **scope** (room perspective, object-id aggregate read, etc.), **always** append **`ASSET#IMPROVISATION`** as the **last** entry in **`perspective.assetStack`** / participation order. No Coyote-room-only or session-scoped improvisation asset id for v1.

**Rationale:** perspective keys and aggregate reads stay uniform; empty improvisation layers are not appended (no objects in scope -> skip append).

### I4 --- Bus events: object-id facts vs placement facts

**`mtw.ephemera.objects` (existence lane):** evolve outbound contract to **object-id / graph-diff** semantics --- which **`OBJECT#`** ids were created or destroyed --- not room-scoped **`priorObjects`** / **`newObjects`** snapshots. **`Objects Change`** ingress follows the same id-oriented shape during migration off **`Meta::Room.objects`**.

**`mtw.ephemera.positions` (placement lane):** object arrival / relocation in a room is a **positions** fact, mirroring **`Character Moved`** --- target header **`Object Moved`** on **`mtw.ephemera.positions`** with graph-diff **`froms[]`** / **`to`** (room ids), emitted at membership apply when an **`OBJECT`** node is placed or removed. Coyote affordance refresh and similar placement-driven fan-in should subscribe to **`Object Moved`**, not **`Objects Changed`**, once shipped (see deferred note in [`positions/AGENT.contract.md`](../../lambda/ephemera/dataSource/positions/AGENT.contract.md)).

### I5 --- Object adjacency reverse index

Mirror character **`POSITION#ROOM#...`** adjacency: **`EphemeraId: OBJECT#...`**, **`DataCategory: POSITION#ROOM#...`**. One row per host room; multi-room drift yields multiple rows under the same object PK. Extend [`ephemeraPositionAdjacency.ts`](../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.ts) and positions gateway **`getMembershipContainers`** (or object-scoped sibling) accordingly. **Conflict policy:** stored room **`positionGraph`** wins; adjacency kept in sync at persist (same as characters, **S2-5**).

### I6 --- Affordance wire: room-nested `<Object>` by design

Affordance-channel WML is **room-scoped**: we send **affordances of a room** (exits, roster refs, in-room contents). Objects belong **under** **`<Room>`** in ephemeraWire because nesting is the wire expression of **in-room placement** --- aligned with **`positionGraph`** membership and unlike **Character**, where top-level siblings carry display fields the room row only references.

**Normative affordance / Coyote wire:**

- Emit **room-nested** **`<Object uuid=(...)><ShortName>...</ShortName></Object>`** children of the affordance **`<Room>`** (not top-level **`<Asset>`** siblings).
- **`StandardObject`** remains the **server merge / persistence protocol** (improvisation pair, **`ComponentAggregate`**). **`AffordanceRoomDeliverable`** projects graph-placed ids + merged **`shortName`** into **`StandardRoom.objects[]`** before schema emit --- the compose pipeline changes; the wire vocabulary does not.
- **Client:** no charcoal-client work expected; [`formatRoomContentsLine`](../../charcoal-client/src/slices/messages/roomHeaderPhaseC.ts) already reads **`StandardRoom.objects`**.

**Rejected (not deferred):** top-level **`Object`** components alongside **`<Room>`** under **`<Asset>`** on affordance **`StandardForm`** / WML. That shape treats objects like authored asset inventory; it does not express room placement and would fork affordance merge semantics without improving the **Contents:** line. **`StandardObject`** first-class status does **not** imply top-level affordance wire.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in durable **`AGENT.contract.md`** / **`AGENT.implementation.md`** (and **`AGENT.concepts.md`** only for graduated vocabulary) and remove the row here.

_All Phase 0 implementation forks (**I1**--**I6**) are locked; see [**Decided (Phase 0)**](#decided-phase-0). Re-open here only if implementation discovers a blocker._

## Meta::Room.objects site inventory (Phase 0)

Classification for migration off the flat room list. Tests under **`dataSource/objects/`** cover persistence handlers; not listed individually.

| Classification | File | Role |
| --- | --- | --- |
| **Removed Phase 6** | [`mergePersistMetaRoomObjects.ts`](../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) | Deleted --- Dynamo write on `objects` superseded by improvisation + graph |
| **Migrated Phase 5** | [`handleApiObjectsChange.ts`](../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) | API / Acme / clear handlers |
| **Migrate Phase 5** | [`objects/index.ts`](../../lambda/ephemera/dataSource/objects/index.ts) | DataSource wiring |
| **Migrate Phase 5** | [`affordanceRoomDeliverable.ts`](../../lambda/ephemera/internalCache/affordanceRoomDeliverable.ts) | Projects `meta.objects` into `StandardRoom.objects` |
| **Migrate Phase 5** | [`coyoteRoomObjectSnapshot.ts`](../../lambda/ephemera/dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.ts) | Coyote staged-object loaders |
| **Migrate Phase 5** | [`collectCoyoteOccupiedStableKeys.ts`](../../lambda/ephemera/dataSource/actions/stableKey/collectCoyoteOccupiedStableKeys.ts) | Coyote-wide `stableKey` occupancy |
| **Migrate Phase 5** | [`countCoyotePlacedObjectsAcrossRooms.ts`](../../lambda/ephemera/dataSource/actions/utilities/countCoyotePlacedObjectsAcrossRooms.ts) | Acme cap (20 objects) |
| **Migrate Phase 5** | Coyote hypothesis/outcome/candidate pipeline | `loadCoyoteRoomObjectsByRoom`, `formatCoyoteStagedObjectsByRoom`, `EphemeraMetaRoomObject` prompts |
| **Migrate Phase 5** | [`objects/events.ts`](../../lambda/ephemera/dataSource/objects/events.ts), [`localApiEvents.ts`](../../lambda/ephemera/dataSource/localApiEvents.ts) | Bus ingress/outbound room-list shape |
| **Migrate Phase 5** | [`affordanceOrchestration/index.ts`](../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) | Subscribes `Objects Changed` for affordance refresh |
| **Removed Phase 6** | [`ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) | `objects` removed from `EphemeraMetaRoom`; `EphemeraMetaRoomObject` retained as ingress add-row type only |
| **Wire unchanged (compose Phase 5)** | [`room.ts`](../../packages/mtw-wml/ts/standardize/components/room.ts), [`roomHeaderPhaseC.ts`](../../charcoal-client/src/slices/messages/roomHeaderPhaseC.ts) | `StandardRoom.objects` wire/UI shape (**I6**) |
| **Types extend (Phase 0 shipped)** | [`ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`ephemeraPositionAdjacency.ts`](../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.ts), [`baseClasses.ts`](../../packages/mtw-interfaces/ts/baseClasses.ts), [`fetch.ts`](../../packages/mtw-gateways/ts/assets/components/componentData/fetch.ts) | `EphemeraMetaObject`, adjacency `OBJECT#` PK, `IMPROVISATION_ASSET_ID`, `ComponentPairPersistedFields` |

## Migration cutover (Phase 0)

**Preconditions (confirmed):** all `Meta::Room.objects` lists cleared in the only current database; no object spawn paths run between old-model and new-model deploys.

Given empty legacy data and no mid-migration writes, **dual-write to `Meta::Room.objects` and dual-read from it are unnecessary.**

| Topic | Decision |
| --- | --- |
| **Writers (Phase 4--5)** | Spawn/clear coordinator writes **only** pair + `Meta::Object` + graph + adjacency. **Do not** write `Meta::Room.objects`. |
| **Readers (Phase 5)** | Switch all consumers directly to graph + `Meta::Object` + aggregate/improvisation pair. |
| **`ComponentEphemeraMeta`** | May still fetch full `Meta::Room` row; `objects` field unused after cutover until Phase 6 type cleanup. |
| **Bus (I4)** | Ship object-id `Objects Changed` and `Object Moved` directly; skip legacy room-list dual-emit. |
| **Phase 6** | Dead-code removal (`mergePersistMetaRoomObjects`, `EphemeraMetaRoomObject` on room meta), not data migration. |

**Caveat:** precondition is environment-specific --- verify other deployed environments are empty before cutover, or reintroduce dual-write for that environment only.

## Progress

| Phase | Summary | Status |
| --- | --- | --- |
| 0 | Lock decisions I1--I6; anchor inventory; compatibility story | Complete |
| 1 | `StandardObject` stub + `OBJECT#` in `ComponentUUID` | Complete |
| 2 | ephemeraDB improvisation persistence + cache handler | Complete |
| 3 | Composite `ComponentData` (+ improvisation) for aggregate | Complete |
| 4 | `positionGraph` `OBJECT` nodes + placement apply | Complete |
| 5 | Coyote/objects lane migration off `Meta::Room.objects` | Complete |
| 6 | Legacy room-list code removal | Complete |
| 7 | Durable docs + delete this plan | Not started |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] **Phase 0 --- contracts and inventory**
  - [X] Resolve **I1** (dual row: improvisation pair + **`Meta::Object`**) and **I2** (Coyote fields on **`Meta::Object`** only).
  - [X] Resolve **I3** (always append **`ASSET#IMPROVISATION`** when objects in scope), **I4** (object-id bus on **`mtw.ephemera.objects`**; **`Object Moved`** on **`mtw.ephemera.positions`** for placement), **I5** (object **`POSITION#ROOM#...`** adjacency), and **I6** (room-nested affordance wire by design; project **`StandardObject`** to **`StandardRoom.objects`** at compose).
  - [X] Sketch **`EphemeraMetaObject`**, object adjacency PK extension, and dual-row invariants in [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) / [`ephemeraPositionAdjacency.ts`](../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.ts) (ADR comment block pending implementation).
  - [X] List all **`Meta::Room.objects`** read/write sites (grep + table in this file or linked temp analysis); classify: migrate in Phase 5 vs remove in Phase 6.
  - [X] Define **`ASSET#IMPROVISATION`** constant and synthetic zone label (no `Meta::Asset` row in assetDB required for v1).
  - [X] Define **clean cutover** strategy (empty DB; no dual-write / dual-read) --- see [**Migration cutover (Phase 0)**](#migration-cutover-phase-0).

- [X] **Phase 1 --- `StandardObject` stub (`mtw-wml` + interfaces)**
  - [X] Add **`Object`** to **`SchemaComponent`** / **`ComponentUUID`** / **`defaultComponentFromTag`** / **`standardComponentFactory`** (minimal fields: **`shortName`** only --- Coyote fields are **`Meta::Object`**, not **`StandardObject`** JSON).
  - [X] **`StandardObject`** class stub: `fromJSON`, `toJSON`, `schema`, `merge` (likely replace-or-additive for improvisation-only instances).
  - [X] **`ephemeraWire`:** **`StandardObject`** for merge/storage; affordance emit stays **room-nested** **`<Object>`** under **`<Room>`** only (**I6**); keep asset **`validate()`** rejecting non-empty authored object inventories until product opens blueprint authoring.
  - [X] Tests: round-trip stub object; asset mode rejection unchanged; aggregate default stub for `OBJECT#` id ([`assemble.ts`](../../packages/mtw-gateways/ts/assets/components/aggregate/assemble.ts) parity).

- [X] **Phase 2 --- ephemeraDB improvisation storage**
  - [X] Implement persist helpers: create / update / delete **both** `(OBJECT#, ASSET#IMPROVISATION)` and `(OBJECT#, Meta::Object)` in one coordinator (spawn; Coyote-scoped clear via **`gameRooms`** + **`positionGraph`** **`Object`** nodes for **`Await RoadRunner`** --- not global table scan).
  - [X] Add **`internalCache.ImprovisationComponentData`** for pair reads; sibling **`ObjectEphemeraMeta`** for **`Meta::Object`** --- register on [`internalCache/index.ts`](../../lambda/ephemera/internalCache/index.ts).
  - [X] Add **`mtw-gateways`** ephemera improvisation read module (pair fetch for `(OBJECT#, ASSET#IMPROVISATION)`); document ownership row in [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md).
  - [X] Invalidation contract: object spawn/move/destroy invalidates improvisation pair cache, **`Meta::Object`** memo, affected room **`AffordanceRoomDeliverable`**, room **`ComponentEphemeraMeta`** / positions memo as needed.

- [X] **Phase 3 --- composite `ComponentData` (+ improvisation)**
  - [X] Implement **`createEphemeraComponentDataCompositeCacheHandler`** in [`lambda/ephemera/internalCache/componentDataComposite.ts`](../../lambda/ephemera/internalCache/componentDataComposite.ts): delegate non-improvisation asset ids to existing **`ComponentDataCache`** (assetDB); delegate **`ASSET#IMPROVISATION`** to **`ImprovisationComponentData`**. Ephemera-local wiring only --- **not** **`mtw-gateways`** (assets/diagnostics keep assetDB-only handlers).
  - [X] Register composite as ephemera **`InternalCache.ComponentData`** for aggregate / **`GenerationContext`** consumers; keep **`ImprovisationComponentData`** registered for persist memo **`set`** / **`invalidate`**. Verify **`ComponentAggregate.get`** returns merged **`StandardObject`** when improvisation layer is last in participation order.
  - [X] Add **`appendImprovisationToPerspective(assetStack, objectIdsInScope)`** helper in [`packages/mtw-interfaces/ts/perspective.ts`](../../packages/mtw-interfaces/ts/perspective.ts) (**I3:** append when any objects in scope); unit tests for perspective key stability when improvisation layer present vs absent.

- [X] **Phase 4 --- `positionGraph` placement (nodes only)**
  - [X] Extend **`EphemeraPlayPositionGraphNode`** union with **`tag: 'Object'`**, **`universalKey: EphemeraObjectId`**; relax **`edges`** guard only as needed for empty edges (slice 5+ relational edges still deferred).
  - [X] Positions API: **place object in room** / **remove object from room** graph + **`POSITION#ROOM#...`** adjacency (**I5**); pure end-state apply aligned with [`updatePositionGraphs`](../../lambda/ephemera/dataSource/positions/membership/updatePositionGraphs.ts).
  - [X] Add **`Object Moved`** graph-diff fact on **`mtw.ephemera.positions`** at apply (mirror **`buildCharacterMovedFact`** / **`streamMembershipFact`**); diagnostics posture for duplicate placement drift.
  - [X] Coordinate transact bundle: improvisation pair + **`Meta::Object`** create + graph node + adjacency row.

- [X] **Phase 5 --- migrate `mtw.ephemera.objects` + Coyote**
  - [X] Refactor **`handleAcmeOrderAddObjects`**: mint `OBJECT#`, persist improvisation pair + **`Meta::Object`** (stableKey / tropes), apply graph placement (+ adjacency), emit object-id **`Objects Changed`** (**I4**); placement **`Object Moved`** comes from positions apply.
  - [X] Refactor **`handleApiObjectsChangeCommand`** / **`applyObjectsChange`** to target improvisation + graph (supersedes **`mergePersistMetaRoomObjects`**).
  - [X] Migrate affordance fan-in from **`Objects Changed`** to **`Object Moved`** for placement-driven room refresh (Coyote / **`fanOutAffordanceRefreshForRoom`** path).
  - [X] Update **`loadCoyoteRoomObjectsByRoom`** / **`formatCoyoteStagedObjectsByRoom`** to read **`Meta::Object`** + graph placement (not **`Meta::Room.objects`**); pair row supplies **`shortName`** where needed.
  - [X] Update **`collectCoyoteOccupiedStableKeys`** / **`countCoyotePlacedObjectsAcrossRooms`** to scan graph + **`Meta::Object`** **`stableKey`** (not room-embedded list).
  - [X] Refactor **`AffordanceRoomDeliverable`**: read object ids from graph + **`shortName`** from aggregate/improvisation; populate **`StandardRoom.objects[]`** for room-nested wire emit (**I6**).

- [X] **Phase 6 --- legacy room-list code removal**
  - [X] Delete **`mergePersistMetaRoomObjects`** and room-list write paths superseded in Phase 5.
  - [X] Deprecate **`EphemeraMetaRoomObject`** on room meta; update **`isEphemeraMetaRoom`** validation.
  - [X] Client affordance merge: verify **Contents:** line unchanged with new compose pipeline (**I6**); no charcoal-client work expected unless wire shape changes later.
  - [X] Graduate **Target mental model** bullets in [`positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) to **Shipped** where implemented; add **`AGENT.contract.md`** obligations for object graph nodes.

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

**Phase 6 verification (2026-06-17):** all passed.

| Area | Command | Result |
| --- | --- | --- |
| Ephemera objects + positions + affordance | `cd lambda/ephemera && npm run test -- --watchAll=false dataSource/objects/ internalCache/affordanceRoomDeliverable.test.ts dataSource/positions/` | 29 suites, 147 tests pass |
| Interfaces guards | `cd packages/mtw-interfaces && npm test -- ephemeraMeta` | 24 tests pass |
| Client Contents line (**I6**) | `cd charcoal-client && npm run test -- run src/slices/messages/roomHeaderPhaseC.test.ts` | 7 tests pass |
| Dead-code grep | `rg 'mergePersistMetaRoomObjects|updateKeys: \['\''objects'\''\]'` | zero hits (planning doc references only) |

**Integration smoke (manual / future harness):** Acme order in Coyote demo room -> **`Object Moved`** on delivery room -> affordance-channel WML updates -> hypothesis pipeline sees staged object line (from **`Meta::Object`**) -> **`Await RoadRunner`** clears improvisation pair rows, **`Meta::Object`** rows, graph nodes, and adjacency.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Perspective / cache key churn when improvisation appended | **I3:** append only when objects exist in scope; document **`computePerspectiveKey`** impact; invalidate render/affordance caches on **`Object Moved`** (placement) and object-id **`Objects Changed`** (existence). |
| Drift between improvisation pair and **`Meta::Object`** | Same coordinator transact for spawn/clear; tests assert both rows exist or both absent per **`OBJECT#`**. |
| `cacheAsset` or assets diagnostics touching improvisation | ephemeraDB-only storage; no `Meta::Asset` in assetDB for improvisation in v1. |
| Aggregate merge with stub canon layers + real improvisation layer | Golden test: `OBJECT#` with participation order `[canon..., ASSET#IMPROVISATION]` yields improvisation `shortName`. |
| Positions contract slice creep (edges, inventory) | Phase 4 explicitly **nodes only**; edges stay in positions **Target** until a follow-on plan. |

## When this plan finishes

Move lasting material into:

- [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (graduated object graph vocabulary)
- [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (normative graph node rules)
- [`lambda/ephemera/dataSource/objects/AGENT.md`](../../lambda/ephemera/dataSource/objects/AGENT.md) (steady-state objects lane)
- [`packages/mtw-gateways/AGENT.md`](../../packages/mtw-gateways/AGENT.md) (improvisation read gateway ownership)
- [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (**`EphemeraMetaObject`**, dual-row types)
- [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardObject**)

Then delete this file per [`taskPlanning/AGENT.md`](../../AGENT.md).
