# EphemeraPositionGraph --- play graph model and primitive consolidation

**Status:** Not started. Next step: **P0** decision lock, then **P1** core class + unit tests.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

Prerequisite context: Phase B relational vertical shipped ([`actions/AGENT.manipulationFrameAndRelational.planning.md`](../actions/AGENT.manipulationFrameAndRelational.planning.md)); positions manipulation kernel + shared adapter steady-state ([`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md)).

## Purpose

Introduce **`EphemeraPositionGraph`** --- an ephemera-owned in-memory model for **play manipulation** `positionGraph` truth --- and consolidate scattered functional primitives into class methods. Refactor existing membership and relational persist/legality paths to trust the model for graph observation, simulation, validation, and serialize/deserialize.

**Not** a WML `StandardPositionGraph` expansion. Design explicit adapters so future WML relational edge types can share **representation** without merging **authority** (authored blueprint vs live play vs snapshot import).

Retire this plan when durable docs land and Recommended order is complete; git retains history.

## Target architecture (steady-state sketch)

```text
Gateway read (PlayPositionGraph)     project.ts --- thin wire envelope; stays in mtw-gateways
        |
        v
EphemeraPositionGraph                positionGraph/ --- in-memory play model (this initiative)
        |
        +--> toStored()  ---> EphemeraPlayPositionGraph (Dynamo manipulation truth)
        |
        v
Kernel / planners / legality         applyHostEffects, applyHostRelationalPatch, planHostRelationalPatch,
                                     evaluateRelationalLegality --- simulate via class, transact from toStored()
        |
        v
Coordinators + adjacency             unchanged authority: transact builders, dual-write, streams
```

**Class owns:** membership node CRUD, relational edge CRUD/extract/match, host-local validation helpers, equals/clone, stored <-> play-envelope conversion.

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
- Durable doc updates: authority boundary between **`EphemeraPositionGraph`** (play manipulation model) and WML **`StandardPositionGraph`** (authored blueprint)

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
| Type boundary (`EphemeraPlayPositionGraph` vs `PlayPositionGraph`) | [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope) |
| Manipulation kernel layering | [`positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) |
| WML `StandardPositionGraph` (Exit-only, asset merge) | [`packages/mtw-wml/ts/standardize/components/positionGraph.ts`](../../../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts), [`keys/edges/AGENT.edges.md`](../../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) |
| Gateway projection + id extract | [`packages/mtw-gateways/ts/ephemera/positions/project.ts`](../../../../../packages/mtw-gateways/ts/ephemera/positions/project.ts) |
| Relational legality (actions) | [`actions/enrich/objectManipulation/evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts) |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read graph roles + type boundary in [`positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md).
3. Read current primitive modules (full file): [`positionGraphMerge.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts), [`relationalEdges.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/relationalEdges.ts), [`relationalObservation.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/relationalObservation.ts) --- note duplicated `ObservedHostRelationalEdge` / extraction.
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
| EPG-2 | **Mutation style** --- **immutable** instance methods return new `EphemeraPositionGraph` (match current functional reducers); `clone()` + `equals()` for simulation loops | P1 API | Open |
| EPG-3 | **Relational edge type export** --- single **`HostRelationalEdge`** (or keep `ObservedHostRelationalEdge` name) exported from `positionGraph/`; **`HostRelationalEdgeKind`** stays on `@tonylb/mtw-interfaces` | P1 types | Open |
| EPG-4 | **Play envelope ingest** --- `fromPlayEnvelope(PlayPositionGraph)` normalizes gateway read via existing extract helpers; `toPlayEnvelope()` delegates to `projectComponentGraphFromStoredPositionGraph(toStored())` or equivalent --- **do not** duplicate projection logic inside the class long-term | P1 adapters | Open |
| EPG-5 | **Legacy module fate** --- after refactor, **`positionGraphMerge.ts`** and **`relationalEdges.ts`** become thin re-export shims (one release) then delete; vs delete immediately with import path updates | P2 migration | Open |
| EPG-6 | **`effectiveRoomPositionGraph` / seed helpers** --- stay as factory functions on module boundary (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) wrapping class constructors, not methods on the class | P1 factories | Open |

### EPG-2 note (immutable vs mutable)

Immutable aligns with current `addObjectToGraph` / kernel `computePostApplyGraphsFromEffects` patterns and makes compound simulation (Phase C) safer. If mutable workspace is chosen, document explicit `clone()` before simulate in kernel contract.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you finish each sub-step.

### Phase P0 --- Decision lock

- [ ] **P0. Close EPG-2 -- EPG-6** in **Open decisions** (EPG-1 decided).
- [ ] **P0. Sketch class API** in [`positionGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/AGENT.md) stub (implementation map only --- full authority text lands in P4).

### Phase P1 --- Core `EphemeraPositionGraph` + tests

- [ ] **P1. Module scaffold** under [`positionGraph/`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/):
  - [ ] `EphemeraPositionGraph.ts` --- class
  - [ ] `types.ts` --- relational edge view type, re-exports as needed
  - [ ] `index.ts` --- public exports
  - [ ] `EphemeraPositionGraph.test.ts` --- unit tests (port cases from [`positionGraphMerge.test.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.test.ts) + relational edge cases)
- [ ] **P1. Construction / serialization**
  - [ ] `empty()`, `fromStored(EphemeraPlayPositionGraph)`, `fromPlayEnvelope(PlayPositionGraph)` (EPG-4)
  - [ ] `toStored(): EphemeraPlayPositionGraph`, `clone()`, `equals()`
  - [ ] Factory helpers (EPG-6): `fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`
- [ ] **P1. Membership nodes**
  - [ ] `characterIds`, `objectIds` (Set or readonly arrays --- pick one in EPG-2 lock)
  - [ ] `addCharacter`, `removeCharacter`, `addObject`, `removeObject` (idempotent add)
- [ ] **P1. Relational edges**
  - [ ] `relationalEdges` getter / extract from raw `edges` (Exit-tolerant parse --- port from `relationalEdges.ts`)
  - [ ] `addRelationalEdge`, `removeRelationalEdge`, `edgesMatch`, `bothObjectsOnGraph`, `nodeHasRelationalEdge`
- [ ] **P1. Simulation helpers** (kernel-facing, no Dynamo)
  - [ ] `applyMembershipEffect(effect: HostEffect)` or narrow helpers matching kernel `applyEffectToGraph`
  - [ ] `applyRelationalPatch(patch: HostRelationalPatch)` mirroring kernel validate/apply semantics
- [ ] **P1. Tests green** for new module in isolation.

### Phase P2 --- Positions lane refactor

- [ ] **P2. Kernel**
  - [ ] [`applyHostEffects.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts) --- load `EphemeraPositionGraph.fromPlayEnvelope`, simulate with class, `toStored()` for transact reducers
  - [ ] [`applyHostRelationalPatch.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostRelationalPatch.ts) --- same pattern
- [ ] **P2. Planners + transact reducers**
  - [ ] [`planHostRelationalPatch.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/planHostRelationalPatch.ts)
  - [ ] [`hostRelationalPatchTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/hostRelationalPatchTransactItems.ts)
  - [ ] Membership transact builders importing merge helpers: [`objectPlacementTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/objectPlacementTransactItems.ts), [`characterRoomMembershipTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/characterRoomMembershipTransactItems.ts), [`characterInventoryTransactItems.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/characterInventoryTransactItems.ts)
- [ ] **P2. Shim or delete legacy modules** (EPG-5)
  - [ ] Replace body of [`positionGraphMerge.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/positionGraphMerge.ts) with re-exports from `positionGraph/` OR update all imports and delete
  - [ ] Replace body of [`relationalEdges.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/relational/relationalEdges.ts) similarly
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
  - [ ] Explicit contrast table: **`EphemeraPositionGraph`** (play model) vs WML **`StandardPositionGraph`** (authored) vs gateway **`PlayPositionGraph`** (read envelope)
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

**Duplication grep** (goal: zero duplicate relational extract in actions):

```bash
rg -n "extractRelationalEdgesFromPlayPositionGraph|ObservedHostRelationalEdge" \
  lambda/ephemera/dataSource/actions/

rg -n "function extractRelationalEdgesFromGraph|graphObjectIds" \
  lambda/ephemera/dataSource/positions/ \
  --glob '!**/positionGraph/**'
```

After P2/P3: relational extract/match logic lives under `positionGraph/` only (legacy shims excepted until EPG-5 delete).

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
| P0 decision lock | Not started |
| P1 core class + tests | Not started |
| P2 positions refactor | Not started |
| P3 actions dedup | Not started |
| P4 durable docs | Not started |

## Coordination notes

- **Phase C compound kernel** ([`AGENT.manipulationFrameAndRelational.planning.md`](../actions/AGENT.manipulationFrameAndRelational.planning.md) C2): should consume `EphemeraPositionGraph` for multi-host simulation before single transact --- no need to block this plan on C2, but P1 simulation helpers should cover membership + relational patch on one host instance and be composable across hosts in caller code.
- **WML catch-up:** keep relational edge field names aligned with [`EphemeraPlayRelationalEdgeData`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (BD-2/BD-3); adapter methods (`fromPlayEnvelope` / future `fromWML`) are the seam --- do not import WML `StandardPositionGraph` into the class constructor path in v1.
- **Gateway rule:** production reads stay on `internalCache.Positions.get` per workspace gateways rule; class is for manipulation after read, not a second read path.

## Future consolidation checklist (post-plan, not this initiative)

When WML ships heterogeneous relational edges:

- [ ] Extract shared edge validation into mtw-wml edge package; ephemera class delegates parse/serialize for Relational tag
- [ ] Evaluate whether `toPlayEnvelope` can share code with WML wire serde without merging classes
- [ ] Snapshot/seed import remains a **bundle orchestrator** above single-host `EphemeraPositionGraph`
