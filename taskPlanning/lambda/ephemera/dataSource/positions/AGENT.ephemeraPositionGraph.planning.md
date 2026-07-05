# EphemeraPositionGraph --- play graph model and primitive consolidation

**Status:** P0 decision lock complete. Next step: land **EPG-8** interface renames, sketch class API stub, then **P1** core class + unit tests.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite context: Phase B relational vertical shipped ([`actions/AGENT.manipulationFrameAndRelational.planning.md`](../actions/AGENT.manipulationFrameAndRelational.planning.md)); positions manipulation kernel + shared adapter steady-state ([`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md)).

## Purpose

Introduce **`EphemeraPositionGraph`** --- an ephemera-owned in-memory model for **play manipulation** `positionGraph` truth --- and consolidate scattered functional primitives into class methods. Refactor existing membership and relational persist/legality paths to trust the model for graph observation, simulation, validation, and serialize/deserialize.

**Not** a WML `StandardPositionGraph` expansion. Design explicit adapters so future WML relational edge types can share **representation** without merging **authority** (authored blueprint vs live play vs snapshot import).

Retire this plan when durable docs land and Recommended order is complete; git retains history.

## Target architecture (steady-state sketch)

```text
Gateway read (PlayPositionGraph)     mtw-gateways/project.ts --- WML wire envelope; stays in mtw-gateways
        |
        |  fromPlayEnvelope(hostId, ...) --- normalize via gateway extract/project (EPG-4)
        v
EphemeraPositionGraph (class)        lambda/.../positionGraph/ --- host-bound play model (EPG-7, EPG-9)
        |  readonly hostId: EphemeraMembershipHostId
        |
        +--> toJSON() ---> EphemeraPositionGraphData (hostId + nodes + edges; mtw-interfaces)
        +--> toStored() -> EphemeraPositionGraphFieldPayload (= Omit<Data, 'hostId'>; Dynamo attribute only)
        |
        v
Kernel / planners / legality         simulate on EphemeraPositionGraph / EphemeraPositionGraph[] (EPG-9)
        |
        v
Coordinators + adjacency             transact reducers assign toStored() payload; row EphemeraId = host
```

**Data / class seam (EPG-7):** mirror `StandardPositionGraph` / `StandardPositionGraphData` --- canonical JSON in **`@tonylb/mtw-interfaces`**; manipulation **class** in **`lambda/ephemera/.../positionGraph/`**. Gateways speak `PlayPositionGraph` (read projection only).

**Host binding (EPG-9):** manipulation always uses host-bound graphs --- **`hostId` on class and on `EphemeraPositionGraphData`**. Persist omits `hostId` inside the nested attribute (`toStored()`); row **`EphemeraId`** remains authoritative. Assemble full data at the Dynamo read boundary; do not pass bare field payloads without host in application code.

**Class owns:** membership node CRUD, relational edge CRUD/extract/match, host-local validation helpers, equals/clone, `EphemeraPositionGraphData` <-> `PlayPositionGraph` adapter round-trip, `hostId` alignment checks on effects/patches.

**Class does not own:** adjacency rows, Dynamo transact items, `getMembershipContainers`, cache memo, stream facts, WML asset merge.

## Scope

### In scope

- New module tree: [`lambda/ephemera/dataSource/positions/positionGraph/`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/)
- **`EphemeraPositionGraph`** class + focused unit tests
- Consolidate primitives currently in:
  - [`membership/positionGraphMerge.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts)
  - [`manipulation/relational/relationalEdges.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/relationalEdges.ts)
- Deduplicate actions copy: [`actions/enrich/objectManipulation/relationalObservation.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalObservation.ts) --- actions imports positions model; delete duplicate extraction/match logic
- Refactor kernel + planners + transact reducers to use the class for in-memory graph work (behavior-preserving)
- Durable doc updates: authority boundary between **`EphemeraPositionGraph`** (play manipulation class), **`EphemeraPositionGraphData`** (interfaces JSON), and WML **`StandardPositionGraph`** (authored blueprint)
- **`mtw-interfaces` renames + host binding (EPG-8, EPG-9):** rename types per EPG-8; add **`hostId`** to **`EphemeraPositionGraphData`**; introduce **`EphemeraPositionGraphFieldPayload`** (`Omit<EphemeraPositionGraphData, 'hostId'>`) for `Meta::*.positionGraph` attribute + row validators --- **no new field written to Dynamo** (attribute shape unchanged)

### Out of scope (unless plan updated)

- WML heterogeneous `EdgeList` / `StandardRelationalEdge` implementation (future consolidation target --- class adapters only)
- Phase C compound kernel (`HostEffect[]` + `HostRelationalPatch[]` single transact) --- consumer of this model; separate plan slice
- World snapshot / backup bundle format
- Changing gateway cache handler API or Dynamo row shapes
- Client / charcoal workbench graph editors

## Background (durable docs --- link, do not duplicate)

| Topic | Doc |
| --- | --- |
| Graph roles (authored vs play vs presentation) | [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority) |
| Type boundary (`EphemeraPositionGraphData` vs `PlayPositionGraph`) | [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope) |
| Manipulation kernel layering | [`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) |
| WML `StandardPositionGraph` (Exit-only, asset merge) | [`packages/mtw-wml/ts/standardize/components/positionGraph.ts`](../../../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts), [`keys/edges/AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) |
| Gateway projection + id extract | [`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts) |
| Relational legality (actions) | [`actions/enrich/objectManipulation/evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read graph roles + type boundary in [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md).
3. Read current primitive modules (full file): [`positionGraphMerge.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts), [`relationalEdges.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/relationalEdges.ts), [`relationalObservation.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalObservation.ts) --- note duplicated `ObservedHostRelationalEdge` (rename to **`HostRelationalEdge`** per EPG-3) / extraction.
4. Trace kernel usage: [`applyHostEffects.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts), [`applyHostRelationalPatch.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostRelationalPatch.ts).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- Jest; run from **`lambda/ephemera/`**.
6. Baseline (must pass before edits):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/membership/positionGraphMerge.test.ts \
  dataSource/positions/manipulation/ \
  dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.test.ts \
  dataSource/actions/enrich/objectManipulation/compileRelational.test.ts
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in **`AGENT.contract.md`** / **`AGENT.implementation.md`** / **`AGENT.concepts.md`** (vocabulary only) and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| EPG-1 | **Class name** --- **`EphemeraPositionGraph`** (not `StandardPositionGraph`, not `PlayPositionGraph`) to mark play-manipulation authority | P1 module path | Decided |
| EPG-2 | **Mutation style** --- **immutable** instance methods return new `EphemeraPositionGraph` (match `StandardComponent` + current functional reducers); `clone()` + `equals()` for simulation loops | P1 API | Decided |
| EPG-3 | **Relational edge view type** --- **`HostRelationalEdge`** (parsed in-memory view) exported from `positionGraph/types.ts`; replaces **`ObservedHostRelationalEdge`** everywhere; stored JSON remains **`EphemeraPositionRelationalEdgeData`**; **`HostRelationalEdgeKind`** stays on `@tonylb/mtw-interfaces` | P1 types | Decided |
| EPG-4 | **Play envelope ingest** --- `fromPlayEnvelope(hostId, PlayPositionGraph)` normalizes gateway read via gateway extract helpers; `toPlayEnvelope()` delegates to `projectComponentGraphFromStoredPositionGraph(toStored())` --- **do not** duplicate projection logic inside the class long-term | P1 adapters | Decided |
| EPG-5 | **Legacy module fate** --- delete **`positionGraphMerge.ts`** and **`relationalEdges.ts`** immediately after refactor; update all import paths to `positionGraph/` (no re-export shims) | P2 migration | Decided |
| EPG-6 | **`effectiveRoomPositionGraph` / seed helpers** --- stay as factory functions on module boundary (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) wrapping class constructors, not methods on the class | P1 factories | Decided |
| EPG-7 | **Module placement + data/class seam** --- canonical JSON in **`mtw-interfaces`**; manipulation **class** in **`lambda/ephemera/.../positionGraph/`**; read projection + extract in **`mtw-gateways`**; **`PlayPositionGraph`** only via `fromPlayEnvelope(hostId, ...)` adapter | P0 architecture | Decided |
| EPG-8 | **Interfaces JSON renames** --- `EphemeraPlayPositionGraph` -> **`EphemeraPositionGraphData`**, `EphemeraPlayRelationalEdgeData` -> **`EphemeraPositionRelationalEdgeData`** (+ companion node/guard renames); **`PlayPositionGraph`** gateway name unchanged | P0/P1 types | Decided |
| EPG-9 | **Host binding** --- **`hostId: EphemeraMembershipHostId`** on **`EphemeraPositionGraphData`** and **`EphemeraPositionGraph`** (required); **`toJSON()`** returns full data; **`toStored()`** returns **`EphemeraPositionGraphFieldPayload`** (`Omit<..., 'hostId'>`); assemble `{ hostId, ...field }` at Dynamo read boundary; multi-host simulation uses **`EphemeraPositionGraph[]`** (upsert/find by `hostId`), not bare **`Record<hostId, graph>`** | P1 API | Decided |

### EPG-2 note (decided: immutable)

Immutable aligns with `StandardComponent`, current `addObjectToGraph` / kernel `computePostApplyGraphsFromEffects` patterns, and makes compound simulation (Phase C) safer. Instance methods return new instances; callers chain without mutating shared state.

### EPG-3 note (decided: `HostRelationalEdge`)

Three relational edge names, three roles:

| Name | Layer | Role |
| --- | --- | --- |
| **`EphemeraPositionRelationalEdgeData`** | `mtw-interfaces` JSON | Stored/wire envelope (`tag: 'Relational'`, ...) on `positionGraph.edges` |
| **`HostRelationalEdge`** | `positionGraph/types.ts` | Parsed in-memory view (`from`, `to`, `kind`, optional `relationLabel`) --- class API, legality, kernel simulation |
| **`HostRelationalEdgeKind`** | `mtw-interfaces` | Enum of allowed kinds |

Retire **`ObservedHostRelationalEdge`** (positions + actions duplicates) during P1/P3 consolidation --- no deprecated alias.

### EPG-7 note (decided: data/class seam)

Follows the `StandardPositionGraph` / `StandardPositionGraphData` pattern, but with JSON **above** the class in the dependency tree (ephemera-only manipulation authority):

| Layer | Package | Role |
| --- | --- | --- |
| **JSON (canonical)** | `mtw-interfaces` | **`EphemeraPositionGraphData`** (includes **`hostId`**), **`EphemeraPositionRelationalEdgeData`**, type guards |
| **JSON (Dynamo attribute)** | `mtw-interfaces` | **`EphemeraPositionGraphFieldPayload`** = `Omit<EphemeraPositionGraphData, 'hostId'>` --- value of `Meta::*.positionGraph` only |
| **JSON (read adapter)** | `mtw-gateways` | `PlayPositionGraph` (= `StandardPositionGraphData`); `project.ts` + extract helpers |
| **Class** | `lambda/ephemera/.../positionGraph/` | **`EphemeraPositionGraph`** --- `fromJSON`, `fromFieldPayload`, `fromPlayEnvelope`, `toJSON`, `toStored`, simulation |

Do **not** move the class into `mtw-gateways` or `mtw-interfaces`. Do **not** introduce a competing top-level JSON name (e.g. `EphemeraPositionGraphRecord`) --- **`EphemeraPositionGraphData`** is the manipulation JSON everywhere; persist strips `hostId` like `stripUniversalKey` on components.

### EPG-8 note (decided: interfaces renames)

Renames align data-type naming with the class (`EphemeraPositionGraph` / `EphemeraPositionGraphData`) and with WML (`StandardPositionGraph` / `StandardPositionGraphData`). The `Ephemera` prefix already scopes play-manipulation authority; redundant `Play` in the JSON type names is dropped. **`PlayPositionGraph`** keeps `Play` to mark the gateway **read-envelope** role.

| Old (`mtw-interfaces`) | New |
| --- | --- |
| `EphemeraPlayPositionGraph` | `EphemeraPositionGraphData` (+ **`hostId`** per EPG-9) |
| `EphemeraPlayPositionGraphNode` | `EphemeraPositionGraphNode` |
| `EphemeraPlayRelationalEdgeData` | `EphemeraPositionRelationalEdgeData` |
| `isEphemeraPlayPositionGraph` | `isEphemeraPositionGraphData` (validates full data **with** `hostId`) |
| `isEphemeraPlayPositionGraphNode` | `isEphemeraPositionGraphNode` |
| `isEphemeraPlayRelationalEdgeData` | `isEphemeraPositionRelationalEdgeData` |
| *(new)* | `EphemeraPositionGraphFieldPayload`, `isEphemeraPositionGraphFieldPayload` (attribute / row field validators) |

No deprecated aliases --- update all import sites in one slice (~25 files across `mtw-interfaces`, `mtw-gateways`, `lambda/ephemera`, `lambda/diagnostics`). **`Meta::Room` / `Meta::Character`** row types type **`positionGraph`** as **`EphemeraPositionGraphFieldPayload`**, not full data. Land renames in **P0** (before class scaffold) or first **P1** commit.

### EPG-9 note (decided: host binding)

Every manipulation path already carries host context in parallel (`HostEffect.hostId`, transact `Key.EphemeraId`, cache `componentId`). Desired state makes that explicit on the graph itself:

```typescript
// mtw-interfaces
type EphemeraPositionGraphData = {
  hostId: EphemeraMembershipHostId
  nodes: EphemeraPositionGraphNode[]
  edges?: EphemeraPositionRelationalEdgeData[]
}
type EphemeraPositionGraphFieldPayload = Omit<EphemeraPositionGraphData, 'hostId'>

// class (lambda/ephemera/.../positionGraph/)
class EphemeraPositionGraph {
  readonly hostId: EphemeraMembershipHostId
  static fromJSON(data: EphemeraPositionGraphData): EphemeraPositionGraph
  static fromFieldPayload(hostId: EphemeraMembershipHostId, payload: EphemeraPositionGraphFieldPayload): EphemeraPositionGraph
  static fromPlayEnvelope(hostId: EphemeraMembershipHostId, envelope: PlayPositionGraph): EphemeraPositionGraph
  toJSON(): EphemeraPositionGraphData
  toStored(): EphemeraPositionGraphFieldPayload
}
```

**Read boundary (Dynamo):** row always has `EphemeraId` + `positionGraph` field --- assemble once:

```typescript
EphemeraPositionGraph.fromFieldPayload(roomId, row.positionGraph ?? { nodes: [] })
// equivalent: fromJSON({ hostId: roomId, ...row.positionGraph })
```

**Persist boundary:** transact reducers assign **`toStored()`** to `draft.positionGraph` --- do **not** write `hostId` into the nested attribute (row PK is authoritative; avoids duplicate authority on one item).

**Multi-host (Phase C):** replace `Partial<Record<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>>` post-apply maps with **`EphemeraPositionGraph[]`** + upsert/find by **`graph.hostId`**. Kernel **`postApplyGraphs`** return type becomes **`EphemeraPositionGraph[]`** (or host-bound class list) after P2 refactor.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you finish each sub-step.

### Phase P0 --- Decision lock

- [X] **P0. Close EPG-2 through EPG-9** in **Open decisions** (EPG-1 decided).
- [ ] **P0. Interfaces renames + field payload types (EPG-8, EPG-9)** in [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) + all import sites; `mtw-interfaces` + `mtw-gateways` + `lambda/ephemera` + `lambda/diagnostics` tests green.
- [ ] **P0. Sketch class API** in [`positionGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/AGENT.md) stub (implementation map only --- full authority text lands in P4).

### Phase P1 --- Core `EphemeraPositionGraph` + tests

- [ ] **P1. Module scaffold** under [`positionGraph/`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/):
  - [ ] `EphemeraPositionGraph.ts` --- class
  - [ ] `types.ts` --- **`HostRelationalEdge`** (EPG-3), re-exports as needed
  - [ ] `index.ts` --- public exports
  - [ ] `EphemeraPositionGraph.test.ts` --- unit tests (port cases from [`positionGraphMerge.test.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.test.ts) + relational edge cases)
- [ ] **P1. Construction / serialization**
  - [ ] `empty(hostId)`, `fromJSON(EphemeraPositionGraphData)`, `fromFieldPayload(hostId, payload)` (EPG-9)
  - [ ] `fromPlayEnvelope(hostId, PlayPositionGraph)` via gateway normalize (EPG-4); `toPlayEnvelope()` via gateway project
  - [ ] `toJSON(): EphemeraPositionGraphData`, `toStored(): EphemeraPositionGraphFieldPayload`, `clone()`, `equals()`
  - [ ] `applyHostEffect` / `applyRelationalPatch` assert `effect.hostId` / `patch.hostId === this.hostId`
  - [ ] Factory helpers (EPG-6): `fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters` (assemble host + field at boundary)
- [ ] **P1. Membership nodes**
  - [ ] `characterIds`, `objectIds` (Set or readonly arrays --- pick one in EPG-2 lock)
  - [ ] `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add)
- [ ] **P1. Relational edges**
  - [ ] `relationalEdges` getter returns **`HostRelationalEdge[]`**; extract from raw `edges` (Exit-tolerant parse --- port from `relationalEdges.ts`)
  - [ ] `addRelationalEdge(edge: HostRelationalEdge)`, `removeRelationalEdge`, `edgesMatch`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`
- [ ] **P1. Simulation helpers** (kernel-facing, no Dynamo)
  - [ ] `applyMembershipEffect(effect: HostEffect)` or narrow helpers matching kernel `applyEffectToGraph`
  - [ ] `applyRelationalPatch(patch: HostRelationalPatch)` mirroring kernel validate/apply semantics
- [ ] **P1. Tests green** for new module in isolation.

### Phase P2 --- Positions lane refactor

- [ ] **P2. Kernel**
  - [ ] [`applyHostEffects.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts) --- load host-bound graphs (`fromFieldPayload` / `fromPlayEnvelope`), simulate on **`EphemeraPositionGraph[]`**, persist via **`toStored()`** per graph (EPG-9)
  - [ ] [`applyHostRelationalPatch.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostRelationalPatch.ts) --- same pattern; **`postApplyGraphs`** returns **`EphemeraPositionGraph[]`**
- [ ] **P2. Planners + transact reducers**
  - [ ] [`planHostRelationalPatch.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/planHostRelationalPatch.ts)
  - [ ] [`hostRelationalPatchTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/hostRelationalPatchTransactItems.ts)
  - [ ] Membership transact builders importing merge helpers: [`objectPlacementTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/objectPlacementTransactItems.ts), [`characterRoomMembershipTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/characterRoomMembershipTransactItems.ts), [`characterInventoryTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/characterInventoryTransactItems.ts)
- [ ] **P2. Delete legacy modules** (EPG-5 --- no shims)
  - [ ] Update all imports from [`positionGraphMerge.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) to `positionGraph/`; delete file
  - [ ] Update all imports from [`relationalEdges.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/relationalEdges.ts) to `positionGraph/`; delete file
- [ ] **P2. Regression tests** --- full positions manipulation + membership suite passes (no behavior change).

### Phase P3 --- Actions lane dedup

- [ ] **P3. Legality + compiler observation**
  - [ ] Refactor [`evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts) to import `EphemeraPositionGraph` from positions package path (not duplicate observation module)
  - [ ] Remove [`relationalObservation.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalObservation.ts) after imports updated; fix tests using `ProvisionalRelationalEdgeData` (move test fixtures to positions test helpers or inline in test files)
- [ ] **P3. Boundary rule** --- actions **may read** `EphemeraPositionGraph` for observation/legality; actions **must not** persist graphs or build transact items (unchanged --- positions kernel only)
- [ ] **P3. Tests** --- `evaluateRelationalLegality.test.ts`, `compileRelational.test.ts`, parse/objectManipulation slice if touched.

### Phase P4 --- Authority documentation (prevent drift)

- [ ] **P4. Concepts** --- [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md):
  - [ ] Add **`EphemeraPositionGraph`** vocabulary under graph roles / type boundary
  - [ ] Explicit contrast table: **`EphemeraPositionGraph`** (class, host-bound) vs **`EphemeraPositionGraphData`** (JSON with `hostId`) vs **`EphemeraPositionGraphFieldPayload`** (Dynamo attribute) vs WML **`StandardPositionGraph`** vs gateway **`PlayPositionGraph`**
  - [ ] Note future WML convergence: shared edge **types**, separate **authority** and operation sets (seed/snapshot vs live play)
- [ ] **P4. Implementation** --- [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) + [`positionGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/AGENT.md): module map, public API, who imports whom
- [ ] **P4. Manipulation** --- [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md): kernel reads/simulates via `EphemeraPositionGraph`; link `positionGraph/` as shared primitive
- [ ] **P4. Cross-package pointers** (short, no duplication):
  - [ ] [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) --- read projection stays gateway; link to ephemera model for manipulation semantics
  - [ ] [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) --- one line: play relational edges prototyped in ephemera; WML EdgeList TBD
- [ ] **P4. Contract** --- [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): only if normative rule needed (e.g. kernel in-memory simulation **must** use `EphemeraPositionGraph` after ship)

## Verification

From **`lambda/ephemera/`**:

```bash
npm run test -- --watchAll=false \
  dataSource/positions/positionGraph/ \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/ \
  dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.test.ts \
  dataSource/actions/enrich/objectManipulation/compileRelational.test.ts

npm run build
```

**Duplication grep** (goal: zero `ObservedHostRelationalEdge` or duplicate extract in actions after P3; steady-state name is **`HostRelationalEdge`**):

```bash
rg -n "ObservedHostRelationalEdge|extractRelationalEdgesFromPlayPositionGraph" \
  lambda/ephemera/dataSource/actions/

rg -n "function extractRelationalEdgesFromGraph|graphObjectIds" \
  lambda/ephemera/dataSource/positions/ \
  --glob '!**/positionGraph/**'
```

After P2/P3: relational extract/match logic lives under `positionGraph/` only.

**Authority grep** (actions must not grow persist):

```bash
rg -n "EphemeraPositionGraph" lambda/ephemera/dataSource/actions/
rg -n "transactWrite|buildHostRelationalPatchTransactItems|buildObjectPlacementTransactItems" \
  lambda/ephemera/dataSource/actions/enrich/objectManipulation/
```

Second command should stay clean (no transact in actions enrich).

## Progress

| Milestone | Status |
| --- | --- |
| Task plan authored | Done |
| P0 decision lock | Done (EPG-1--9 decided) |
| P0 interfaces renames + field payload (EPG-8, EPG-9) | Not started |
| P1 core class + tests | Not started |
| P2 positions refactor | Not started |
| P3 actions dedup | Not started |
| P4 durable docs | Not started |

## Coordination notes

- **Phase C compound kernel** ([`AGENT.manipulationFrameAndRelational.planning.md`](../actions/AGENT.manipulationFrameAndRelational.planning.md) C2): should consume **`EphemeraPositionGraph[]`** for multi-host simulation before single transact (EPG-9) --- P1 simulation helpers cover membership + relational patch on one host-bound instance; caller upserts into a list by **`hostId`**.
- **WML catch-up:** keep relational edge field names aligned with [`EphemeraPositionRelationalEdgeData`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (BD-2/BD-3; renamed from `EphemeraPlayRelationalEdgeData` per EPG-8); adapter methods (`fromPlayEnvelope` / future `fromWML`) are the seam --- do not import WML `StandardPositionGraph` into the class constructor path in v1.
- **Gateway rule:** production reads stay on `internalCache.Positions.get` per workspace gateways rule; class is for manipulation after read, not a second read path.

## Future consolidation checklist (post-plan, not this initiative)

When WML ships heterogeneous relational edges:

- [ ] Extract shared edge validation into mtw-wml edge package; ephemera class delegates parse/serialize for Relational tag
- [ ] Evaluate whether `toPlayEnvelope` can share code with WML wire serde without merging classes
- [ ] Snapshot/seed import remains a **bundle orchestrator** above single-host `EphemeraPositionGraph`
