# Positions manipulation --- implementation map and kernel spec

**Status:** Membership transfer shipped. Coordinators route through shared adapter + **`applyHostEffects`** kernel. Host-local relational patch documented as slice 5+ stub (no implementation yet).

Contracts: [`../AGENT.contract.md`](../AGENT.contract.md). Concepts: [`../AGENT.concepts.md`](../AGENT.concepts.md).

**Vocabulary:** Layered terms (host effect, membership host transfer, graph-grounded persist) live in [`../AGENT.concepts.md` --- Manipulation layering](../AGENT.concepts.md#manipulation-layering-membership-transfer) and [`../AGENT.contract.md` --- Manipulation persist layering](../AGENT.contract.md#manipulation-persist-layering).

---

## Target layering

```text
Per-operator ingress            verb-specific args, trusted ids (parse egress, navigate, repair, ...)
        |
        v
Shared membership adapter       froms/to planning, apply mode, membership observation -> HostEffect[]
        |                     (reusable across navigate, object place, takeHold, drop, ...)
        v
Manipulation kernel             validate + apply HostEffect[] on affected positionGraphs only
        |
        v
Per-operator coordinators       membership fact projection, stream/cache/bus bundles
```

**Invariant:** One kernel path for graph-grounded persist. Kernel accepts explicit **`HostEffect[]`** --- it does **not** independently discover priors via **`getMembershipContainers`**. Transfer planning lives in the **shared membership adapter** upstream.

---

## Section A --- Manipulation kernel (M4, M5)

### `HostEffect` (v1 membership-node only)

A **host effect** is one graph-grounded alteration on a fixed membership host: add or remove an identity node on that host's **`positionGraph`**, with matching adjacency dual-write. v1 covers **Character** and **Object** identity nodes only --- no in-room edges (slice 5+).

Spec shape (Phase 4a implements):

```typescript
type HostEffect =
    | { hostId: EphemeraRoomId; identityId: EphemeraCharacterId; op: 'add' | 'remove' }
    | { hostId: EphemeraRoomId; identityId: EphemeraObjectId; op: 'add' | 'remove' }
    | { hostId: EphemeraCharacterId; identityId: EphemeraObjectId; op: 'add' | 'remove' }
```

**Per-effect invariants:**

| Concern | Rule |
| --- | --- |
| Graph | Update via [`positionGraphMerge`](../membership/positionGraphMerge.ts) helpers (`addCharacterToGraph`, `removeCharacterFromGraph`, `addObjectToGraph`, `removeObjectFromGraph`) |
| Adjacency | Each `add` emits adjacency **Put**; each `remove` emits adjacency **Delete** (`buildPositionAdjacencyDataCategory`) |
| Host row | Room hosts: `Meta::Room`; character inventory hosts: `Meta::Character` |
| Edges | **None** in v1 --- relational patch is a separate future primitive |

**Reference transact builders today:** [`objectPlacementTransactItems.ts`](../membership/objectPlacementTransactItems.ts) (room + object), [`characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts) (character + object). Phase 4a kernel should reuse or wrap these builders rather than duplicating reducers.

### `applyHostEffects` contract

| Concern | Rule |
| --- | --- |
| **Input** | Explicit `HostEffect[]` only (**M1**) --- kernel **must not** call `getMembershipContainers` or plan transfers |
| **Reads** | `getPositionGraph` (or row fetch for transact reducers) **only** on hosts appearing in the effect list |
| **Validate** | Before transact: for each effect, confirm expected node presence/absence on that host's graph; fail fast on impossible plans |
| **Transact** | Single `transactWrite` bundling all host graph + adjacency items; exponential backoff on `TransactionCanceledException` (same pattern as expedient modules) |
| **Output** | `{ changed: boolean; postApplyGraphs: Partial<Record<hostId, EphemeraPlayPositionGraph>> }` for memo seeding |
| **Module path** | Top-level [`manipulation/`](./) --- sibling to `adapters/` and `membership/` (**M5**); entry: `applyHostEffects.ts` |
| **v1 scope** | Membership-node add/remove only (**M4**) |
| **Conflict** | On conflict between graph and adjacency, **`positionGraph` wins** (unchanged positions authority) |

**`changed` derivation:** `true` iff at least one effect alters stored graph state (equivalent to today's `MembershipDiff.changed` / `ObjectMembershipDiff.changed` after successful persist).

**RoomStack (eviction ladder):** **not** a kernel input. Navigate ladder persist runs in the parallel tail after [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) --- see [`persistRoomStackNavigate.ts`](../membership/persistRoomStackNavigate.ts) and [`afterCharacterMembershipNavigateChanged.ts`](../navigate/afterCharacterMembershipNavigateChanged.ts). Merge/trim detail: [`../AGENT.implementation.md` --- Eviction ladder](../AGENT.implementation.md#eviction-ladder-roomstack-storage); normative rules: [`../AGENT.contract.md` --- Eviction ladder](../AGENT.contract.md#eviction-ladder-roomstack-storage).

### Future: host-local relational patch (M4 stub; slice 5+)

Second kernel primitive: add/remove **edges** on a fixed host **`positionGraph`** without changing membership host. **Documented stub only** --- no implementation until relational operator slice. Kernel v1 **`applyHostEffects`** does **not** accept edge mutations (**M4**).

**Target layering (slice 5+; distinct from membership transfer):**

```text
Per-operator ingress (relational)     verb-specific args, trusted ids (put on, in, ...)
        |
        v
Relational planner (TBD)              edge observation + legality -> HostRelationalPatch[]
        |
        v
applyHostRelationalPatch (kernel)     validate + apply patches on affected hosts only
        |
        v
Per-operator coordinators (TBD)       relational fact projection, stream/cache/bus bundles
```

Relational ops **do not** route through the **shared membership adapter** (`planMembershipTransfer` / `froms`/`to`). They change **in-host topology** without changing membership host. Membership transfer and relational patch may **compose** in a future multi-step operator (e.g. pick up then place on table), but each primitive keeps its own kernel entry --- **no** `update*PositionGraphs` fork.

| Item | Documented value |
| --- | --- |
| **Kernel entry (slice 5+)** | [`applyHostRelationalPatch.ts`](applyHostRelationalPatch.ts) *(file does not exist yet)* |
| **Future coordinators** | [`relational/`](relational/) *(directory stub; sibling to `membership/`)* |
| **Types (future)** | `HostRelationalPatch` in [`types.ts`](types.ts) --- distinct from v1 `HostEffect` (membership-node only) |
| **Spec shape (sketch)** | `{ hostId; edge: { from; to; kind }; op: 'add' \| 'remove' }` on a **fixed host** `positionGraph` --- exact edge `kind` enum (`On`, `In`, ...) deferred to slice 5 diegetic design |
| **Kernel contract (sketch)** | Same pattern as `applyHostEffects`: explicit patch list only, `getPositionGraph` on affected hosts only, validate edge presence/absence, single transact, `postApplyGraphs` output; **no** adjacency dual-write (edges are forward-graph only per gateway schema) |
| **Design owner (pre-contract)** | [`../../diegeticLogic/AGENT.concepts.md`](../../diegeticLogic/AGENT.concepts.md#future-nested-containment-post-vertical) |

```typescript
// Future slice 5+ --- not exported until implementation lands
type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: { from: EphemeraId; to: EphemeraId; kind: string } // kind TBD
    op: 'add' | 'remove'
}
```

---

## Section B --- Shared membership adapter (M8, M2)

### Module location

[`manipulation/adapters/`](adapters/) (**M8**). Suggested planner entry: **`planMembershipTransfer`** (final export name may match Phase 4a code).

### Planner inputs

| Field | Meaning |
| --- | --- |
| `entityId` | `CHARACTER#` or `OBJECT#` being moved |
| `entityKind` | `'character'` \| `'object'` --- determines eligible host types and effect shapes |
| `applyMode` | `'end-state'` \| `'bounded'` |
| `target` | Destination membership host (`ROOM#`, `CHARACTER#`, or `null` for out-of-play / remove-from-all) |
| `boundedHostIds?` | Trusted ingress hosts to scrub when `applyMode === 'bounded'` |
| `priorContainers` | From `getMembershipContainers(entityId)` (or graph-forward observation on repair paths) |

Coordinator **owns** membership observation; adapter **consumes** `priorContainers` and does not re-fetch unless a repair path passes graph-forward priors explicitly.

### Apply modes

| Mode | Used by | Scrub rule | `froms` projection |
| --- | --- | --- | --- |
| **end-state** | Navigate, connect, disconnect, object room placement | Remove from **every** prior membership host `!== target` | All distinct priors removed |
| **bounded** | **`takeHold`** v1, **`drop`** v1 | Remove from **only** `boundedHostIds` when entity is present on that host; **do not** end-state scrub other hosts of the same kind (**M2** on room scrub for **`takeHold`**) | **`takeHold`**: typically `[ingress roomId]` when removed; **`drop`**: `[ingress characterId]` when removed |

### Bounded + character inventory nuance (shipped `computeTakeHoldDiff`)

Cross-host **`takeHold`** uses **mixed** planning:

| Host kind | Mode at apply | Behavior |
| --- | --- | --- |
| **Room** (source) | **bounded** | Scrub **only** trusted ingress `roomId` when object is on that room |
| **Character** (destination) | **end-state** on character hosts | Add at target character; remove from **other** character inventory hosts if present (`needsCharacterMove`) |

This preserves shipped semantics in [`computeTakeHoldDiff`](adapters/computeTakeHoldDiff.ts). Locked by adapter + kernel tests.

### Planner output

```typescript
type MembershipTransferPlan = {
    hostEffects: HostEffect[];
    projection: {
        froms: EphemeraMembershipHostId[];
        to: EphemeraMembershipHostId | null;
        changed: boolean;
    };
}
```

- **`hostEffects`:** adapter -> kernel contract.
- **`projection`:** membership host transfer semantics for bus facts (`froms[]` / `to`) and coordinator `changed` gates --- same fields as today's `MembershipDiff` / `ObjectMembershipDiff`.

### Expedient function mapping (reference impl)

| Expedient function | Location | Adapter mode | Notes |
| --- | --- | --- | --- |
| `computeMembershipDiff` | [`adapters/computeEndStateRoomDiff.ts`](adapters/computeEndStateRoomDiff.ts) | end-state (room hosts) | Character room membership; object room placement reuses same diff |
| `computeTakeHoldDiff` | [`adapters/computeTakeHoldDiff.ts`](adapters/computeTakeHoldDiff.ts) | bounded room + character end-state | **M2** reference; split `roomDiff` + `characterDiff` consumed by `hostEffectsFromObjectTakeHoldDiffs` |
| `computeDropDiff` | [`adapters/computeDropDiff.ts`](adapters/computeDropDiff.ts) | bounded room + character bounded | Symmetric inverse of **`takeHold`**; consumed by `planObjectDropTransfer` |

Phase 4a adapter tests assert `planMembershipTransfer` / `planObjectTakeHoldTransfer` / `planObjectDropTransfer` match these functions for equivalent inputs.

### Parse alignment (M2 gate)

Actions parse steady-state ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped---membership-aware-classify--enrich--egress)) guarantees:

- Atomic **`takeHold`** egress supplies trusted `objectId` + ingress `roomId` (`fromRoomId`).
- Atomic **`drop`** egress supplies trusted `objectId`, `characterId`, and destination `roomId` from actions **`Parse Requested`** ([`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#objectmanipulationintent-steady-state-shipped----membership-aware-classify--enrich--egress)).
- **`multiPresent`** (`containers.length > 1`) terminalizes before egress.
- Zero-host objects terminalize before egress.

Bounded adapter mode is still specified correctly for **repair**, **direct ingress** (positions **`Object Drop`**), and paths that bypass parse.

### Bounded + drop nuance (shipped `computeDropDiff`)

Cross-host **`drop`** uses **bounded** planning on both host kinds (symmetric inverse of **`takeHold`** room bounded + character end-state):

| Host kind | Mode at apply | Behavior |
| --- | --- | --- |
| **Character** (source) | **bounded** | Scrub **only** trusted ingress `characterId` when object is on that character |
| **Room** (destination) | **bounded** | Add at trusted ingress `roomId` when object is not already on that room; **do not** end-state scrub other room hosts |

Shipped in [`computeDropDiff`](adapters/computeDropDiff.ts) -> [`planObjectDropTransfer`](adapters/planObjectDropTransfer.ts) -> [`hostEffectsFromObjectDropDiffs`](adapters/hostEffectsFromDiffs.ts). Coordinator: [`applyObjectDrop`](membership/applyObjectDrop.ts) (mirror [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts)). Ingress: [`executeObjectDrop`](membership/executeObjectDrop.ts) + positions **`Object Drop`** stream subscription.

Fact projection: `froms: [CHARACTER#...]`, `to: ROOM#...`. Actions held-catalog identity + parse egress: [`actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator).

---

## Section C --- Compose rules

### End-to-end flow

```text
Ingress args (coordinator)
  -> membership observation (getMembershipContainers or repair graph-forward read)
  -> shared adapter.planMembershipTransfer(observation + applyMode + target + boundedHostIds?)
  -> HostEffect[] + projection { froms, to, changed }
  -> kernel.applyHostEffects({ hostEffects })
  -> coordinator: fact stream, cache memo, RoomUpdate / EphemeraUpdate bundle (unchanged contracts)
  -> [character navigate only, when changed && to !== null] parallel tail:
       persistRoomStackNavigate + orchestrateCharacterNavigate
```

Public coordinator APIs remain membership-shaped at ingress --- **not** raw `HostEffect[]`.

### Fact emission: projection-first (provisional)

**For the moment**, coordinators emit stream facts, cache memo keys, and bus bundles from the adapter's **`MembershipTransferProjection`** on successful kernel persist --- **assuming apply succeeded as planned** --- rather than re-deriving membership transfer semantics from post-apply `postApplyGraphs` or applied `hostEffects`.

| Chosen (now) | Deferred alternative |
| --- | --- |
| Use forward **`projection`** `{ froms, to, changed }` for `Character Moved` / `Object Moved` facts after `applyHostEffects` succeeds | Derive facts from **`postApplyGraphs`** or applied effects (graph-grounded projection) |

Matches today's expedient coordinators (facts from forward diff, not a second graph read). **May revisit** when graph-grounded fact verification or slice 5+ relational ops land.

### Per-operator compose table

| Coordinator | Ingress | Adapter mode | `boundedHostIds` | Fact |
| --- | --- | --- | --- | --- |
| [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `{ characterId, targetRoomId }` | end-state | --- | `Character Moved` |
| [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `{ objectId, targetRoomId }` | end-state | --- | `Object Moved` |
| [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) (objects spawn) | via [`spawnOneImprovisationObject`](../../objects/spawnImprovisationObjectsBatch.ts) after existence create | end-state | --- | `Object Moved` |
| [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts) | `{ objectId, roomId, characterId }` | bounded (room) + character end-state | `[roomId]` | `Object Moved` (cross-host) |
| [`applyObjectDrop`](membership/applyObjectDrop.ts) | `{ objectId, roomId, characterId }` | bounded (character) + bounded (room) | `[characterId]` (remove), trusted `roomId` (add) | `Object Moved` (cross-host) |

### Anti-patterns

- New `update*PositionGraphs` modules with bundled planner + transact.
- Per-verb diff computers outside the shared adapter.
- Kernel prior-read via `getMembershipContainers`.
- Parse-local persist fork for atomic object manipulation (egress must route through positions coordinator -> adapter -> kernel).

---

## Section D --- Migration decisions (graduated to durable docs)

Decisions **M1**--**M5**, **M7**, **M8**, **M2** are recorded in [`../AGENT.contract.md`](../AGENT.contract.md#manipulation-persist-layering) and [`../AGENT.concepts.md`](../AGENT.concepts.md#manipulation-layering-membership-transfer). This section retains the migration map for Phase 4b.

| ID | Decision | Spec location |
| --- | --- | --- |
| **M1** | Kernel accepts explicit `HostEffect[]` only; no independent prior discovery | Section A `applyHostEffects` |
| **M2** | Bounded **`takeHold`**: scrub **only** trusted ingress `roomId` on room hosts | Section B apply modes |
| **M4** | Kernel v1 = membership-node add/remove only; relational patch stub | Section A future primitive |
| **M5** | Kernel at `manipulation/` top-level (`applyHostEffects.ts`) | Section A module path |
| **M8** | Shared adapter at `manipulation/adapters/` | Section B module location |
| **M7** | Incremental migration order (Phase 4b) | Table below |

### Phase 4b migration order (M7) --- **Done**

1. **Object room** --- coordinator [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) -> `planMembershipTransfer` -> `applyHostEffects`.
2. **Character navigate** --- coordinator [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) -> `planMembershipTransfer` -> `applyHostEffects` (graph only); ladder via parallel tail.
3. **Cross-host takeHold** --- coordinator [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts) -> `planObjectTakeHoldTransfer` -> `applyHostEffects`.
4. **Cross-host drop** --- coordinator [`applyObjectDrop`](membership/applyObjectDrop.ts) -> `planObjectDropTransfer` -> `applyHostEffects`.

Legacy `update*PositionGraphs` wrappers **removed** in Phase 4c (2026-06-26). Persist tests: [`planMembershipTransfer.characterPersist.test.ts`](../membership/planMembershipTransfer.characterPersist.test.ts), [`planMembershipTransfer.objectPersist.test.ts`](../membership/planMembershipTransfer.objectPersist.test.ts).

---

## Section E --- Verification hooks

### Phase 2 (this spec)

Peer review: spec covers all three shipped apply paths without contradicting [`../AGENT.contract.md`](../AGENT.contract.md). Cross-check **M2** against actions parse steady-state and cross-host membership-changed bundle.

### Phase 4a (kernel + adapter scaffold)

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/manipulation/adapters/ \
  dataSource/positions/manipulation/applyHostEffects.test.ts
```

Acceptance: planner modes produce correct `HostEffect[]`; kernel produces correct transact items and `changed` / `postApplyGraphs`.

### Phase 4b--4c (persist migration)

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/
```

**No parallel persist paths (Phase 4c):**

```bash
rg -n "getMembershipContainers" \
  lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts 2>/dev/null || true

rg -n "computeTakeHoldDiff|computeDropDiff|computeMembershipDiff|updatePositionGraphs|updateObjectPositionGraphs|updateTakeHoldPositionGraphs|updateDropPositionGraphs" \
  lambda/ephemera/dataSource/positions/
```

Goal: transfer planners live in **shared adapter**; kernel has no `getMembershipContainers`; no `update*PositionGraphs` modules.

### Phase 4c ingress audit (shipped 2026-06-26)

| Ingress | Coordinator | Adapter | Kernel |
| --- | --- | --- | --- |
| Navigate / connect / disconnect / home | [`applyCharacterRoomMembership`](../membership/applyCharacterRoomMembership.ts) | `planMembershipTransfer` (end-state) | `applyHostEffects` |
| Object room place / remove / drift repair | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) | `planMembershipTransfer` (end-state) | `applyHostEffects` |
| Improvisational object spawn (objects lane) | [`applyObjectRoomMembership`](../membership/applyObjectRoomMembership.ts) via [`spawnOneImprovisationObject`](../../objects/spawnImprovisationObjectsBatch.ts) | `planMembershipTransfer` (end-state) | `applyHostEffects` |
| **`takeHold`** | [`applyObjectTakeHold`](membership/applyObjectTakeHold.ts) | `planObjectTakeHoldTransfer` | `applyHostEffects` |
| **`drop`** | [`applyObjectDrop`](membership/applyObjectDrop.ts) | `planObjectDropTransfer` | `applyHostEffects` |

**Kernel invariant:** [`applyHostEffects.ts`](applyHostEffects.ts) does **not** call `getMembershipContainers`.

**Documented exceptions (not membership-transfer parallel paths):**

| Path | Role |
| --- | --- |
| [`syncMembershipAdjacency.ts`](../membership/syncMembershipAdjacency.ts) / [`syncObjectMembershipAdjacency.ts`](../membership/syncObjectMembershipAdjacency.ts) | Adjacency-only sync when graph is correct but reverse index lags |

**Removed:** `updatePositionGraphs`, `updateObjectPositionGraphs`, `updateTakeHoldPositionGraphs`, `postApplyGraphProjection` (redundant with coordinators / kernel). Spawn no longer bypasses kernel via cross-lane transact or `postApplyGraphProjection`.

### Phase 5 relational hook (shipped 2026-06-26; doc stub only)

```bash
rg -n "applyHostRelationalPatch|Host-local relational patch|host-local relational" \
  lambda/ephemera/dataSource/positions/ \
  lambda/ephemera/diegeticLogic/AGENT.concepts.md
```

Acceptance: stub paths documented in implementation maps; diegetic logic links to this section; **no** new `.ts` under `manipulation/` until slice 5.

---

## This folder (code map)

### Phase 4a--4b scaffold and migration (shipped 2026-06-25 / 2026-06-26)

| Path | Role |
| --- | --- |
| [`types.ts`](types.ts) | `HostEffect`, `MembershipTransferPlan` |
| [`adapters/`](adapters/) | Shared membership transfer planner (**M8**): `planMembershipTransfer`, `planObjectTakeHoldTransfer`, `planObjectDropTransfer`, `computeEndStateRoomDiff`, `computeTakeHoldDiff`, `computeDropDiff`, `hostEffectsFromDiffs` |
| [`applyHostEffects.ts`](applyHostEffects.ts) | Manipulation kernel (**M5**, **M4**): validate + transact graph + adjacency only |

Shared primitives consumed by kernel: [`../membership/positionGraphMerge.ts`](../membership/positionGraphMerge.ts), [`../membership/objectPlacementTransactItems.ts`](../membership/objectPlacementTransactItems.ts), [`../membership/characterRoomMembershipTransactItems.ts`](../membership/characterRoomMembershipTransactItems.ts), [`membership/characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts).

### Shipped coordinators (adapter + kernel)

| File | Role |
| --- | --- |
| [`membership/executeObjectTakeHold.ts`](membership/executeObjectTakeHold.ts) | `Object Take Hold` ingress entry |
| [`membership/applyObjectTakeHold.ts`](membership/applyObjectTakeHold.ts) | Cross-host membership-changed bundle |
| [`membership/executeObjectDrop.ts`](membership/executeObjectDrop.ts) | `Object Drop` ingress entry |
| [`membership/applyObjectDrop.ts`](membership/applyObjectDrop.ts) | Cross-host membership-changed bundle |
| [`membership/characterInventoryTransactItems.ts`](membership/characterInventoryTransactItems.ts) | Character-host graph + adjacency transact builders (kernel reuse) |
| [`membership/types.ts`](membership/types.ts) | Cross-host diff + apply result types |

### Relational patch (slice 5+ stub)

| Path | Role |
| --- | --- |
| [`applyHostRelationalPatch.ts`](applyHostRelationalPatch.ts) | Second kernel primitive: host-local edge add/remove *(file does not exist yet)* |
| [`relational/`](relational/) | Future per-operator relational coordinators *(directory does not exist yet)* |

Spec: [Section A --- Future: host-local relational patch](#future-host-local-relational-patch-m4-stub-slice-5).

---

## Cross-links

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | Positions package entry |
| [`../AGENT.contract.md`](../AGENT.contract.md) | Shipped normative rules (graduates Phase 3) |
| [`../../actions/AGENT.implementation.md`](../../actions/AGENT.implementation.md) | Object manipulation parse steady-state; atomic operator playbook |
| [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md) | Operator intent/fact/presentation playbooks |
